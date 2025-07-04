// routes/organiser.js  – per-organiser data & full CRUD + dashboard + bookings
const express = require('express');
const router  = express.Router();
const db      = global.db;

// ─── Helpers ──────────────────────────────────────────────────────────────
function loadSettings(orgId, cb) {
  db.get(
    'SELECT name, description FROM site_settings WHERE organiser_id = ?',
    [orgId],
    cb
  );
}
function loadEventsByState(orgId, state, cb) {
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

// ─── Dashboard of events ─────────────────────────────────────────────────
router.get('/', (req, res, next) => {
  const orgId = req.session.organiserId;
  loadSettings(orgId, (err, settings) => {
    if (err) return next(err);
    let drafts, published, left = 2;
    loadEventsByState(orgId, 'published', (e1, p) => {
      if (e1) return next(e1);
      published = p;
      if (--left === 0) res.render('organiser-home', { settings, drafts, published });
    });
    loadEventsByState(orgId, 'draft', (e2, d) => {
      if (e2) return next(e2);
      drafts = d;
      if (--left === 0) res.render('organiser-home', { settings, drafts, published });
    });
  });
});

// ─── Site settings ────────────────────────────────────────────────────────
router.get('/settings', (req, res, next) => {
  loadSettings(req.session.organiserId, (err, settings) =>
    err ? next(err) : res.render('site-settings', { settings, errors: [] })
  );
});
router.post('/settings', (req, res, next) => {
  const { name, description } = req.body, errors = [];
  if (!name) errors.push('Name required');
  if (!description) errors.push('Description required');
  if (errors.length) return res.render('site-settings', { settings:{name,description}, errors });
  db.run(
    `UPDATE site_settings SET name=?, description=? WHERE organiser_id=?`,
    [name.trim(), description.trim(), req.session.organiserId],
    err => err ? next(err) : res.redirect('/organiser')
  );
});

// ─── Create draft ─────────────────────────────────────────────────────────
router.post('/events/new', (req, res, next) => {
  db.run(
    `INSERT INTO events(state,organiser_id) VALUES('draft',?)`,
    [req.session.organiserId],
    function(err) {
      if (err) return next(err);
      res.json({ success:true, id:this.lastID });
    }
  );
});

// ─── Edit form ────────────────────────────────────────────────────────────
router.get('/events/:id/edit', (req, res, next) => {
  const orgId = req.session.organiserId, eid = req.params.id;
  db.get(
    'SELECT * FROM events WHERE id=? AND organiser_id=?',
    [eid, orgId],
    (err, event) => {
      if (err) return next(err);
      if (!event) return res.status(404).render('404');
      db.all(
        'SELECT id,type,price,quantity FROM tickets WHERE event_id=?',
        [eid],
        (e2, tickets) => {
          if (e2) return next(e2);
          res.render('edit-event', { event, tickets, errors:[] });
        }
      );
    }
  );
});

// ─── Save edits + ticket upsert ──────────────────────────────────────────
router.post('/events/:id/edit', (req, res, next) => {
  const orgId = req.session.organiserId, eid = req.params.id;
  const { title, description, event_date } = req.body, errors = [];
  if (!title?.trim()) errors.push('Title required');
  if (!description?.trim()) errors.push('Description required');
  if (!event_date) errors.push('Date required');

  // collect tickets keyed by id or newX
  const TD = {};
  for (let [k,v] of Object.entries(req.body)) {
    let m = k.match(/^tickets\[(.+?)\]\[(.+?)\]$/);
    if (!m) continue;
    let [_, key, field] = m;
    TD[key] = TD[key]||{};
    TD[key][field] = v;
  }

  if (errors.length) {
    // rebuild tickets array for re-render
    const tickets = Object.entries(TD).map(([key,t])=>({
      id: t.id||key, type: t.type||'', price:+t.price||0, quantity:+t.quantity||0
    }));
    return res.render('edit-event',{ event:{id:eid,title,description,event_date}, tickets, errors });
  }

  db.serialize(()=>{
    // update event
    db.run(
      `UPDATE events
          SET title=?, description=?, event_date=?, last_modified=datetime('now')
        WHERE id=? AND organiser_id=?`,
      [title.trim(),description.trim(),event_date,eid,orgId]
    );
    // upsert tickets
    for (let { id, type, price, quantity } of Object.values(TD).map(t=>({
        id:t.id, type:t.type, price:+t.price, quantity:+t.quantity
      }))) {
      if (id && /^\d+$/.test(id)) {
        db.run(
          `UPDATE tickets
              SET type=?, price=?, quantity=?
            WHERE id=? AND event_id=?`,
          [type,price,quantity,id,eid]
        );
      } else {
        db.run(
          `INSERT INTO tickets(event_id,type,price,quantity)
               VALUES(?,?,?,?)`,
          [eid,type,price,quantity]
        );
      }
    }
  });

  res.redirect('/organiser');
});

// ─── Publish / Delete ─────────────────────────────────────────────────────
router.post('/events/:id/publish', (req, res, next) => {
  db.run(
    `UPDATE events SET state='published',published_at=datetime('now') WHERE id=?`,
    [req.params.id],
    err => err ? next(err) : res.json({success:true})
  );
});
router.delete('/events/:id', (req, res, next) => {
  db.run(
    `DELETE FROM events WHERE id=? AND organiser_id=?`,
    [req.params.id, req.session.organiserId],
    err => err ? next(err) : res.json({success:true})
  );
});

// ─── All bookings ─────────────────────────────────────────────────────────
router.get('/bookings', (req, res, next) => {
  const orgId = req.session.organiserId;
  db.all(
    `SELECT b.id,b.buyer_name,b.qty,b.booked_at,
            e.title AS event_title,
            t.type  AS ticket_type
       FROM bookings b
  JOIN tickets t ON t.id=b.ticket_id
  JOIN events  e ON e.id=b.event_id
      WHERE e.organiser_id=?
      ORDER BY datetime(b.booked_at) DESC`,
    [orgId],
    (err, bookings) => err ? next(err) : res.render('all-bookings',{bookings})
  );
});

// ─── Dashboard (pie charts) ───────────────────────────────────────────────
router.get('/dashboard',(req,res,next)=>{
  const orgId = req.session.organiserId;
  db.all(
    `SELECT t.type AS label, SUM(b.qty) AS total
       FROM bookings b
  JOIN tickets t ON t.id=b.ticket_id
  JOIN events  e ON e.id=b.event_id
      WHERE e.organiser_id=?
      GROUP BY t.type`,
    [orgId],
    (e1,rows1)=>{
      if (e1) return next(e1);
      const progLabels = rows1.map(r=>r.label),
            progData   = rows1.map(r=>r.total);
      db.all(
        `SELECT state AS label, COUNT(*) AS total
           FROM events
          WHERE organiser_id=?
          GROUP BY state`,
        [orgId],
        (e2,rows2)=>{
          if (e2) return next(e2);
          const evtLabels = rows2.map(r=>r.label),
                evtData   = rows2.map(r=>r.total);
          res.render('organiser-dashboard',{progLabels,progData,evtLabels,evtData});
        }
      );
    }
  );
});

module.exports = router;
// ─── Catch-all for 404 ────────────────────────────────────────────────────
router.use((req, res) => {
  res.status(404).render('404');
});