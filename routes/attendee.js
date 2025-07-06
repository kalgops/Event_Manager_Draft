// routes/attendee.js
const express = require('express');
const router = express.Router();
const db = global.db;

/**
 * GET /attendee
 * Shows the attendee homepage with list of published events
 */
router.get('/', (req, res, next) => {
  db.get('SELECT name, description FROM site_settings LIMIT 1', (err, settings) => {
    if (err) return next(err);

    db.all(
      'SELECT * FROM events WHERE state = "published" ORDER BY event_date ASC',
      (e2, events) => {
        if (e2) return next(e2);
        res.render('attendee-home', { settings, events, booked: req.query.booked === '1' });
      }
    );
  });
});

/**
 * GET /attendee/events/:id
 * Displays details and ticket form for a single event
 */
router.get('/events/:id', (req, res, next) => {
  const id = req.params.id;

  db.get('SELECT * FROM events WHERE id = ? AND state = "published"', [id], (err, event) => {
    if (err) return next(err);
    if (!event) return res.status(404).render('404');

    db.all('SELECT * FROM tickets WHERE event_id = ?', [id], (e2, tickets) => {
      if (e2) return next(e2);
      res.render('attendee-event', {
        event,
        tickets,
        errors: [],
        formData: { tickets: {}, name: '', email: '' }
      });
    });
  });
});

/**
 * POST /attendee/events/:id/book
 * Handles event booking submission
 */
router.post('/events/:id/book', (req, res, next) => {
  const id = req.params.id;
  const { name, email } = req.body;
  const ticketData = req.body.tickets || {};

  const errors = [];

  if (!name) errors.push('Name is required');
  if (!email || !email.includes('@')) errors.push('Valid email is required');
  if (!Object.keys(ticketData).length) errors.push('Please select at least one ticket');

  if (errors.length) {
    db.get('SELECT * FROM events WHERE id = ?', [id], (err, event) => {
      if (err || !event) return next(err || new Error("Event not found"));

      db.all('SELECT * FROM tickets WHERE event_id = ?', [id], (err2, tickets) => {
        if (err2) return next(err2);

        return res.render('attendee-event', {
          event,
          tickets,
          errors,
          formData: { tickets: ticketData, name, email }
        });
      });
    });
    return;
  }

  // Process booking
  db.serialize(() => {
    db.all('SELECT * FROM tickets WHERE event_id = ?', [id], (err, allTickets) => {
      if (err) return next(err);

      let totalAmount = 0;
      const updates = [];

      for (const [ticketId, info] of Object.entries(ticketData)) {
        const ticket = allTickets.find(t => t.id === parseInt(ticketId));
        if (!ticket) {
          errors.push(`Invalid ticket: ${ticketId}`);
          continue;
        }

        const qty = parseInt(info.quantity, 10);
        if (isNaN(qty) || qty < 0) continue;
        if (qty > ticket.quantity) {
          errors.push(`Not enough ${ticket.type} tickets left`);
          continue;
        }

        totalAmount += qty * ticket.price;
        updates.push({ id: ticketId, qty });
      }

      if (errors.length) {
        return res.render('attendee-event', {
          event: allTickets[0],
          tickets: allTickets,
          errors,
          formData: { tickets: ticketData, name, email }
        });
      }

      db.run(
        'INSERT INTO bookings (event_id, buyer_name, qty, total_amount, payment_status, booked_at) VALUES (?, ?, ?, ?, ?, datetime("now"))',
        [id, name, updates.reduce((sum, u) => sum + u.qty, 0), totalAmount, 'completed'],
        function (e3) {
          if (e3) return next(e3);

          // Update ticket inventory
          const stmt = db.prepare('UPDATE tickets SET quantity = quantity - ? WHERE id = ?');
          for (const u of updates) {
            stmt.run(u.qty, u.id);
          }
          stmt.finalize(() => {
            res.redirect('/attendee?booked=1');
          });
        }
      );
    });
  });
});

module.exports = router;
