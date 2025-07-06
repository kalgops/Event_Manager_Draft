// routes/organiser.js
const express = require('express');
const router = express.Router();
const db = global.db;

// GET /organiser - Organiser Home Page
router.get('/', (req, res, next) => {
  db.get('SELECT name, description FROM site_settings', (err, settings) => {
    if (err) return next(err);

    db.all('SELECT * FROM events WHERE state = "published"', (e2, published) => {
      if (e2) return next(e2);
      db.all('SELECT * FROM events WHERE state = "draft"', (e3, drafts) => {
        if (e3) return next(e3);
        res.render('organiser_home', { settings, published, drafts });
      });
    });
  });
});

// GET /organiser/settings
router.get('/settings', (req, res, next) => {
  db.get('SELECT name, description FROM site_settings', (err, row) => {
    if (err) return next(err);
    res.render('organiser_settings', { settings: row });
  });
});

// POST /organiser/settings
router.post('/settings', (req, res, next) => {
  const { name, description } = req.body;
  if (!name || !description) {
    req.flash('error', 'All fields are required');
    return res.redirect('/organiser/settings');
  }

  db.run(
    'UPDATE site_settings SET name = ?, description = ? WHERE id = 1',
    [name, description],
    err => {
      if (err) return next(err);
      req.flash('success', 'Settings updated.');
      res.redirect('/organiser');
    }
  );
});

// POST /organiser/events/create - Create a new draft event
router.post('/events/create', (req, res, next) => {
  const now = new Date().toISOString();
  db.run(
    `INSERT INTO events (title, description, event_date, created_at, last_modified, state)
     VALUES (?, ?, ?, ?, ?, ?)`,
    ['Untitled Event', '', now, now, now, 'draft'],
    function (err) {
      if (err) return next(err);
      res.redirect(`/organiser/events/${this.lastID}/edit`);
    }
  );
});

// GET /organiser/events/:id/edit - Edit form
router.get('/events/:id/edit', (req, res, next) => {
  const id = req.params.id;
  db.get('SELECT * FROM events WHERE id = ?', [id], (err, event) => {
    if (err) return next(err);
    if (!event) return res.status(404).render('404');
    db.all('SELECT * FROM tickets WHERE event_id = ?', [id], (e2, tickets) => {
      if (e2) return next(e2);
      res.render('organiser_edit_event', { event, tickets });
    });
  });
});

// POST /organiser/events/:id/edit - Save event edits
router.post('/events/:id/edit', (req, res, next) => {
  const id = req.params.id;
  const { title, description, event_date, full_price, full_qty, concession_price, concession_qty } = req.body;
  const updatedAt = new Date().toISOString();

  db.serialize(() => {
    db.run(
      `UPDATE events SET title = ?, description = ?, event_date = ?, last_modified = ? WHERE id = ?`,
      [title, description, event_date, updatedAt, id]
    );

    db.run('DELETE FROM tickets WHERE event_id = ?', [id]);
    db.run(
      `INSERT INTO tickets (event_id, type, price, quantity) VALUES
       (?, 'full-price', ?, ?),
       (?, 'concession', ?, ?)`,
      [id, full_price, full_qty, id, concession_price, concession_qty],
      err => {
        if (err) return next(err);
        req.flash('success', 'Event updated.');
        res.redirect('/organiser');
      }
    );
  });
});

// POST /organiser/events/:id/publish - Mark draft as published
router.post('/events/:id/publish', (req, res, next) => {
  const id = req.params.id;
  const publishedAt = new Date().toISOString();
  db.run(
    `UPDATE events SET state = 'published', published_at = ? WHERE id = ?`,
    [publishedAt, id],
    err => {
      if (err) return next(err);
      req.flash('success', 'Event published.');
      res.redirect('/organiser');
    }
  );
});

// POST /organiser/events/:id/delete - Delete an event
router.post('/events/:id/delete', (req, res, next) => {
  const id = req.params.id;
  db.run('DELETE FROM events WHERE id = ?', [id], err => {
    if (err) return next(err);
    db.run('DELETE FROM tickets WHERE event_id = ?', [id], err2 => {
      if (err2) return next(err2);
      req.flash('success', 'Event deleted.');
      res.redirect('/organiser');
    });
  });
});

module.exports = router;
