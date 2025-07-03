// routes/attendee.js  (replace full file)
const express = require('express');
const router  = express.Router();
const db      = global.db;
const { body, validationResult } = require('express-validator');

/* ─── Attendee home ─────────────────────────────────────── */
router.get('/', (req, res, next) => {
  /* list ALL published events (any organiser) */
  db.all(
    `SELECT e.id, e.title, e.event_date,
            ss.name  AS site_name,
            ss.description AS site_desc
       FROM events e
       JOIN site_settings ss ON ss.organiser_id = e.organiser_id
      WHERE e.state = 'published'
      ORDER BY datetime(e.event_date) ASC`,
    (err, events) => {
      if (err) return next(err);

      /* If there are multiple organisers we just show the first one's
         name/description; you can tweak to group by organiser if desired */
      const settings = events.length
        ? { name: events[0].site_name, description: events[0].site_desc }
        : { name: 'Events', description: 'Browse upcoming events' };

      res.render('attendee-home', {
        settings,
        events,
        booked: !!req.query.booked
      });
    }
  );
});

/* ─── Single event page & booking logic remain unchanged… ── */

module.exports = router;
// ─── Book an event ──────────────────────────────────────── */
router.get('/event/:id', (req, res, next) => {  
  const eventId = req.params.id;
  db.get(
    `SELECT e.*, ss.name AS site_name, ss.description AS site_desc
       FROM events e
       JOIN site_settings ss ON ss.organiser_id = e.organiser_id
      WHERE e.id = ? AND e.state = 'published'`,
    [eventId],
    (err, event) => {
      if (err) return next(err);
      if (!event) return res.status(404).render('404');

      res.render('attendee-event', { event });
    }
  );
});