// routes/organiser.js
// Enhanced organiser routes with all required functionality

const express = require('express');
const router = express.Router();
const db = global.db;
const { body, validationResult } = require('express-validator');

/**
 * Load site settings (single row id=1)
 * @param {Function} cb - Callback function (err, settings)
 */
function loadSettings(cb) {
  db.get(
    'SELECT name, description FROM site_settings WHERE id = 1',
    cb
  );
}

/**
 * Load events by state with ticket information
 * @param {string} state - 'draft' or 'published'
 * @param {Function} cb - Callback function (err, events[])
 */
function loadEventsByState(state, cb) {
  db.all(
    `SELECT e.*,
            COALESCE(SUM(t.quantity), 0) AS total_qty,
            COUNT(DISTINCT t.type) AS ticket_types
     FROM events e
     LEFT JOIN tickets t ON t.event_id = e.id
     WHERE e.state = ?
     GROUP BY e.id
     ORDER BY 
       CASE ? 
         WHEN 'published' THEN datetime(e.event_date)
         ELSE datetime(e.created_at) 
       END ASC`,
    [state, state],
    cb
  );
}

/**
 * GET /organiser - Organiser dashboard/home page
 * Displays published and draft events with management options
 */
router.get('/', (req, res, next) => {
  loadSettings((err1, settings) => {
    if (err1) return next(err1);

    let published, drafts, pending = 2;
    
    function checkComplete() {
      if (--pending === 0) {
        res.render('organiser-home', { settings, published, drafts });
      }
    }

    loadEventsByState('published', (err2, rows1) => {
      if (err2) return next(err2);
      published = rows1;
      checkComplete();
    });

    loadEventsByState('draft', (err3, rows2) => {
      if (err3) return next(err3);
      drafts = rows2;
      checkComplete();
    });
  });
});

/**
 * GET /organiser/settings - Site settings page
 * Displays form for editing site name and description
 */
router.get('/settings', (req, res, next) => {
  loadSettings((err, settings) => {
    if (err) return next(err);
    res.render('site-settings', { settings, errors: [] });
  });
});

/**
 * POST /organiser/settings - Update site settings
 * Updates site name and description with validation
 */
router.post('/settings', [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('description').trim().notEmpty().withMessage('Description is required')
], (req, res, next) => {
  const errors = validationResult(req);
  const { name, description } = req.body;

  if (!errors.isEmpty()) {
    return res.render('site-settings', {
      settings: { name, description },
      errors: errors.array().map(e => e.msg)
    });
  }

  db.run(
    'UPDATE site_settings SET name = ?, description = ? WHERE id = 1',
    [name.trim(), description.trim()],
    (err) => {
      if (err) return next(err);
      res.redirect('/organiser');
    }
  );
});

/**
 * POST /organiser/events/new - Create new draft event
 * Creates a new event in draft state and returns JSON with event ID
 */
router.post('/events/new', (req, res, next) => {
  db.run(
    "INSERT INTO events (state) VALUES ('draft')",
    function(err) {
      if (err) return next(err);
      res.json({ success: true, id: this.lastID });
    }
  );
});

/**
 * GET /organiser/events/:id/edit - Event edit page
 * Displays form for editing event details and ticket information
 */
router.get('/events/:id/edit', (req, res, next) => {
  const eventId = req.params.id;
  
  db.get(
    'SELECT * FROM events WHERE id = ?',
    [eventId],
    (err, event) => {
      if (err) return next(err);
      if (!event) return res.status(404).render('404');

      db.all(
        'SELECT id, type, price, quantity FROM tickets WHERE event_id = ? ORDER BY type',
        [eventId],
        (err2, tickets) => {
          if (err2) return next(err2);
          res.render('edit-event', { event, tickets, errors: [] });
        }
      );
    }
  );
});

/**
 * POST /organiser/events/:id/edit - Update event
 * Updates event details and ticket information with validation
 */
