import sqlite from 'sqlite3';

const db = new sqlite.Database('sport.db', (err) => {
  if (err) throw err;
});

db.run('PRAGMA foreign_keys = ON');

export default db;

