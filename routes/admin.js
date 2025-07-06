// routes/admin.js - Admin routes with full platform control
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = global.db;

// GET /admin - Admin dashboard
router.get('/', (req, res, next) => {
  // Get platform statistics
  const stats = {};
  let pending = 6;

  // Total organisers
  db.get('SELECT COUNT(*) as count FROM organisers', (err, result) => {
    if (err) return next(err);
    stats.totalOrganisers = result.count;
    if (--pending === 0) renderDashboard();
  });

  // Total events
  db.get('SELECT COUNT(*) as count FROM events', (err, result) => {
    if (err) return next(err);
    stats.totalEvents = result.count;
    if (--pending === 0) renderDashboard();
  });

  // Total bookings
  db.get('SELECT COUNT(*) as count FROM bookings WHERE payment_status = "completed"', (err, result) => {
    if (err) return next(err);
    stats.totalBookings = result.count;
    if (--pending === 0) renderDashboard();
  });

  // Total revenue
  db.get('SELECT SUM(total_amount) as total FROM bookings WHERE payment_status = "completed"', (err, result) => {
    if (err) return next(err);
    stats.totalRevenue = result.total || 0;
    if (--pending === 0) renderDashboard();
  });

  // Recent activity
  db.all(
    `SELECT 'booking' as type, b.buyer_name as name, b.booked_at as date, e.title as detail
     FROM bookings b
     JOIN events e ON e.id = b.event_id
     ORDER BY b.booked_at DESC
     LIMIT 10`,
    (err, bookings) => {
      if (err) return next(err);
      stats.recentActivity = bookings;
      if (--pending === 0) renderDashboard();
    }
  );

  // Revenue by month
  db.all(
    `SELECT strftime('%Y-%m', booked_at) as month,
            SUM(total_amount) as revenue
     FROM bookings
     WHERE payment_status = 'completed'
     GROUP BY month
     ORDER BY month DESC
     LIMIT 12`,
    (err, revenue) => {
      if (err) return next(err);
      stats.monthlyRevenue = revenue;
      if (--pending === 0) renderDashboard();
    }
  );

  function renderDashboard() {
    res.render('admin/dashboard', {
      stats,
      theme: req.session.theme || 'light'
    });
  }
});

// GET /admin/organisers - Manage organisers
router.get('/organisers', (req, res, next) => {
  db.all(
    `SELECT o.*, 
            COUNT(DISTINCT e.id) as event_count,
            COUNT(DISTINCT b.id) as booking_count,
            COALESCE(SUM(b.total_amount), 0) as total_revenue
     FROM organisers o
     LEFT JOIN events e ON e.organiser_id = o.id
     LEFT JOIN bookings b ON b.event_id = e.id AND b.payment_status = 'completed'
     GROUP BY o.id
     ORDER BY o.created_at DESC`,
    (err, organisers) => {
      if (err) return next(err);
      res.render('admin/organisers', {
        organisers,
        theme: req.session.theme || 'light'
      });
    }
  );
});

// POST /admin/organisers/:id/toggle - Enable/disable organiser
router.post('/organisers/:id/toggle', (req, res, next) => {
  const organiserId = req.params.id;
  
  db.get('SELECT is_active FROM organisers WHERE id = ?', [organiserId], (err, organiser) => {
    if (err) return next(err);
    if (!organiser) return res.status(404).json({ error: 'Organiser not found' });

    const newStatus = organiser.is_active ? 0 : 1;
    
    db.run(
      'UPDATE organisers SET is_active = ? WHERE id = ?',
      [newStatus, organiserId],
      (err) => {
        if (err) return next(err);
        res.json({ success: true, is_active: newStatus });
      }
    );
  });
});

// GET /admin/events - View all events
router.get('/events', (req, res, next) => {
  db.all(
    `SELECT e.*, o.username as organiser_name, o.organisation,
            COUNT(DISTINCT b.id) as booking_count,
            COALESCE(SUM(b.total_amount), 0) as revenue
     FROM events e
     JOIN organisers o ON o.id = e.organiser_id
     LEFT JOIN bookings b ON b.event_id = e.id AND b.payment_status = 'completed'
     GROUP BY e.id
     ORDER BY e.created_at DESC`,
    (err, events) => {
      if (err) return next(err);
      res.render('admin/events', {
        events,
        theme: req.session.theme || 'light'
      });
    }
  );
});

// GET /admin/bookings - View all bookings
router.get('/bookings', (req, res, next) => {
  db.all(
    `SELECT b.*, e.title as event_title, o.username as organiser_name,
            t.type as ticket_type
     FROM bookings b
     JOIN events e ON e.id = b.event_id
     JOIN organisers o ON o.id = e.organiser_id
     JOIN tickets t ON t.id = b.ticket_id
     ORDER BY b.booked_at DESC`,
    (err, bookings) => {
      if (err) return next(err);
      res.render('admin/bookings', {
        bookings,
        theme: req.session.theme || 'light'
      });
    }
  );
});

// GET /admin/settings - Platform settings
router.get('/settings', (req, res, next) => {
  db.get('SELECT * FROM site_settings WHERE id = 1', (err, settings) => {
    if (err) return next(err);
    res.render('admin/settings', {
      settings,
      errors: [],
      theme: req.session.theme || 'light'
    });
  });
});

