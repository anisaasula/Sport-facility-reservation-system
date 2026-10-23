import crypto from 'node:crypto';
import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import passport from 'passport';
import LocalStrategy from 'passport-local';
import session from 'express-session';
import { TOTP } from 'otpauth';
import { body, param, validationResult } from 'express-validator';

import sportDao from './dao-sport.mjs';
import userDao from './dao-users.mjs';

const app = express();
const PORT = 3001;

app.use(morgan('dev'));
app.use(express.json());

const corsOptions = {
  origin: 'http://localhost:5173',
  credentials: true,
};
app.use(cors(corsOptions));

passport.use(new LocalStrategy(async function verify(username, password, callback) {
  try {
    const user = await userDao.getUser(username, password);

    if (!user) {
      return callback(null, false, 'Incorrect username or password');
    }

    return callback(null, user);
  } catch (err) {
    return callback(err);
  }
}));

passport.serializeUser((user, callback) => {
  callback(null, user);
});

passport.deserializeUser(async (user, callback) => {
  try {
    const freshUser = await userDao.getUserById(user.id);

    if (!freshUser) {
      return callback(null, false);
    }

    return callback(null, freshUser);
  } catch (err) {
    return callback(err);
  }
});

app.use(session({
  secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
}));

app.use(passport.authenticate('session'));

const isLoggedIn = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }

  return res.status(401).json({ error: 'Not authenticated' });
};

const errorFormatter = ({ location, msg, path }) => {
  return `${location}[${path}]: ${msg}`;
};

const checkValidationErrors = (req, res) => {
  const errors = validationResult(req).formatWith(errorFormatter);

  if (!errors.isEmpty()) {
    res.status(422).json(errors.errors);
    return true;
  }

  return false;
};

const sendDaoError = (res, result) => {
  if (result && result.error) {
    res.status(result.status || 422).json({ error: result.error });
    return true;
  }

  return false;
};

function clientUserInfo(req) {
  return userDao.publicUser(req.user, req.session.method === 'totp');
}

function verifyTotpToken(user, token) {
  const totp = new TOTP({
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: user.secret,
  });

  const delta = totp.validate({ token, window: 1 });

  if (delta === null) {
    return false;
  }

  const currentCounter = totp.counter();
  const actualStep = currentCounter + delta;

  if (actualStep <= user.lastTotpStep) {
    return false;
  }

  user.lastTotpStep = actualStep;
  return true;
}

const messageFromResult = (result, fallback) => {
  if (typeof result === 'string') {
    return result;
  }

  if (result && result.message) {
    return result.message;
  }

  return fallback;
};

const operationResponse = async (req, message) => {
  const freshUser = await userDao.getUserById(req.user.id);

  return {
    user: userDao.publicUser(freshUser, req.session.method === 'totp'),
    publicInfo: await sportDao.getPublicInfo(),
    reservations: await sportDao.listReservations(req.user.id),
    message,
  };
};

/*** Public API ***/

app.get('/api/public', async (req, res) => {
  try {
    const publicInfo = await sportDao.getPublicInfo();
    res.json(publicInfo);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

/*** Reservation APIs ***/

app.get('/api/reservations', isLoggedIn, async (req, res) => {
  try {
    const reservations = await sportDao.listReservations(req.user.id);
    res.json(reservations);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.post(
  '/api/reservations',
  isLoggedIn,
  [
    body('mode').isIn(['direct', 'automatic']).withMessage('Invalid facility selection mode.'),
    body('facilityCode').optional().isString().withMessage('Invalid facility code.'),
    body('facilityType').optional().isString().withMessage('Invalid facility type.'),
    body('equipment').isObject().withMessage('Equipment must be an object.'),
  ],
  async (req, res) => {
    if (checkValidationErrors(req, res)) {
      return;
    }

    try {
      const result = await sportDao.createReservation(req.user, req.body);

      if (sendDaoError(res, result)) {
        return;
      }

      const response = await operationResponse(req, messageFromResult(result, 'Reservation created.'));
      res.status(201).json(response);
    } catch (err) {
      res.status(500).json({ error: 'Database error' });
    }
  }
);

app.put(
  '/api/reservations/:id',
  isLoggedIn,
  [
    param('id').isInt({ min: 1 }).withMessage('Invalid reservation id.'),
    body('equipment').isObject().withMessage('Equipment must be an object.'),
  ],
  async (req, res) => {
    if (checkValidationErrors(req, res)) {
      return;
    }

    try {
      const result = await sportDao.updateReservation(req.user, Number(req.params.id), req.body);

      if (sendDaoError(res, result)) {
        return;
      }

      const response = await operationResponse(req, messageFromResult(result, 'Reservation modified.'));
      res.json(response);
    } catch (err) {
      res.status(500).json({ error: 'Database error' });
    }
  }
);

app.delete(
  '/api/reservations/:id',
  isLoggedIn,
  [
    param('id').isInt({ min: 1 }).withMessage('Invalid reservation id.'),
  ],
  async (req, res) => {
    if (checkValidationErrors(req, res)) {
      return;
    }

    try {
      const result = await sportDao.deleteReservation(req.user.id, Number(req.params.id));

      if (sendDaoError(res, result)) {
        return;
      }

      const response = await operationResponse(req, messageFromResult(result, 'Reservation deleted.'));
      res.json(response);
    } catch (err) {
      res.status(500).json({ error: 'Database error' });
    }
  }
);

/*** Authentication APIs ***/

app.post('/api/sessions', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) {
      return next(err);
    }

    if (!user) {
      return res.status(401).json({ error: info });
    }

    req.login(user, (err) => {
      if (err) {
        return next(err);
      }

      req.session.method = 'plain';

      return res.json(clientUserInfo(req));
    });
  })(req, res, next);
});

app.post(
  '/api/login-totp',
  isLoggedIn,
  [
    body('code').isLength({ min: 6, max: 6 }).isNumeric().withMessage('Invalid TOTP code.'),
  ],
  async (req, res) => {
    if (checkValidationErrors(req, res)) {
      return;
    }

    if (!req.user.secret) {
      return res.status(400).json({ error: 'Cannot authenticate with TOTP' });
    }

    const success = verifyTotpToken(req.user, req.body.code);

    if (!success) {
      return res.status(401).json({ error: 'Cannot authenticate with TOTP' });
    }

    try {
      req.session.method = 'totp';

      await userDao.updateLastTotpStep(req.user.id, req.user.lastTotpStep);
      await userDao.resetScore(req.user.id);

      const freshUser = await userDao.getUserById(req.user.id);
      return res.json(userDao.publicUser(freshUser, true));
    } catch (err) {
      return res.status(500).json({ error: 'Database error' });
    }
  }
);

app.get('/api/sessions/current', (req, res) => {
  if (req.isAuthenticated()) {
    return res.status(200).json(clientUserInfo(req));
  }

  return res.status(401).json({ error: 'Not authenticated' });
});

app.delete('/api/sessions/current', (req, res) => {
  req.logout(() => {
    res.status(200).json({});
  });
});

app.use((err, req, res, next) => {
  res.status(500).json({ error: 'Server error' });
});

app.listen(PORT, (err) => {
  if (err) {
    console.log(err);
  } else {
    console.log(`Server listening at http://localhost:${PORT}`);
  }
});