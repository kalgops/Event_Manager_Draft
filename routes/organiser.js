// routes/organiser.js
// ----------------------------------------------------------
// All organiser endpoints: dashboard, settings, CRUD,
// publishing, bookings list and dashboard metrics.
// ----------------------------------------------------------

const express    = require('express');
const router     = express.Router();
const db         = global.db;

/**
 * Load site settings (single row id=1).
 * @param cb(err, settings)
 */
function loadSettings(cb) {
  db.get(
    'SELECT name, description FROM site_settings WHERE id = 1',
    cb
  );
}

/**
 * Load events (draft/published) with total remaining tickets.
 * @param state 'draft' or 'published'
 * @param cb(err, rows[])
 */
function loadEventsByState(state, cb) {
  db.all(
    `
    SELECT e.*,
           COALESCE(SUM(t.quantity),0) AS total_qty
    FROM events e
    LEFT JOIN tickets t ON t.event_id = e.id
    WHERE e.state = ?
    GROUP BY e.id
    ORDER BY
      CASE ? WHEN 'published' THEN datetime(e.event_date)
             ELSE datetime(e.created_at) END ASC
    `,
    [state, state],
    cb
  );
}

// GET /organiser — dashboard
router.get('/', (req, res, next) => {
  loadSettings((err1, settings) => {
    if (err1) return next(err1);

    let published, drafts, pending = 2;
    loadEventsByState('published', (err2, rows1) => {
      if (err2) return next(err2);
      published = rows1;
      if (--pending === 0) res.render('organiser-home', { settings, published, drafts });
    });
    loadEventsByState('draft', (err3, rows2) => {
      if (err3) return next(err3);
      drafts = rows2;
      if (--pending === 0) res.render('organiser-home', { settings, published, drafts });
    });
  });
});

// GET /organiser/settings
router.get('/settings', (req, res, next) => {
  loadSettings((err, settings) => {
    if (err) return next(err);
    res.render('site-settings', { settings, errors: [] });
  });
});

// POST /organiser/settings
router.post('/settings', (req, res, next) => {
  const { name, description } = req.body;
  const errors = [];
  if (!name)        errors.push('Name required');
  if (!description) errors.push('Description required');
  if (errors.length) {
    return res.render('site-settings', { settings:{ name, description }, errors });
  }
  db.run(
    'UPDATE site_settings SET name=?, description=? WHERE id=1',
    [name.trim(), description.trim()],
    err => err ? next(err) : res.redirect('/organiser')
  );
});

// POST /organiser/events/new
router.post('/events/new', (req, res, next) => {
  db.run("INSERT INTO events(state) VALUES('draft')", function(err) {
    if (err) return next(err);
    res.json({ success: true, id: this.lastID });
  });
});

// GET /organiser/events/:id/edit
router.get('/events/:id/edit', (req, res, next) => {
  const eventId = req.params.id;
  db.get('SELECT * FROM events WHERE id = ?', [eventId], (err, event) => {
    if (err) return next(err);
    if (!event) return res.status(404).render('404');
    db.all(
      'SELECT id, type, price, quantity FROM tickets WHERE event_id = ?',
      [eventId],
      (err2, tickets) => {
        if (err2) return next(err2);
        res.render('edit-event', { event, tickets, errors: [] });
      }
    );
  });
});

// POST /organiser/events/:id/edit
router.post('/events/:id/edit', (req, res, next) => {
  const eid = req.params.id;
  const { title, description, event_date } = req.body;
  const errors = [];

  if (!title?.trim())       errors.push('Title required');
  if (!description?.trim()) errors.push('Description required');
  if (!event_date)          errors.push('Date required');

  // Collect dynamic ticket inputs
  const ticketData = {};
  Object.entries(req.body)
    .filter(([k]) => k.startsWith('tickets['))
    .forEach(([key, val]) => {
      const [, type, field] = key.match(/tickets\[(.+?)\]\[(.+?)\]/);
      ticketData[type] ??= { quantity: 0, price: 0 };
      ticketData[type][field] = val;
    });

  // Validate ticket entries
  Object.entries(ticketData).forEach(([type, t]) => {
    if (!type.trim()) errors.push('Ticket type name cannot be blank.');
    if (t.quantity < 0) errors.push(`Quantity for ${type} must be >= 0`);
    if (t.price < 0)    errors.push(`Price for ${type} must be >= 0`);
  });

  if (errors.length) {
    return res.render('edit-event', {
      event:   { id: eid, title, description, event_date, created_at:'', last_modified:'' },
      tickets: Object.entries(ticketData).map(([type,t])=>({
                  type, quantity: t.quantity, price: t.price
                })),
      errors
    });
  }

  // Persist changes inside a transaction
  db.serialize(() => {
    db.run(
      `UPDATE events
         SET title=?, description=?, event_date=?, last_modified=datetime('now')
       WHERE id=?`,
      [title.trim(), description.trim(), event_date, eid]
    );

    Object.entries(ticketData).forEach(([type,t]) => {
      db.get(
        'SELECT id FROM tickets WHERE event_id=? AND type=?',
        [eid, type],
        (e,r) => {
          if (e) return next(e);
          if (r) {
            db.run(
              'UPDATE tickets SET quantity=?,price=? WHERE id=?',
              [t.quantity, t.price, r.id]
            );
          } else {
            db.run(
              'INSERT INTO tickets(event_id,type,quantity,price) VALUES(?,?,?,?)',
              [eid, type, t.quantity, t.price]
            );
          }
        }
      );
    });
  });

  res.redirect('/organiser');
});

// POST /organiser/events/:id/publish
router.post('/events/:id/publish', (req, res, next) => {
  db.run(
    "UPDATE events SET state='published',published_at=datetime('now') WHERE id=?",
    [req.params.id],
    err => err ? next(err) : res.json({ success: true })
  );
});

// DELETE /organiser/events/:id
router.delete('/events/:id', (req, res, next) => {
  db.run('DELETE FROM events WHERE id=?', [req.params.id], err =>
    err ? next(err) : res.json({ success: true })
  );
});

// GET /organiser/bookings
router.get('/bookings', (req, res, next) => {
  db.all(
    `SELECT b.id, b.buyer_name, b.qty, b.booked_at,
            e.title AS event_title,
            t.type  AS ticket_type
       FROM bookings b
       JOIN events  e ON e.id = b.event_id
       JOIN tickets t ON t.id = b.ticket_id
      ORDER BY datetime(b.booked_at) DESC`,
    (err, bookings) => err ? next(err) : res.render('all-bookings', { bookings })
  );
});

// GET /organiser/dashboard
router.get('/dashboard', (req, res, next) => {
  db.all(
    `SELECT t.type AS label, SUM(b.qty) AS total
       FROM bookings b
       JOIN tickets t ON t.id = b.ticket_id
      GROUP BY t.type`,
    (err, rows) => {
      if (err) return next(err);
      res.render('organiser-dashboard', {
        labels: rows.map(r=>r.label),
        dataPoints: rows.map(r=>r.total)
      });
    }
  );
});

module.exports = router;
// End of file: routes/organiser.js
// This file contains all organiser-related routes for managing events, settings, bookings, and dashboard metrics
// It includes functions to load site settings and events by state, as well as CRUD operations for events and tickets
// The routes handle rendering views, processing form submissions, and returning JSON responses for AJAX requests
// The code is structured to handle errors gracefully and render appropriate views or JSON responses based
// on the success or failure of database operations