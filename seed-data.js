// seed-data.js - Create demo data for testing
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');

// Open database
const db = new sqlite3.Database('database.db');

async function seedData() {
  console.log('🌱 Seeding demo data...');

  try {
    const adminPassword = await bcrypt.hash('admin123', 10);
    const organiserPassword = await bcrypt.hash('demo123', 10);
    const userPassword = await bcrypt.hash('user123', 10);

    // Insert Admin
    db.run(
      `INSERT OR IGNORE INTO admins (id, username, email, password) 
       VALUES (1, 'admin', 'admin@eventmanager.com', ?)`,
      [adminPassword]
    );

    // Insert Users
    const users = [
      { name: 'Alice Example', email: 'alice@example.com' },
      { name: 'Bob Sample', email: 'bob@example.com' }
    ];
    for (const user of users) {
      await insertUser(user, userPassword);
    }

    // Insert Organisers + Site Settings + Events + Tickets
    const organisers = [
      { username: 'musicfest', organisation: 'Music Festival Productions' },
      { username: 'techconf', organisation: 'Tech Conference Inc' },
      { username: 'artgallery', organisation: 'City Art Gallery' }
    ];
    for (const org of organisers) {
      await insertOrganiser(org, organiserPassword);
    }

    // Finish
    setTimeout(() => {
      db.close();
      console.log('✅ Done seeding!');
      console.log('\n📝 Log in with:\n - Organiser: musicfest / demo123\n - Admin: admin / admin123\n - User: alice@example.com / user123\n');
    }, 2000);

  } catch (err) {
    console.error('❌ Error during seed:', err);
  }
}

function insertUser(user, hashedPassword) {
  return new Promise(resolve => {
    db.run(
      `INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)`,
      [user.name, user.email, hashedPassword],
      err => {
        if (err) console.error(`⚠️ Could not insert user ${user.email}:`, err.message);
        resolve();
      }
    );
  });
}

function insertOrganiser(org, hashedPassword) {
  return new Promise(resolve => {
    db.run(
      `INSERT INTO organisers (username, password_hash, organisation)
       VALUES (?, ?, ?)`,
      [org.username, hashedPassword, org.organisation],
      function (err) {
        if (err) {
          console.error(`❌ Failed to insert organiser ${org.username}:`, err.message);
          return resolve();
        }

        const organiserId = this.lastID;

        db.run(
          `INSERT INTO site_settings (organiser_id, name, description) VALUES (?, ?, ?)`,
          [organiserId, org.organisation + ' Events', 'Curated experiences for everyone']
        );

        insertDemoEvents(organiserId, org.organisation);
        resolve();
      }
    );
  });
}

function insertDemoEvents(organiserId, orgName) {
  const eventsMap = {
    'Music Festival Productions': [
      {
        title: 'Summer Music Festival 2025',
        description: '3 days of live music.',
        event_date: '2025-07-15',
        tickets: [
          { type: 'general', price: 89.99, quantity: 500 },
          { type: 'vip', price: 199.99, quantity: 100 }
        ]
      }
    ],
    'Tech Conference Inc': [
      {
        title: 'AI Summit 2025',
        description: 'Latest in AI + tech.',
        event_date: '2025-09-10',
        tickets: [
          { type: 'standard', price: 299.00, quantity: 400 },
          { type: 'student', price: 99.00, quantity: 100 }
        ]
      }
    ],
    'City Art Gallery': [
      {
        title: 'Modern Art Opening',
        description: 'A preview of upcoming local artists.',
        event_date: '2025-04-10',
        tickets: [
          { type: 'full-price', price: 0, quantity: 0 },
          { type: 'concession', price: 0, quantity: 0 }
        ]
      }
    ]
  };

  const events = eventsMap[orgName] || [];

  events.forEach(ev => {
    db.run(
      `INSERT INTO events (organiser_id, title, description, event_date, state, published_at) 
       VALUES (?, ?, ?, ?, 'published', datetime('now'))`,
      [organiserId, ev.title, ev.description, ev.event_date],
      function (err) {
        if (err) return console.error('❌ Failed to insert event:', err.message);

        const eventId = this.lastID;

        ev.tickets.forEach(ticket => {
          db.run(
            `INSERT INTO tickets (event_id, type, price, quantity) VALUES (?, ?, ?, ?)`,
            [eventId, ticket.type, ticket.price, ticket.quantity],
            function (ticketErr) {
              if (ticketErr) return console.error('❌ Failed to insert ticket:', ticketErr.message);

              const ticketId = this.lastID;

              // Add booking for alice@example.com
              db.get(`SELECT id, name, email FROM users WHERE email = 'alice@example.com'`, (e3, user) => {
                if (user) {
                  db.run(
                    `INSERT INTO bookings (event_id, ticket_id, user_id, qty, buyer_name, buyer_email, payment_status)
                     VALUES (?, ?, ?, ?, ?, ?, 'completed')`,
                    [eventId, ticketId, user.id, 2, user.name, user.email],
                    err => {
                      if (err) console.error('❌ Booking insert failed:', err.message);
                    }
                  );
                }
              });
            }
          );
        });
      }
    );
  });
}

// Run seeding
seedData();
