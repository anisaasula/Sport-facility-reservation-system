import crypto from 'crypto';
import { Secret } from 'otpauth';
import db from './db.mjs';


const exec = (sql) => {
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => err ? reject(err) : resolve());
  });
};

const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) {
        reject(err);
      } else {
        resolve(this);
      }
    });
  });
};

const hashPassword = (password, salt) => {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 32, (err, hashedPassword) => {
      if (err) {
        reject(err);
      } else {
        resolve(hashedPassword.toString('hex'));
      }
    });
  });
};

async function insertUser(email, name, password, score, salt) {
  const hash = await hashPassword(password, salt);
  const demoTotpSecret = new Secret({ size: 20 }).base32;

  const result = await run(
    'INSERT INTO users(email, name, hash, salt, score, secret, lastTotpStep) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [email, name, hash, salt, score, demoTotpSecret, 0]
  );

  // Local demo only: configure the authenticator app using this seed.
  console.log(`Demo TOTP seed for ${email}: ${demoTotpSecret}`);
  return result.lastID;
}

async function insertReservation(userId, facilityCode, equipment) {
  const reservation = await run(
    'INSERT INTO reservations(userId, facilityCode, createdAt) VALUES (?, ?, CURRENT_TIMESTAMP)',
    [userId, facilityCode]
  );

  for (const [equipmentName, quantity] of Object.entries(equipment)) {
    await run(
      'INSERT INTO reservation_equipment(reservationId, equipmentName, quantity) VALUES (?, ?, ?)',
      [reservation.lastID, equipmentName, quantity]
    );
  }
}

async function main() {
  await exec(`
    PRAGMA foreign_keys = OFF;

    DROP TABLE IF EXISTS reservation_equipment;
    DROP TABLE IF EXISTS released_facility_types;
    DROP TABLE IF EXISTS reservations;
    DROP TABLE IF EXISTS facility_equipment_rules;
    DROP TABLE IF EXISTS equipment;
    DROP TABLE IF EXISTS facilities;
    DROP TABLE IF EXISTS users;

    PRAGMA foreign_keys = ON;

    CREATE TABLE users(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      score INTEGER NOT NULL DEFAULT 0 CHECK(score <= 0),
      secret TEXT NOT NULL,
      lastTotpStep INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE facilities(
      code TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      label TEXT NOT NULL
    );

    CREATE TABLE equipment(
      name TEXT PRIMARY KEY,
      totalQuantity INTEGER NOT NULL CHECK(totalQuantity >= 0)
    );

    CREATE TABLE facility_equipment_rules(
      facilityType TEXT NOT NULL,
      equipmentName TEXT NOT NULL,
      minQuantity INTEGER NOT NULL DEFAULT 0 CHECK(minQuantity >= 0),
      mandatory INTEGER NOT NULL CHECK(mandatory IN (0, 1)),
      PRIMARY KEY(facilityType, equipmentName),
      FOREIGN KEY(equipmentName) REFERENCES equipment(name)
    );

    CREATE TABLE reservations(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      facilityCode TEXT NOT NULL UNIQUE,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(userId) REFERENCES users(id),
      FOREIGN KEY(facilityCode) REFERENCES facilities(code)
    );

    CREATE TABLE reservation_equipment(
      reservationId INTEGER NOT NULL,
      equipmentName TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK(quantity > 0),
      PRIMARY KEY(reservationId, equipmentName),
      FOREIGN KEY(reservationId) REFERENCES reservations(id) ON DELETE CASCADE,
      FOREIGN KEY(equipmentName) REFERENCES equipment(name)
    );

    CREATE TABLE released_facility_types(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      facilityType TEXT NOT NULL,
      releasedAt INTEGER NOT NULL DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)),
      FOREIGN KEY(userId) REFERENCES users(id)
    );
  `);

  await insertUser('u1@p.it', 'John', 'pwd1', 0, 'e91b76899d2c4ea9');
  const aliceId = await insertUser('u2@p.it', 'Alice', 'pwd2', 0, '9c41c0dd430b45aa');
  const georgeId = await insertUser('u3@p.it', 'George', 'pwd3', -1, '7e527ccdac1647ea');
  const maryId = await insertUser('u4@p.it', 'Mary', 'pwd4', -2, '5164c16659c241d8');

  const facilities = [
    ['T1', 'tennis', 'Tennis court #1'],
    ['T2', 'tennis', 'Tennis court #2'],
    ['T3', 'tennis', 'Tennis court #3'],
    ['B1', 'basketball', 'Basketball court #1'],
    ['B2', 'basketball', 'Basketball court #2'],
    ['V1', 'volleyball', 'Volleyball court #1'],
    ['V2', 'volleyball', 'Volleyball court #2'],
    ['S1', 'soccer', 'Soccer field #1'],
    ['TT1', 'table-tennis', 'Table tennis table #1'],
    ['TT2', 'table-tennis', 'Table tennis table #2'],
    ['TT3', 'table-tennis', 'Table tennis table #3'],
    ['TT4', 'table-tennis', 'Table tennis table #4'],
    ['C1', 'cycling', 'Cycling track #1'],
    ['C2', 'cycling', 'Cycling track #2']
  ];

  for (const facility of facilities) {
    await run('INSERT INTO facilities(code, type, label) VALUES (?, ?, ?)', facility);
  }

  const equipment = [
    ['tennis racket', 8],
    ['tennis balls', 7],
    ['towels', 4],
    ['basketball', 2],
    ['cones', 4],
    ['volleyball', 2],
    ['pair of knee pads', 10],
    ['soccer ball', 2],
    ['pair of soccer shoes', 12],
    ['pair of goalkeeper gloves', 2],
    ['table tennis rackets', 8],
    ['table tennis balls', 4],
    ['bicycle', 4],
    ['helmet', 4],
    ['repair kit', 1]
  ];

  for (const item of equipment) {
    await run('INSERT INTO equipment(name, totalQuantity) VALUES (?, ?)', item);
  }

  const rules = [
    ['tennis', 'tennis racket', 2, 1],
    ['tennis', 'tennis balls', 3, 1],
    ['tennis', 'towels', 0, 0],
    ['basketball', 'basketball', 1, 1],
    ['basketball', 'cones', 0, 0],
    ['volleyball', 'volleyball', 1, 1],
    ['volleyball', 'pair of knee pads', 0, 0],
    ['soccer', 'soccer ball', 1, 1],
    ['soccer', 'pair of soccer shoes', 10, 1],
    ['soccer', 'pair of goalkeeper gloves', 0, 0],
    ['table-tennis', 'table tennis rackets', 2, 1],
    ['table-tennis', 'table tennis balls', 1, 1],
    ['cycling', 'bicycle', 1, 1],
    ['cycling', 'helmet', 1, 1],
    ['cycling', 'repair kit', 0, 0]
  ];

  for (const rule of rules) {
    await run(
      'INSERT INTO facility_equipment_rules(facilityType, equipmentName, minQuantity, mandatory) VALUES (?, ?, ?, ?)',
      rule
    );
  }

  await insertReservation(aliceId, 'T1', {
    'tennis racket': 2,
    'tennis balls': 3
  });

  await insertReservation(georgeId, 'B1', {
    basketball: 1
  });

  await insertReservation(maryId, 'V1', {
    volleyball: 1
  });

  await insertReservation(maryId, 'TT1', {
    'table tennis rackets': 2,
    'table tennis balls': 1
  });
}

main()
  .catch((err) => console.error(err))
  .finally(() => db.close());