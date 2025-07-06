// routes/organiser.js
const express = require('express');
const router = express.Router();
const db = global.db;
const { ensureOrganiserOrAdmin } = require('../middleware/auth');

// ─── Organiser Home Page ─────────────────────────────
router.get('/', ensureOrganiserOrAdmin, (req, res, next) => {
  const organiserId = req.session.user?.id || req.session.admin?.id;
  db.get('SELECT name, description FROM site_settings WHERE organiser_id=?', [organiserId], (err, settings) => {
    if (err) return next(err);
    db.all('SELECT * FROM events WHERE organiser_id=? ORDER BY created_at DESC', [organiserId], (e2, events) => {
      if (e2) return next(e2);
      const published = events.filter(e => e.state === 'published');
      const drafts = events.filter(e => e.state === 'draft');
      res.render('organiser-home', { settings, events, published, drafts, flash: req.flash() });
    });
  });
});

// ─── Organiser Settings Page ─────────────────────────
router.get('/settings', ensureOrganiserOrAdmin, (req, res, next) => {
  const organiserId = req.session.user?.id || req.session.admin?.id;
  db.get('SELECT * FROM site_settings WHERE organiser_id=?', [organiserId], (err, settings) => {
    if (err) return next(err);
    res.render('organiser-settings', { settings, errors: [] });
  });
});

// ─── Save Settings ───────────────────────────────────
router.post('/settings', ensureOrganiserOrAdmin, (req, res, next) => {
  const organiserId = req.session.user?.id || req.session.admin?.id;
  const { name, description } = req.body;
  const errors = [];

  if (!name) errors.push('Site name is required');
  if (!description) errors.push('Description is required');

  if (errors.length) {
    return res.render('organiser-settings', { settings: { name, description }, errors });
  }

  db.run('UPDATE site_settings SET name=?, description=? WHERE organiser_id=?',
    [name, description, organiserId],
    err => {
      if (err) return next(err);
      req.flash('success', 'Settings updated');
      res.redirect('/organiser');
    }
  );
});

// ─── Create New Event ────────────────────────────────
router.post('/events/create', ensureOrganiserOrAdmin, (req, res, next) => {
  const organiserId = req.session.user?.id || req.session.admin?.id;
  db.run(
    `INSERT INTO events (organiser_id, title, state, created_at, last_modified)
     VALUES (?, 'Untitled Event', 'draft', datetime('now'), datetime('now'))`,
    [organiserId],
    function (err) {
      if (err) return next(err);
      res.redirect(`/organiser/events/${this.lastID}/edit`);
    }
  );
});

// ─── Edit Event Page ─────────────────────────────────
router.get('/events/:id/edit', ensureOrganiserOrAdmin, (req, res, next) => {
  const organiserId = req.session.user?.id || req.session.admin?.id;
  const eventId = req.params.id;

  db.get('SELECT * FROM events WHERE id=? AND organiser_id=?', [eventId, organiserId], (err, event) => {
    if (err) return next(err);
    if (!event) return res.status(404).render('404');
    db.all('SELECT * FROM tickets WHERE event_id=?', [eventId], (err2, tickets) => {
      if (err2) return next(err2);
      res.render('edit-event', { event, tickets, errors: [] });
    });
  });
});

// ─── Save Event Changes ──────────────────────────────
router.post('/events/:id/edit', ensureOrganiserOrAdmin, (req, res, next) => {
  const organiserId = req.session.user?.id || req.session.admin?.id;
  const eventId = req.params.id;
  const { title, description, event_date, tickets = {} } = req.body;

  const errors = [];
  if (!title) errors.push('Title is required');
  if (!event_date) errors.push('Event date is required');

  if (errors.length) {
    db.get('SELECT * FROM events WHERE id=? AND organiser_id=?', [eventId, organiserId], (err, event) => {
      if (err) return next(err);
      db.all('SELECT * FROM tickets WHERE event_id=?', [eventId], (err2, tickets) => {
        if (err2) return next(err2);
        return res.render('edit-event', { event, tickets, errors });
      });
    });
  } else {
    db.run(
      `UPDATE events SET title=?, description=?, event_date=?, last_modified=datetime('now') 
       WHERE id=? AND organiser_id=?`,
      [title, description, event_date, eventId, organiserId],
      err => {
        if (err) return next(err);

        // Remove old tickets
        db.run('DELETE FROM tickets WHERE event_id=?', [eventId], err2 => {
          if (err2) return next(err2);

          const ticketArray = Object.values(tickets);
          const stmt = db.prepare('INSERT INTO tickets (event_id, type, price, quantity) VALUES (?, ?, ?, ?)');

          for (const t of ticketArray) {
            if (!t.type || !t.price || !t.quantity) continue;
            stmt.run(eventId, t.type, t.price, t.quantity);
          }

          stmt.finalize(err3 => {
            if (err3) return next(err3);
            res.redirect(`/organiser/events/${eventId}/edit`);
          });
        });
      }
    );
  }
});

// ─── Publish Event ───────────────────────────────────
router.post('/events/:id/publish', ensureOrganiserOrAdmin, (req, res, next) => {
  const organiserId = req.session.user?.id || req.session.admin?.id;
  const eventId = req.params.id;

  db.run(
    `UPDATE events SET state='published', published_at=datetime('now')
     WHERE id=? AND organiser_id=?`,
    [eventId, organiserId],
    err => {
      if (err) return next(err);
      res.json({ success: true });
    }
  );
});


// ─── Delete Event ───────────────────────────────────
router.delete('/events/:id', ensureOrganiserOrAdmin, (req, res, next) => {
  const organiserId = req.session.user?.id || req.session.admin?.id;
  const eventId = req.params.id;

  db.run('DELETE FROM events WHERE id=? AND organiser_id=?', [eventId, organiserId], err => {
    if (err) return next(err);
    res.json({ success: true });
  });
});

// ─── View Bookings ───────────────────────────────────
router.get('/bookings', ensureOrganiserOrAdmin, (req, res, next) => {
  const organiserId = req.session.user?.id || req.session.admin?.id;

  const query = `
    SELECT b.id, e.title as event_title, b.buyer_name, b.qty, b.total_amount, b.payment_status, b.booked_at
    FROM bookings b
    JOIN events e ON b.event_id = e.id
    WHERE e.organiser_id = ?
    ORDER BY b.booked_at DESC
  `;

  db.all(query, [organiserId], (err, bookings) => {
    if (err) return next(err);
    res.render('organiser-bookings', { bookings });
  });
});

module.exports = router;
