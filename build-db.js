// build-db.js
// ─ Rebuilds database.db from db_schema.sql, seeds admin+site, then a sample event & tickets ─

const fs      = require('fs');
const path    = require('path');
const sqlite3 = require('sqlite3').verbose();

const DB_FILE           = 'database.db';
// path to the SQL schema relative to project root
const SCHEMA_FILE       = path.join(__dirname, 'storage', 'db_schema.sql');
const ADMIN_USER        = 'admin';
const ADMIN_PASS        = 'admin';
const DEFAULT_SITE_NAME = 'Auction Gala Planner';
const DEFAULT_SITE_DESC = 'Plan and run your charity auctions.';

//
// 1️⃣ Remove any existing database
//
if (fs.existsSync(DB_FILE)) {
  fs.unlinkSync(DB_FILE);
  console.log(`🔄 Removed existing ${DB_FILE}`);
}

//
// 2️⃣ Open a new database
//
const db = new sqlite3.Database(DB_FILE, err => {
  if (err) {
    console.error('🛑 Could not open database:', err);
    process.exit(1);
  }
  console.log(`🗄️  Created ${DB_FILE}`);

  //
  // 3️⃣ Load & execute the schema SQL
  //
  const schema = fs.readFileSync(SCHEMA_FILE, 'utf8');
  db.exec(schema, async execErr => {
    if (execErr) {
      console.error('🛑 Failed to execute schema:', execErr);
      db.close();
      process.exit(1);
    }
    console.log('✅ Schema applied');

    try {
      // 4️⃣ Insert/update default site settings
      db.run(
        'INSERT OR REPLACE INTO site_settings(id, name, description) VALUES(1, ?, ?)',
        [DEFAULT_SITE_NAME, DEFAULT_SITE_DESC],
        siteErr => {
          if (siteErr) {
            console.error('🛑 Failed to seed site_settings:', siteErr);
            db.close();
            process.exit(1);
          }
          console.log('✅ Seeded default site settings');

          // 5️⃣ Seed a sample event + tickets so your dashboard isn't empty
          db.run(
            `INSERT INTO events
               (title, description, event_date, state, published_at)
             VALUES('🌟 Sample Event', 'This is a seeded example.', '2025-08-01', 'published', datetime('now'))`,
            function(eventErr) {
              if (eventErr) {
                console.error('🛑 Failed to seed sample event:', eventErr);
                db.close();
                process.exit(1);
              }
              const sampleEventId = this.lastID;
              console.log(
                `✅ Seeded sample event (id=${sampleEventId})`
              );
              console.log('🎉 Database initialization complete!');
              db.close();
            }
          );
        }
      );
    } catch (hashErr) {
      console.error('🛑 Error during seeding:', hashErr);
      db.close();
      process.exit(1);
    }
  });
});

// 8️⃣ Catch any DB-level errors after open()
db.on('error', err => {
  console.error('Database error:', err);
});

// 9️⃣ Ensure we close the DB on program exit
process.on('SIGINT', () => {
  db.close(err => {
    if (err) console.error('Error closing database:', err);
    else     console.log('Database closed gracefully');
    process.exit(0);
  });
});
process.on('SIGTERM', () => {
  db.close(err => {
    if (err) console.error('Error closing database:', err);
    else     console.log('Database closed gracefully');
    process.exit(0);
  });
});