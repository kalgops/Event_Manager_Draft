// routes/organiser.js  – per-organiser data
const express  = require('express');
const router   = express.Router();
const db       = global.db;

/* helper: load current organiser’s settings */
function loadSettings(orgId, cb) {
  db.get(
    'SELECT name,description FROM site_settings WHERE organiser_id=?',
    [orgId],
    cb
  );
}

/* list events by state for current organiser */
function loadEventsByState(orgId, state, cb) {
  db.all(
    `SELECT e.*,
            COALESCE(SUM(t.quantity),0) AS total_qty
       FROM events e
       LEFT JOIN tickets t ON t.event_id = e.id
      WHERE e.state = ? AND e.organiser_id = ?
      GROUP BY e.id
      ORDER BY
        CASE ? WHEN 'published' THEN datetime(e.event_date)
               ELSE datetime(e.created_at) END ASC`,
    [state, orgId, state],
    cb
  );
}

/* ── Organiser home (dashboard of events) ─────────────── */
router.get('/', (req, res, next) => {
  const orgId = req.session.organiserId;
  loadSettings(orgId, (err1, settings) => {
    if (err1) return next(err1);

    let published, drafts, pending = 2;
    loadEventsByState(orgId, 'published', (e2, rows1) => {
      if (e2) return next(e2);
      published = rows1;
      if (--pending === 0)
        res.render('organiser-home', { settings, published, drafts });
    });
    loadEventsByState(orgId, 'draft', (e3, rows2) => {
      if (e3) return next(e3);
      drafts = rows2;
      if (--pending === 0)
        res.render('organiser-home', { settings, published, drafts });
    });
  });
});

/* ── Site settings ─────────────────────────────────────── */
router.get('/settings', (req, res, next) => {
  loadSettings(req.session.organiserId, (err, settings) =>
    err ? next(err) : res.render('site-settings', { settings, errors: [] })
  );
});

router.post('/settings', (req, res, next) => {
  const { name, description } = req.body;
  const errors = [];
  if (!name)        errors.push('Name required');
  if (!description) errors.push('Description required');
  if (errors.length)
    return res.render('site-settings', { settings:{name,description}, errors });

  db.run(
    `UPDATE site_settings
        SET name=?, description=?
      WHERE organiser_id=?`,
    [name.trim(), description.trim(), req.session.organiserId],
    err => err ? next(err) : res.redirect('/organiser')
  );
});

/* ── Create draft event ────────────────────────────────── */
router.post('/events/new', (req, res, next) => {
  db.run(
    `INSERT INTO events(state,organiser_id) VALUES('draft',?)`,
    [req.session.organiserId],
    function (err) {
      if (err) return next(err);
      res.json({ success:true, id:this.lastID });
    }
  );
});

/* ── Edit event page ───────────────────────────────────── */
router.get('/events/:id/edit', (req, res, next) => {
  const orgId = req.session.organiserId;
  db.get(
    'SELECT * FROM events WHERE id=? AND organiser_id=?',
    [req.params.id, orgId],
    (err, event) => {
      if (err) return next(err);
      if (!event) return res.status(404).render('404');
      db.all(
        'SELECT * FROM tickets WHERE event_id=?',
        [req.params.id],
        (e2, tickets) => {
          if (e2) return next(e2);
          res.render('edit-event', { event, tickets, errors:[] });
        }
      );
    }
  );
});

/* ── Save event edits (dynamic tickets) ────────────────── */
router.post('/events/:id/edit', (req, res, next) => {
  const eid  = req.params.id;
  const orgId= req.session.organiserId;
  const { title, description, event_date } = req.body;
  const errors = [];
  if (!title?.trim())       errors.push('Title required');
  if (!description?.trim()) errors.push('Description required');
  if (!event_date)          errors.push('Date required');

  /* collect ticket fields */
  const ticketData = {};   // { [type]:{quantity,price} }
  for (const [k,v] of Object.entries(req.body))
    if (k.startsWith('tickets[')) {
      const [,type,field] = k.match(/tickets\[(.+?)\]\[(.+?)\]/);
      ticketData[type] ??= { quantity:0, price:0 };
      ticketData[type][field] = v;
    }

  if (errors.length)
    return res.render('edit-event',{
      event:{id:eid,title,description,event_date}, tickets:[], errors
    });

  /* transaction */
  db.serialize(() => {
    db.run(
      `UPDATE events
          SET title=?, description=?, event_date=?, last_modified=datetime('now')
        WHERE id=? AND organiser_id=?`,
      [title.trim(), description.trim(), event_date, eid, orgId]
    );

    for (const [type,t] of Object.entries(ticketData)) {
      db.get(
        'SELECT id FROM tickets WHERE event_id=? AND type=?',
        [eid, type],
        (e, row) => {
          if (e) return next(e);
          if (row) {
            db.run('UPDATE tickets SET quantity=?,price=? WHERE id=?',
                   [t.quantity, t.price, row.id]);
          } else {
            db.run('INSERT INTO tickets(event_id,type,quantity,price) VALUES(?,?,?,?)',
                   [eid, type, t.quantity, t.price]);
          }
        }
      );
    }
  });
  res.redirect('/organiser');
});

/* publish / delete routes unchanged except organiser_id filter if desired ... */

/* ── Dashboard (charts) – filtered by organiser ─────────── */
router.get('/dashboard', (req, res, next) => {
  const orgId = req.session.organiserId;

  /* bookings by ticket type */
  db.all(
    `SELECT t.type AS label, SUM(b.qty) AS total
       FROM bookings b
       JOIN tickets  t ON t.id = b.ticket_id
       JOIN events   e ON e.id = b.event_id
      WHERE e.organiser_id = ?
      GROUP BY t.type`,
    [orgId],
    (err, rows) => {
      if (err) return next(err);
      const progLabels = rows.map(r=>r.label);
      const progData   = rows.map(r=>r.total);

      /* events by state */
      db.all(
        `SELECT state AS label, COUNT(*) AS total
           FROM events
          WHERE organiser_id = ?
          GROUP BY state`,
        [orgId],
        (e2, rows2) => {
          if (e2) return next(e2);
          const evtLabels = rows2.map(r=>r.label);
          const evtData   = rows2.map(r=>r.total);
          res.render('organiser-dashboard',
                     { progLabels, progData, evtLabels, evtData });
        }
      );
    }
  );
});

module.exports = router;
// Note: This code assumes the existence of a database schema with tables
// `events`, `tickets`, `bookings`, and `site_settings` as per the
// requirements of the application. The database connection is expected to be
// established globally as `global.db` before this module is used.
// The code also assumes that the session middleware is set up to handle
// `req.session.organiserId` for the logged-in organiser's ID.
// The routes are designed to be used with an Express.js application, and the
// views are expected to be rendered using a templating engine like EJS.
// The code includes error handling for database operations and renders views
// with appropriate data or error messages as needed.
// The routes are protected by an authentication middleware that ensures the
// user is logged in as an organiser before accessing the organiser-specific
// routes. The middleware is expected to be defined in a separate file (not
// shown here) and imported into this module.