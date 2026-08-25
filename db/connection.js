const Database = require('better-sqlite3');
const path = require('path');

let db = null;

function getDb() {
  if (db) return db;

  const dbPath = process.env.DB_PATH || './db/samparka.db';
  const resolved = path.resolve(dbPath);

  db = new Database(resolved);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  return db;
}

function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = { getDb, closeDb };