// POST /admin/settings - Update platform settings
router.post('/settings', (req, res, next) => {
  const { name, description } = req.body;
  const errors = [];

  if (!name) errors.push('Platform name is required');
  if (!description) errors.push('Platform description is required');

  if (errors.length) {
    return res.render('admin/settings', {
      settings: { name, description },
      errors,
      theme: req.session.theme || 'light'
    });
  }

  db.run(
    'UPDATE site_settings SET name = ?, description = ? WHERE id = 1',
    [name.trim(), description.trim()],
    (err) => {
      if (err) return next(err);
      req.flash('success', 'Platform settings updated successfully');
      res.redirect('/admin');
    }
  );
});

// GET /admin/admins - Manage admin users
router.get('/admins', (req, res, next) => {
  db.all('SELECT id, username, email, created_at FROM admins', (err, admins) => {
    if (err) return next(err);
    res.render('admin/admins', {
      admins,
      theme: req.session.theme || 'light'
    });
  });
});

// POST /admin/admins/new - Create new admin
router.post('/admins/new', async (req, res, next) => {
  const { username, email, password } = req.body;
  
  if (!username || !email || !password) {
    req.flash('error', 'All fields are required');
    return res.redirect('/admin/admins');
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    db.run(
      'INSERT INTO admins (username, email, password) VALUES (?, ?, ?)',
      [username, email, hashedPassword],
      (err) => {
        if (err) {
          if (err.message.includes('UNIQUE')) {
            req.flash('error', 'Username or email already exists');
          } else {
            req.flash('error', 'Failed to create admin');
          }
          return res.redirect('/admin/admins');
        }
        
        req.flash('success', 'Admin user created successfully');
        res.redirect('/admin/admins');
      }
    );
  } catch (error) {
    console.error(error);
    req.flash('error', 'An error occurred');
    res.redirect('/admin/admins');
  }
});

// DELETE /admin/admins/:id - Delete admin
router.delete('/admins/:id', (req, res, next) => {
  const adminId = req.params.id;
  
  // Prevent self-deletion
  if (adminId == req.session.user.id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }
  
  db.run('DELETE FROM admins WHERE id = ?', [adminId], (err) => {
    if (err) return next(err);
    res.json({ success: true });
  });
});

// GET /admin/analytics - Platform analytics
router.get('/analytics', (req, res, next) => {
  // Get comprehensive platform analytics
  const analytics = {};
  let pending = 5;

  // User growth
  db.all(
    `SELECT strftime('%Y-%m', created_at) as month,
            COUNT(*) as new_organisers
     FROM organisers
     GROUP BY month
     ORDER BY month DESC
     LIMIT 12`,
    (err, growth) => {
      if (err) return next(err);
      analytics.userGrowth = growth;
      if (--pending === 0) renderAnalytics();
    }
  );

  // Revenue by organiser
  db.all(
    `SELECT o.organisation,
            COUNT(DISTINCT e.id) as events,
            SUM(b.total_amount) as revenue
     FROM organisers o
     LEFT JOIN events e ON e.organiser_id = o.id
     LEFT JOIN bookings b ON b.event_id = e.id AND b.payment_status = 'completed'
     GROUP BY o.id
     ORDER BY revenue DESC
     LIMIT 10`,
    (err, topOrganisers) => {
      if (err) return next(err);
      analytics.topOrganisers = topOrganisers;
      if (--pending === 0) renderAnalytics();
    }
  );

  // Event type distribution
  db.all(
    `SELECT t.type,
            COUNT(DISTINCT b.id) as bookings,
            SUM(b.qty) as tickets_sold
     FROM tickets t
     JOIN bookings b ON b.ticket_id = t.id
     WHERE b.payment_status = 'completed'
     GROUP BY t.type
     ORDER BY tickets_sold DESC`,
    (err, ticketTypes) => {
      if (err) return next(err);
      analytics.ticketTypes = ticketTypes;
      if (--pending === 0) renderAnalytics();
    }
  );

  // Daily revenue (last 30 days)
  db.all(
    `SELECT DATE(booked_at) as date,
            COUNT(*) as bookings,
            SUM(total_amount) as revenue
     FROM bookings
     WHERE payment_status = 'completed'
       AND booked_at >= date('now', '-30 days')
     GROUP BY date
     ORDER BY date`,
    (err, dailyRevenue) => {
      if (err) return next(err);
      analytics.dailyRevenue = dailyRevenue;
      if (--pending === 0) renderAnalytics();
    }
  );

  // Platform totals
  db.get(
    `SELECT 
       (SELECT COUNT(*) FROM organisers WHERE is_active = 1) as active_organisers,
       (SELECT COUNT(*) FROM events WHERE state = 'published') as active_events,
       (SELECT COUNT(*) FROM bookings WHERE booked_at >= date('now', '-30 days')) as recent_bookings,
       (SELECT SUM(total_amount) FROM bookings WHERE payment_status = 'completed' AND booked_at >= date('now', '-30 days')) as recent_revenue`,
    (err, totals) => {
      if (err) return next(err);
      analytics.totals = totals;
      if (--pending === 0) renderAnalytics();
    }
  );

  function renderAnalytics() {
    res.render('admin/analytics', {
      analytics,
      theme: req.session.theme || 'light'
    });
  }
});

module.exports = router;