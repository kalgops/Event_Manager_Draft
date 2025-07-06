// routes/attendee.js
const express = require('express');
const db      = require('../db');
const router  = express.Router();

// GET /attendee
router.get('/', (req, res, next) => {
  db.get(
    'SELECT * FROM site_settings WHERE organiser_id = 1',
    (err, settings) => {
      if (err) return next(err);
      db.all(
        'SELECT * FROM events WHERE state = "published" ORDER BY event_date',
        (err, events) => {
          if (err) return next(err);
          res.render('attendee-home', {
            title:    'Attendee Home',
            settings,
            events,
            booked:   true    // or pass true if you want to flag a recent booking
          });
        }
      );
    }
  );
});

// GET /attendee/events/:id
router.get('/events/:id', (req, res, next) => {
  const eid = req.params.id;
  db.get(
    'SELECT * FROM events WHERE id = ? AND state = "published"',
    [eid],
    (err, event) => {
      if (err) return next(err);
      if (!event) return res.status(404).render('404', { title: 'Not Found' });
      db.all(
        'SELECT * FROM tickets WHERE event_id = ?',
        [eid],
        (err, tickets) => {
          if (err) return next(err);
          res.render('attendee-event', {
            title:     `Attend: ${event.title}`,
            event,
            tickets,
            errors:    [],
            formData:  {}             // no prior input on initial GET
          });
        }
      );
    }
  );
});

// POST /attendee/events/:id/book
router.post('/events/:id/book', (req, res, next) => {
  const eid = req.params.id;
  const { name, email, tickets } = req.body;
  
  // Basic validation
  if (!name || !email) {
    return db.all(
      'SELECT * FROM tickets WHERE event_id = ?',
      [eid],
      (err, allTickets) => {
        if (err) return next(err);
        res.render('attendee-event', {
          title:    `Book: ${req.params.id}`,
          event:    { id: eid },
          tickets:  allTickets,
          errors:   ['Name and email are required'],
          formData: req.body
        });
      }
    );
  }

  // Parse selections { "<ticketId>": { quantity: "2" }, … }
  const selections = Object.entries(tickets || {})
    .map(([tid, obj]) => ({ id: Number(tid), qty: Number(obj.quantity) }))
    .filter(t => t.qty > 0);

  if (selections.length === 0) {
    return db.all(
      'SELECT * FROM tickets WHERE event_id = ?',
      [eid],
      (err, allTickets) => {
        if (err) return next(err);
        res.render('attendee-event', {
          title:    `Book: ${eid}`,
          event:    { id: eid },
          tickets:  allTickets,
          errors:   ['Please select at least one ticket'],
          formData: req.body
        });
      }
    );
  }

  // Start transaction
  db.serialize(() => {
    db.run('BEGIN', err => {
      if (err) return next(err);

      // For each selected ticket type
      for (let { id, qty } of selections) {
        // Check availability synchronously
        db.get(
          'SELECT quantity FROM tickets WHERE id = ?',
          [id],
          (err, row) => {
            if (err) return next(err);
            if (!row || row.quantity < qty) {
              return next(new Error('Not enough tickets available'));
            }
          }
        );

        // Insert booking
        db.run(
          'INSERT INTO bookings(event_id, ticket_id, buyer_name, buyer_email, qty) VALUES(?,?,?,?,?)',
          [eid, id, name, email, qty]
        );

        // Decrement stock
        db.run(
          'UPDATE tickets SET quantity = quantity - ? WHERE id = ?',
          [qty, id]
        );
      }

      // Commit or rollback
      db.run('COMMIT', err => {
        if (err) return next(err);
        res.redirect('/attendee?booked=1');
      });
    });
  });
});

module.exports = router;
// This code handles the attendee routes for viewing events, booking tickets, and managing bookings.