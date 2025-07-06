// routes/auth.js
const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();

const db = global.db; // assumes database connection is global

// ─────────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────────

function ensureAuthenticated(req, res, next) {
  if (req.session?.user) return next();
  req.session.returnTo = req.originalUrl;
  return res.redirect('/auth/login');
}

function ensureAdmin(req, res, next) {
  if (req.session?.admin) return next();
  req.session.returnTo = req.originalUrl;
  return res.redirect('/auth/admin/login');
}

// ─────────────────────────────────────────────
// GET /auth/login – Show Attendee Login Page
// ─────────────────────────────────────────────

router.get('/login', (req, res) => {
  res.render('auth/login', { flash: req.flash() });
});

// ─────────────────────────────────────────────
// POST /auth/login – Authenticate Attendee User
// ─────────────────────────────────────────────

router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    req.flash('error', 'Email and password are required.');
    return res.redirect('/auth/login');
  }

  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
    if (err) {
      console.error('[❌] DB error:', err);
      req.flash('error', 'Something went wrong.');
      return res.redirect('/auth/login');
    }

    if (!user) {
      req.flash('error', 'Invalid email or password.');
      return res.redirect('/auth/login');
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      req.flash('error', 'Invalid email or password.');
      return res.redirect('/auth/login');
    }

    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email
    };

    const redirectTo = req.session.returnTo || '/attendee/tickets';
    delete req.session.returnTo;
    res.redirect(redirectTo);
  });
});

// ─────────────────────────────────────────────
// GET /auth/signup – Show Attendee Signup Page
// ─────────────────────────────────────────────

router.get('/signup', (req, res) => {
  res.render('auth/signup', { errors: [] });
});

// ─────────────────────────────────────────────
// POST /auth/signup – Register New Attendee
// ─────────────────────────────────────────────

router.post('/signup', async (req, res) => {
  const { name, email, password } = req.body;
  const errors = [];

  if (!name) errors.push('Name is required');
  if (!email) errors.push('Email is required');
  if (!password || password.length < 6) errors.push('Password must be at least 6 characters');

  if (errors.length) {
    return res.render('auth/signup', { errors });
  }

  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, existingUser) => {
    if (err) {
      console.error('[❌] DB error:', err);
      return res.render('auth/signup', { errors: ['Database error'] });
    }

    if (existingUser) {
      return res.render('auth/signup', { errors: ['Email already registered'] });
    }

    const password_hash = await bcrypt.hash(password, 10);
    db.run('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
      [name, email, password_hash],
      function (err) {
        if (err) {
          console.error('[❌] Insert error:', err);
          return res.render('auth/signup', { errors: ['Failed to create user'] });
        }

        req.session.user = {
          id: this.lastID,
          name,
          email
        };

        res.redirect('/attendee/tickets');
      });
  });
});

// ─────────────────────────────────────────────
// GET /auth/admin/login – Admin Login
// ─────────────────────────────────────────────

router.get('/admin/login', (req, res) => {
  res.render('login', { error: null });
});

router.post('/admin/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.render('login', { error: 'Both fields are required.' });
  }

  db.get('SELECT * FROM admins WHERE username = ?', [username], async (err, admin) => {
    if (err) {
      console.error('[❌] DB error:', err);
      return res.render('login', { error: 'Something went wrong.' });
    }

    if (!admin) {
      return res.render('login', { error: 'Invalid admin credentials.' });
    }

    const match = await bcrypt.compare(password, admin.password);
    if (!match) {
      return res.render('login', { error: 'Invalid admin credentials.' });
    }

    req.session.admin = {
      id: admin.id,
      username: admin.username
    };

    const redirectTo = req.session.returnTo || '/admin';
    delete req.session.returnTo;
    res.redirect(redirectTo);
  });
});

// ─────────────────────────────────────────────
// GET /auth/logout – Logout (All Roles)
// ─────────────────────────────────────────────

router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// ─────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────

module.exports = {
  router,
  ensureAuthenticated,
  ensureAdmin
};
