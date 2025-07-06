// routes/attendee.js
const express = require('express');
const router = express.Router();
const db = global.db;

// GET /attendee - Attendee Home Page
router.get('/', (req, res, next) => {
  db.get('SELECT name, description FROM site_settings', (err, settings) => {
    if (err) return next(err);
    db.all('SELECT * FROM events WHERE published = 1 ORDER BY date ASC', (e2, events) => {
      if (e2) return next(e2);
      res.render('attendee_home', { settings, events });
    });
  });
});

// GET /attendee/events/:id - Show event & form
router.get('/events/:id', (req, res, next) => {
  const id = req.params.id;
  db.get('SELECT * FROM events WHERE id = ? AND published = 1', [id], (err, event) => {
    if (err) return next(err);
    if (!event) return res.status(404).render('404');
    db.all('SELECT * FROM tickets WHERE event_id = ?', [id], (e2, tickets) => {
      if (e2) return next(e2);
      res.render('attendee_event', { event, tickets });
    });
  });
});

// POST /attendee/events/:id/book - Handle booking
router.post('/events/:id/book', (req, res, next) => {
  const id = req.params.id;
  const { name, full_qty = 0, concession_qty = 0 } = req.body;
  if (!name) return res.status(400).send("Name required");

  db.serialize(() => {
    db.get('SELECT quantity FROM tickets WHERE event_id=? AND type="full"', [id], (e1, full) => {
      db.get('SELECT quantity FROM tickets WHERE event_id=? AND type="concession"', [id], (e2, concess) => {
        if (full_qty > full.quantity || concession_qty > concess.quantity) {
          return res.status(400).send("Not enough tickets available.");
        }
        db.run(
          'INSERT INTO bookings (event_id, name, full_qty, concession_qty, payment_status) VALUES (?, ?, ?, ?, ?)',
          [id, name, full_qty, concession_qty, "completed"],
          (e3) => {
            if (e3) return next(e3);
            db.run('UPDATE tickets SET quantity = quantity - ? WHERE event_id=? AND type="full"', [full_qty, id]);
            db.run('UPDATE tickets SET quantity = quantity - ? WHERE event_id=? AND type="concession"', [concession_qty, id]);
            res.redirect('/attendee');
          }
        );
      });
    });
  });
});

module.exports = router;
