// index.js - Enhanced Event Manager with Authentication
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const portfinder = require('portfinder');
const bcrypt = require('bcrypt');

const DEFAULT_PORT = parseInt(process.env.PORT, 10) || 3000;
const app = express();

/* ─────────────────────── SQLite connection ─────────────────────── */
global.db = new sqlite3.Database('database.db', err => {
  if (err) console.error(err);
  else console.log('🗄️  Connected to SQLite');
});

/* ─────────────────────── View engine & static ─────────────────────── */
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

/* ─────────────────────── Body parsers & session ─────────────────────── */
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'event-manager-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  })
);
app.use(flash());

/* ─────────────────────── Global middleware ─────────────────────── */
// Make flash messages available to all views
app.use((req, res, next) => {
  res.locals.success_msg = req.flash('success');
  res.locals.error_msg = req.flash('error');
  res.locals.error = req.flash('error');
  res.locals.user = req.session.user || null;
  res.locals.theme = req.session.theme || 'light';
  next();
});

// Theme middleware
app.use((req, res, next) => {
  if (req.query.theme && ['light', 'dark'].includes(req.query.theme)) {
    req.session.theme = req.query.theme;
    
    // Save theme preference to database
    if (req.sessionID) {
      global.db.run(
        `INSERT OR REPLACE INTO user_preferences (session_id, theme) 
         VALUES (?, ?)`,
        [req.sessionID, req.query.theme],
        (err) => {
          if (err) console.error('Error saving theme preference:', err);
        }
      );
    }
  }
  next();
});

/* ─────────────────────── Authentication Middleware ─────────────────────── */
const authMiddleware = {
  // Check if user is authenticated as organiser
  ensureOrganiser: (req, res, next) => {
    if (req.session.user && req.session.user.type === 'organiser') {
      return next();
    }
    req.flash('error', 'Please log in as an organiser to access this page');
    res.redirect('/auth/organiser/login');
  },

  // Check if user is authenticated as admin
  ensureAdmin: (req, res, next) => {
    if (req.session.user && req.session.user.type === 'admin') {
      return next();
    }
    req.flash('error', 'Admin access required');
    res.redirect('/auth/admin/login');
  },

  // Check if user is authenticated (any type)
  ensureAuthenticated: (req, res, next) => {
    if (req.session.user) {
      return next();
    }
    req.flash('error', 'Please log in to continue');
    res.redirect('/');
  },

  // Redirect if already authenticated
  ensureGuest: (req, res, next) => {
    if (!req.session.user) {
      return next();
    }
    // Redirect based on user type
    if (req.session.user.type === 'admin') {
      res.redirect('/admin');
    } else if (req.session.user.type === 'organiser') {
      res.redirect('/organiser');
    } else {
      res.redirect('/');
    }
  }
};

// Make auth middleware globally available
app.use((req, res, next) => {
  res.locals.authMiddleware = authMiddleware;
  next();
});

/* ─────────────────────────── Routes ─────────────────────────── */
// Authentication routes
app.use('/auth', require('./routes/auth'));

// Protected organiser routes
app.use('/organiser', authMiddleware.ensureOrganiser, require('./routes/organiser'));

// Protected admin routes
app.use('/admin', authMiddleware.ensureAdmin, require('./routes/admin'));

// Public attendee routes
app.use('/attendee', require('./routes/attendee'));

// Payment routes
app.use('/payment', require('./routes/payment'));

// API routes for AJAX calls
app.use('/api', require('./routes/api'));

// Home page
app.get('/', (req, res) => {
  res.render('index', { theme: req.session.theme || 'light' });
});

// Theme toggle endpoint
app.post('/toggle-theme', (req, res) => {
  const currentTheme = req.session.theme || 'light';
  req.session.theme = currentTheme === 'light' ? 'dark' : 'light';
  
  if (req.sessionID) {
    global.db.run(
      `INSERT OR REPLACE INTO user_preferences (session_id, theme) 
       VALUES (?, ?)`,
      [req.sessionID, req.session.theme]
    );
  }
  
  res.json({ theme: req.session.theme });
});

/* ─────────────────────── 404 & error handlers ─────────────────────── */
app.use((req, res) => res.status(404).render('404'));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', { 
    error: process.env.NODE_ENV === 'development' ? err : {} 
  });
});

/* ─────────────────────── Start the server ─────────────────────── */
portfinder.basePort = DEFAULT_PORT;
portfinder
  .getPortPromise()
  .then(port => {
    app.listen(port, () => {
      console.log(`🚀 Event Manager Pro listening on http://localhost:${port}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  })
  .catch(err => {
    console.error('❌ Could not find an open port:', err);
    process.exit(1);
  });