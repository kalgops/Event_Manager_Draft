// build-db.js – Build SQLite database from schema
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

// 1. Remove old database file if it exists
const DB_FILE = 'database.db';
if (fs.existsSync(DB_FILE)) {
  fs.unlinkSync(DB_FILE);
  console.log('🗑️  Old database.db deleted.');
}

// 2. Load schema
const schema = fs.readFileSync('db_schema.sql', 'utf-8');

// 3. Create new database and run schema
const db = new sqlite3.Database(DB_FILE, (err) => {
  if (err) throw err;
  console.log('✅ Created new database.db');
});

db.exec(schema, (err) => {
  if (err) {
    console.error('❌ Error applying schema:', err.message);
    process.exit(1);
  }

  console.log('📦 Schema applied successfully.');

  db.close(() => {
    console.log('✅ Done building DB. You can now run: npm run seed');
  });
});
