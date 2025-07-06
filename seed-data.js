// seed-data.js - Create demo data for testing
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');

const db = new sqlite3.Database('database.db');

async function seedData() {
  console.log('🌱 Seeding demo data...');

  try {
    // Create demo admin
    const adminPassword = await bcrypt.hash('admin123', 10);
    db.run(
      `INSERT OR IGNORE INTO admins (id, username, email, password) 
       VALUES (1, 'admin', 'admin@eventmanager.com', ?)`,
      [adminPassword]
    );

    // Create demo organisers
    const organiserPassword = await bcrypt.hash('demo123', 10);
    
    const organisers = [
      { username: 'musicfest', email: 'music@demo.com', organisation: 'Music Festival Productions' },
      { username: 'techconf', email: 'tech@demo.com', organisation: 'Tech Conference Inc' },
      { username: 'artgallery', email: 'art@demo.com', organisation: 'City Art Gallery' }
    ];

    for (const org of organisers) {
      db.run(
        `INSERT OR IGNORE INTO organisers (username, email, password, organisation) 
         VALUES (?, ?, ?, ?)`,
        [org.username, org.email, organiserPassword, org.organisation],
        function(err) {
          if (!err && this.lastID) {
            // Create settings for each organiser
            db.run(
              `INSERT OR IGNORE INTO organiser_settings (organiser_id, site_name, site_desc) 
               VALUES (?, ?, ?)`,
              [this.lastID, org.organisation + ' Events', 'Experience amazing events with us!']
            );

            // Create some demo events
            createDemoEvents(this.lastID, org.organisation);
          }
        }
      );
    }

    console.log('✅ Demo data seeded successfully!');
    console.log('\n📝 Login credentials:');
    console.log('Admin: username=admin, password=admin123');
    console.log('Organisers: username=musicfest/techconf/artgallery, password=demo123');
    
  } catch (error) {
    console.error('❌ Error seeding data:', error);
  }
}

function createDemoEvents(organiserId, orgName) {
  const events = {
    'Music Festival Productions': [
      {
        title: 'Summer Music Festival 2025',
        description: 'Three days of incredible live music featuring top artists from around the world.',
        event_date: '2025-07-15',
        tickets: [
          { type: 'general', price: 89.99, quantity: 500 },
          { type: 'vip', price: 199.99, quantity: 100 },
          { type: 'weekend-pass', price: 249.99, quantity: 200 }
        ]
      },
      {
        title: 'Jazz in the Park',
        description: 'An evening of smooth jazz under the stars.',
        event_date: '2025-06-20',
        tickets: [
          { type: 'standard', price: 45.00, quantity: 300 },
          { type: 'premium', price: 75.00, quantity: 50 }
        ]
      }
    ],
    'Tech Conference Inc': [
      {
        title: 'AI & Future Tech Summit 2025',
        description: 'Explore the latest in artificial intelligence and emerging technologies.',
        event_date: '2025-09-10',
        tickets: [
          { type: 'standard', price: 299.00, quantity: 400 },
          { type: 'professional', price: 499.00, quantity: 200 },
          { type: 'student', price: 99.00, quantity: 100 }
        ]
      },
      {
        title: 'Blockchain Workshop',
        description: 'Hands-on workshop on blockchain development and applications.',
        event_date: '2025-05-25',
        tickets: [
          { type: 'general', price: 150.00, quantity: 50 }
        ]
      }
    ],
    'City Art Gallery': [
      {
        title: 'Modern Art Exhibition Opening',
        description: 'Exclusive opening night for our new modern art collection.',
        event_date: '2025-04-10',
        tickets: [
          { type: 'member', price: 0, quantity: 100 },
          { type: 'general', price: 25.00, quantity: 200 },
          { type: 'patron', price: 100.00, quantity: 50 }
        ]
      },
      {
        title: 'Art & Wine Evening',
        description: 'Enjoy fine art with carefully selected wines.',
        event_date: '2025-05-15',
        tickets: [
          { type: 'standard', price: 65.00, quantity: 80 },
          { type: 'couple', price: 120.00, quantity: 40 }
        ]
      }
    ]
  };

  const orgEvents = events[orgName] || [];
  
  orgEvents.forEach(event => {
    db.run(
      `INSERT INTO events (organiser_id, title, description, event_date, state, published_at) 
       VALUES (?, ?, ?, ?, 'published', datetime('now'))`,
      [organiserId, event.title, event.description, event.event_date],
      function(err) {
        if (!err && this.lastID) {
          // Create tickets for this event
          event.tickets.forEach(ticket => {
            db.run(
              `INSERT INTO tickets (event_id, type, price, quantity) 
               VALUES (?, ?, ?, ?)`,
              [this.lastID, ticket.type, ticket.price, ticket.quantity]
            );
          });
        }
      }
    );
  });
}

// Run seeding
seedData().then(() => {
  setTimeout(() => {
    db.close();
    process.exit(0);
  }, 2000);
});