// routes/attendee.js
const express = require('express');
const Joi     = require('joi');
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
            booked:   false    // or pass true if you want to flag a recent booking
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
  const schema = Joi.object({
    ticket_id: Joi.number().integer().required(),
    quantity:  Joi.number().integer().min(1).required(),
    name:      Joi.string().required(),
    email:     Joi.string().email().required()
  });

  const { error, value } = schema.validate(req.body, { abortEarly: false });
  if (error) {
    const msgs = error.details.map(d => d.message);
    return db.all(
      'SELECT * FROM tickets WHERE event_id = ?',
      [eid],
      (err, tickets) => {
        if (err) return next(err);
        res.render('attendee-event', {
          title:     'Book Event',
          event:     { id: eid },
          tickets,
          errors:    msgs,
          formData:  req.body   // preserve the user’s inputs
        });
      }
    );
  }

  // Check ticket availability
  db.get(
    'SELECT quantity FROM tickets WHERE id = ?',
    [value.ticket_id],
    (err, row) => {
      if (err) return next(err);
      if (!row || row.quantity < value.quantity) {
        return db.all(
          'SELECT * FROM tickets WHERE event_id = ?',
          [eid],
          (err, tickets) => {
            if (err) return next(err);
            res.render('attendee-event', {
              title:     'Book Event',
              event:     { id: eid },
              tickets,
              errors:    ['Not enough tickets available'],
              formData:  req.body
            });
          }
        );
      }

      // Perform the booking in a transaction
      db.serialize(() => {
        db.run('BEGIN');
        db.run(
          'INSERT INTO bookings(event_id, ticket_id, buyer_name, qty) VALUES(?,?,?,?)',
          [eid, value.ticket_id, value.name, value.quantity]
        );
        db.run(
          'UPDATE tickets SET quantity = quantity - ? WHERE id = ?',
          [value.quantity, value.ticket_id]
        );
        db.run('COMMIT', err => {
          if (err) return next(err);
          // Redirect to home with a “booked” flag if you like
          res.redirect('/attendee');
        });
      });
    }
  );
});

module.exports = router;
