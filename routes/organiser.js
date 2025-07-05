// routes/organiser.js
// ─────────────────────────────────────────────────────────────────────────
// Per-organiser dashboard, full CRUD, bookings table & metrics dashboard
// ========================================================================

const express = require('express');
const db      = require('../db');           // shared SQLite connection
const router  = express.Router();

// ─── Helper fns ───────────────────────────────────────────────────────────
function loadSettings (orgId, cb) {
  db.get(
    'SELECT name, description FROM site_settings WHERE organiser_id = ?',
    [orgId],
    cb
  );
}

function loadEventsByState (orgId, state, cb) {
  db.all(
    `SELECT e.*,
            COALESCE(SUM(t.quantity),0) AS total_qty
       FROM events e
  LEFT JOIN tickets t ON t.event_id = e.id
      WHERE e.organiser_id = ? AND e.state = ?
      GROUP BY e.id
      ORDER BY
        CASE ? WHEN 'published' THEN datetime(e.event_date)
               ELSE datetime(e.created_at) END ASC`,
    [orgId, state, state],
    cb
  );
}

// ─── Home dashboard (drafts + published) ─────────────────────────────────
router.get('/', (req, res, next) => {
  const orgId = req.session.organiserId;

  let drafts, published, left = 2;
  const maybeRender = () => {
    if (--left === 0) {
      res.render('organiser-home', { settings: res.locals.settings, drafts, published });
    }
  };

  // preload site settings for navbar
  loadSettings(orgId, (e, s) => {
    if (e) return next(e);
    res.locals.settings = s;
    maybeRender();
  });

  loadEventsByState(orgId, 'published', (e1, p) => {
    if (e1) return next(e1);
    published = p;
    maybeRender();
  });

  loadEventsByState(orgId, 'draft', (e2, d) => {
    if (e2) return next(e2);
    drafts = d;
    maybeRender();
  });
});

// ─── Site settings (name + description) ──────────────────────────────────
router
  .route('/settings')
  .get((req, res, next) => {
    loadSettings(req.session.organiserId, (err, settings) =>
      err ? next(err) : res.render('site-settings', { settings, errors: [] })
    );
  })
  .post((req, res, next) => {
    const { name, description } = req.body;
    const errors = [];
    if (!name)        errors.push('Name required');
    if (!description) errors.push('Description required');

    if (errors.length) {
      return res.render('site-settings', { settings: { name, description }, errors });
    }

    db.run(
      `UPDATE site_settings
          SET name = ?, description = ?
        WHERE organiser_id = ?`,
      [name.trim(), description.trim(), req.session.organiserId],
      err => (err ? next(err) : res.redirect('/organiser'))
    );
  });

// ─── Create a brand-new DRAFT event ──────────────────────────────────────
router.post('/events/new', (req, res, next) => {
  db.run(
    `INSERT INTO events (state, organiser_id)
         VALUES ('draft', ?)`,
    [req.session.organiserId],
    function (err) {
      if (err) return next(err);
      res.json({ success: true, id: this.lastID });
    }
  );
});

