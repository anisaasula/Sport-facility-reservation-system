import crypto from 'crypto';
import db from './db.mjs';

const rowToUser = (row) => ({
  id: row.id,
  username: row.email,
  name: row.name,
  score: row.score,
  secret: row.secret,
  lastTotpStep: row.lastTotpStep,
});

const publicUser = (user, isTotp = false) => ({
  id: user.id,
  username: user.username,
  name: user.name,
  score: user.score,
  canDoTotp: user.secret ? true : false,
  isTotp,
});

const getUserById = (id) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT id, email, name, score, secret, lastTotpStep
      FROM users
      WHERE id = ?
    `;

    db.get(sql, [id], (err, row) => {
      if (err) {
        reject(err);
      } else if (row === undefined) {
        resolve(false);
      } else {
        resolve(rowToUser(row));
      }
    });
  });
};

const getUser = (email, password) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT id, email, name, score, hash, salt, secret, lastTotpStep
      FROM users
      WHERE email = ?
    `;

    db.get(sql, [email], (err, row) => {
      if (err) {
        reject(err);
      } else if (row === undefined) {
        resolve(false);
      } else {
        crypto.scrypt(password, row.salt, 32, (err, hashedPassword) => {
          if (err) {
            reject(err);
          } else if (!crypto.timingSafeEqual(Buffer.from(row.hash, 'hex'), hashedPassword)) {
            resolve(false);
          } else {
            resolve(rowToUser(row));
          }
        });
      }
    });
  });
};

const updateLastTotpStep = (userId, lastTotpStep) => {
  return new Promise((resolve, reject) => {
    const sql = 'UPDATE users SET lastTotpStep = ? WHERE id = ?';

    db.run(sql, [lastTotpStep, userId], function (err) {
      if (err) {
        reject(err);
      } else {
        resolve(this.changes);
      }
    });
  });
};

const resetScore = (userId) => {
  return new Promise((resolve, reject) => {
    const sql = 'UPDATE users SET score = 0 WHERE id = ?';

    db.run(sql, [userId], function (err) {
      if (err) {
        reject(err);
      } else {
        resolve(this.changes);
      }
    });
  });
};

export default {
  getUserById,
  getUser,
  publicUser,
  updateLastTotpStep,
  resetScore,
};