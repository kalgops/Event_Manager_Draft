// db.js
const path    = require('path');
const sqlite3 = require('sqlite3').verbose();

// Opens (or creates) database.db in your project root
const db = new sqlite3.Database(
  path.join(__dirname, 'database.db'),
  err => {
    if (err) console.error('❌  DB connect error:', err);
    else     console.log('✅  Connected to SQLite:', path.join(__dirname,'database.db'));
  }
);

module.exports = db;
