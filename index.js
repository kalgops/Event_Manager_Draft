// index.js
require('dotenv').config();
const express    = require('express');
const session    = require('express-session');
const flash      = require('connect-flash');
const sqlite3    = require('sqlite3').verbose();
const path       = require('path');
const portfinder = require('portfinder');

const DEFAULT_PORT = parseInt(process.env.PORT, 10) || 3000;
const app = express();

/* ─── SQLite connection ────────────────────────────────────────── */
global.db = new sqlite3.Database('database.db', err => {
  if (err) console.error(err);
  else console.log(`✅  Connected to SQLite: ${path.resolve('database.db')}`);
});

/* ─── View engine & static ─────────────────────────────────────── */
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

/* ─── Body parsing & session ───────────────────────────────────── */
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'event-manager-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000
  }
}));
app.use(flash());

/* ─── Global template vars ─────────────────────────────────────── */
app.use((req, res, next) => {
  res.locals.success_msg = req.flash('success');
  res.locals.error_msg   = req.flash('error');
  res.locals.user        = req.session.user || null;
  res.locals.theme       = req.session.theme || 'light';
  next();
});

/* ─── Theme toggle ─────────────────────────────────────────────── */
app.use((req, res, next) => {
  const t = req.query.theme;
  if (t === 'light' || t === 'dark') {
    req.session.theme = t;
    global.db.run(
      `INSERT OR REPLACE INTO user_preferences (session_id, theme) VALUES (?,?)`,
      [ req.sessionID, t ],
      err => { if (err) console.error(err); }
    );
  }
  next();
});

/* ─── Auth middleware ──────────────────────────────────────────── */
const auth = {
  ensureOrganiser: (req, res, next) => {
    if (req.session.user?.type === 'organiser') return next();
    req.flash('error', 'Please log in as organiser');
    return res.redirect('/');
  },
  ensureAdmin: (req, res, next) => {
    if (req.session.user?.type === 'admin') return next();
    req.flash('error', 'Admin access required');
    return res.redirect('/');
  }
};

/* ─── Routes ───────────────────────────────────────────────────── */
app.get('/', (req, res) => {
  res.render('index', { title: 'Welcome' });
});

app.post('/toggle-theme', (req, res) => {
  const nextTheme = req.session.theme === 'dark' ? 'light' : 'dark';
  req.session.theme = nextTheme;
  global.db.run(
    `INSERT OR REPLACE INTO user_preferences (session_id, theme) VALUES (?,?)`,
    [ req.sessionID, nextTheme ]
  );
  res.json({ theme: nextTheme });
});

app.use('/auth',      require('./routes/auth'));
app.use('/attendee',  require('./routes/attendee'));
app.use('/organiser', auth.ensureOrganiser, require('./routes/organiser'));
app.use('/admin',     auth.ensureAdmin,     require('./routes/admin'));
app.use('/users',     require('./routes/users'));
app.use('/payment',   require('./routes/payment'));

/* ─── Error handling ───────────────────────────────────────────── */
app.use((req, res) => {
  req.flash('error', 'Page not found');
  res.redirect('/');
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  req.flash('error', err.message || 'Something went wrong');
  res.redirect('/');
});

/* ─── Launch server ────────────────────────────────────────────── */
portfinder.basePort = DEFAULT_PORT;
portfinder.getPortPromise()
  .then(port => {
    app.listen(port, () => {
      console.log(`🚀 http://localhost:${port}`);
    });
  })
  .catch(err => {
    console.error('❌ Could not start:', err);
    process.exit(1);
  });