// ─── Edit form (GET) and save edits (POST) ───────────────────────────────
router
  .route('/events/:id/edit')
  .get((req, res, next) => {
    const { organiserId } = req.session;
    const eid = req.params.id;

    db.get(
      'SELECT * FROM events WHERE id = ? AND organiser_id = ?',
      [eid, organiserId],
      (err, event) => {
        if (err) return next(err);
        if (!event) return res.status(404).render('404');
        db.all(
          'SELECT id,type,price,quantity FROM tickets WHERE event_id = ?',
          [eid],
          (e2, tickets) =>
            e2 ? next(e2) : res.render('edit-event', { event, tickets, errors: [] })
        );
      }
    );
  })
  .post((req, res, next) => {
    const { organiserId }       = req.session;
    const eid                   = req.params.id;
    const { title, description, event_date } = req.body;
    const errors                = [];

    if (!title?.trim())       errors.push('Title required');
    if (!description?.trim()) errors.push('Description required');
    if (!event_date)          errors.push('Date required');

    // parse tickets[][]
    const TD = {};
    for (const [k, v] of Object.entries(req.body)) {
      const m = k.match(/^tickets\[(.+?)\]\[(.+?)\]$/);
      if (!m) continue;
      const [, key, field] = m;
      (TD[key] ||= {})[field] = v;
    }

    if (errors.length) {
      const tickets = Object.entries(TD).map(([key, t]) => ({
        id:       t.id || key,
        type:     t.type     || '',
        price:    +t.price    || 0,
        quantity: +t.quantity || 0
      }));
      return res.render('edit-event', {
        event: { id: eid, title, description, event_date },
        tickets,
        errors
      });
    }

    db.serialize(() => {
      db.run(
        `UPDATE events
            SET title         = ?,
                description   = ?,
                event_date    = ?,
                last_modified = datetime('now')
          WHERE id = ? AND organiser_id = ?`,
        [title.trim(), description.trim(), event_date, eid, organiserId]
      );

      for (const t of Object.values(TD)) {
        const { id, type, price, quantity } = {
          id: t.id, type: t.type, price: +t.price, quantity: +t.quantity
        };
        if (id && /^\d+$/.test(id)) {
          db.run(
            `UPDATE tickets
                SET type = ?, price = ?, quantity = ?
              WHERE id = ? AND event_id = ?`,
            [type, price, quantity, id, eid]
          );
        } else {
          db.run(
            `INSERT INTO tickets (event_id, type, price, quantity)
                 VALUES (?,?,?,?)`,
            [eid, type, price, quantity]
          );
        }
      }
    });

    res.redirect('/organiser');
  });

// ─── Publish / Delete endpoints ──────────────────────────────────────────
router.post('/events/:id/publish', (req, res, next) => {
  db.run(
    `UPDATE events
        SET state        = 'published',
            published_at = datetime('now')
      WHERE id = ?`,
    [req.params.id],
    err => (err ? next(err) : res.json({ success: true }))
  );
});

router.delete('/events/:id', (req, res, next) => {
  db.run(
    `DELETE FROM events
      WHERE id = ? AND organiser_id = ?`,
    [req.params.id, req.session.organiserId],
    err => (err ? next(err) : res.json({ success: true }))
  );
});

// ─── Bookings table & dashboard pie-charts ───────────────────────────────
router.get('/bookings', (req, res, next) => {
  db.all(
    `SELECT b.id, b.buyer_name, b.qty, b.booked_at,
            e.title  AS event_title,
            t.type   AS ticket_type
       FROM bookings b
  JOIN tickets t ON t.id = b.ticket_id
  JOIN events  e ON e.id = b.event_id
      WHERE e.organiser_id = ?
   ORDER BY datetime(b.booked_at) DESC`,
    [req.session.organiserId],
    (err, bookings) => (err ? next(err) : res.render('all-bookings', { bookings }))
  );
});

router.get('/dashboard', (req, res, next) => {
  const orgId = req.session.organiserId;
  db.all(
    `SELECT t.type AS label, SUM(b.qty) AS total
       FROM bookings b
  JOIN tickets t ON t.id = b.ticket_id
  JOIN events  e ON e.id = b.event_id
      WHERE e.organiser_id = ?
      GROUP BY t.type`,
    [orgId],
    (e1, rows1) => {
      if (e1) return next(e1);
      const progLabels = rows1.map(r => r.label);
      const progData   = rows1.map(r => r.total);

      db.all(
        `SELECT state AS label, COUNT(*) AS total
           FROM events
          WHERE organiser_id = ?
          GROUP BY state`,
        [orgId],
        (e2, rows2) => {
          if (e2) return next(e2);
          res.render('organiser-dashboard', {
            progLabels,
            progData,
            evtLabels: rows2.map(r => r.label),
            evtData:   rows2.map(r => r.total)
          });
        }
      );
    }
  );
});

// ─── Fallback 404 ─────────────────────────────────────────────────────────
router.use((req, res) => res.status(404).render('404'));

module.exports = router;