router.post('/events/:id/edit', [
  body('title').trim().notEmpty().withMessage('Event title is required'),
  body('description').trim().notEmpty().withMessage('Event description is required'),
  body('event_date').notEmpty().withMessage('Event date is required'),
  body('tickets.*.quantity').isInt({ min: 0 }).withMessage('Ticket quantity must be 0 or greater'),
  body('tickets.*.price').isFloat({ min: 0 }).withMessage('Ticket price must be 0 or greater')
], (req, res, next) => {
  const eventId = req.params.id;
  const errors = validationResult(req);
  const { title, description, event_date } = req.body;

  // Process ticket data
  const ticketData = {};
  Object.entries(req.body).forEach(([key, value]) => {
    const match = key.match(/tickets\[(.+?)\]\[(.+?)\]/);
    if (match) {
      const [, type, field] = match;
      if (!ticketData[type]) ticketData[type] = {};
      ticketData[type][field] = value;
    }
  });

  // Additional validation
  const validationErrors = [];
  if (!errors.isEmpty()) {
    validationErrors.push(...errors.array().map(e => e.msg));
  }

  Object.entries(ticketData).forEach(([type, data]) => {
    if (data.quantity < 0) validationErrors.push(`${type} quantity cannot be negative`);
    if (data.price < 0) validationErrors.push(`${type} price cannot be negative`);
  });

  if (validationErrors.length > 0) {
    // Reload event and tickets for form repopulation
    return db.get('SELECT * FROM events WHERE id = ?', [eventId], (err, event) => {
      if (err) return next(err);
      const mockTickets = Object.entries(ticketData).map(([type, data]) => ({
        type, quantity: data.quantity || 0, price: data.price || 0
      }));
      res.render('edit-event', {
        event: { ...event, title, description, event_date },
        tickets: mockTickets,
        errors: validationErrors
      });
    });
  }

  // Update event and tickets in transaction
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    // Update event details
    db.run(
      `UPDATE events 
       SET title = ?, description = ?, event_date = ?, last_modified = datetime('now')
       WHERE id = ?`,
      [title.trim(), description.trim(), event_date, eventId],
      (err) => {
        if (err) {
          db.run('ROLLBACK');
          return next(err);
        }
      }
    );

    // Update ticket information
    Object.entries(ticketData).forEach(([type, data]) => {
      db.get(
        'SELECT id FROM tickets WHERE event_id = ? AND type = ?',
        [eventId, type],
        (err, existingTicket) => {
          if (err) {
            db.run('ROLLBACK');
            return next(err);
          }

          if (existingTicket) {
            // Update existing ticket
            db.run(
              'UPDATE tickets SET quantity = ?, price = ? WHERE id = ?',
              [data.quantity, data.price, existingTicket.id]
            );
          } else {
            // Insert new ticket type
            db.run(
              'INSERT INTO tickets (event_id, type, quantity, price) VALUES (?, ?, ?, ?)',
              [eventId, type, data.quantity, data.price]
            );
          }
        }
      );
    });

    db.run('COMMIT', (err) => {
      if (err) return next(err);
      res.redirect('/organiser');
    });
  });
});

/**
 * POST /organiser/events/:id/publish - Publish event
 * Changes event state from draft to published and sets publication timestamp
 */
router.post('/events/:id/publish', (req, res, next) => {
  db.run(
    `UPDATE events 
     SET state = 'published', published_at = datetime('now')
     WHERE id = ?`,
    [req.params.id],
    (err) => {
      if (err) return next(err);
      res.json({ success: true });
    }
  );
});

/**
 * DELETE /organiser/events/:id - Delete event
 * Removes event and all associated tickets and bookings
 */
router.delete('/events/:id', (req, res, next) => {
  db.run(
    'DELETE FROM events WHERE id = ?',
    [req.params.id],
    (err) => {
      if (err) return next(err);
      res.json({ success: true });
    }
  );
});

/**
 * GET /organiser/bookings - View all bookings
 * Displays comprehensive list of all bookings across all events
 */
router.get('/bookings', (req, res, next) => {
  db.all(
    `SELECT b.id, b.buyer_name, b.qty, b.booked_at,
            e.title AS event_title,
            e.event_date,
            t.type AS ticket_type,
            t.price AS ticket_price,
            (b.qty * t.price) AS total_cost
     FROM bookings b
     JOIN events e ON e.id = b.event_id
     JOIN tickets t ON t.id = b.ticket_id
     ORDER BY datetime(b.booked_at) DESC`,
    (err, bookings) => {
      if (err) return next(err);
      res.render('all-bookings', { bookings });
    }
  );
});

/**
 * GET /organiser/analytics - Analytics dashboard
 * Provides booking statistics and revenue metrics
 */
router.get('/analytics', (req, res, next) => {
  // Get booking data for charts
  db.all(
    `SELECT t.type AS label, 
            SUM(b.qty) AS tickets_sold,
            SUM(b.qty * t.price) AS revenue
     FROM bookings b
     JOIN tickets t ON t.id = b.ticket_id
     GROUP BY t.type`,
    (err, ticketStats) => {
      if (err) return next(err);

      // Get event performance data
      db.all(
        `SELECT e.title AS event_name,
                COUNT(b.id) AS total_bookings,
                SUM(b.qty) AS tickets_sold,
                SUM(b.qty * t.price) AS revenue
         FROM events e
         LEFT JOIN bookings b ON b.event_id = e.id
         LEFT JOIN tickets t ON t.id = b.ticket_id
         WHERE e.state = 'published'
         GROUP BY e.id, e.title
         ORDER BY revenue DESC`,
        (err2, eventStats) => {
          if (err2) return next(err2);

          res.render('organiser-analytics', {
            ticketStats: ticketStats || [],
            eventStats: eventStats || []
          });
        }
      );
    }
  );
});

module.exports = router;