// auth.js - shared middleware + login routes
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = global.db;

// ───────────────────────────────────────────────
// Middleware to protect organiser/admin pages
function ensureOrganiserOrAdmin(req, res, next) {
  if (req.session?.user || req.session?.admin) return next();
  req.session.returnTo = req.originalUrl;
  return res.redirect('/auth/login');
}

// ───────────────────────────────────────────────
// GET /auth/login
router.get('/login', (req, res) => {
  res.render('login', { errors: [] });
});

// POST /auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  // Try organiser login first
  db.get('SELECT * FROM organisers WHERE username = ?', [username], async (err, user) => {
    if (err) return res.status(500).send('DB error');
    if (user && await bcrypt.compare(password, user.password_hash)) {
      req.session.user = { id: user.id, username: user.username };
      const redirectTo = req.session.returnTo || '/organiser';
      delete req.session.returnTo;
      return res.redirect(redirectTo);
    }

    // Then try admin login
    db.get('SELECT * FROM admins WHERE username = ?', [username], async (err2, admin) => {
      if (err2) return res.status(500).send('DB error');
      if (admin && await bcrypt.compare(password, admin.password)) {
        req.session.admin = { id: admin.id, username: admin.username };
        const redirectTo = req.session.returnTo || '/admin';
        delete req.session.returnTo;
        return res.redirect(redirectTo);
      }

      // Invalid credentials
      return res.render('login', {
        errors: ['Invalid username or password']
      });
    });
  });
});

// Logout handler
router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/auth/login');
  });
});

module.exports = {
  router,
  ensureOrganiserOrAdmin
};
