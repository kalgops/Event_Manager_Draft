// index.js ─ main entry point
const express    = require('express');
const session    = require('express-session');
const sqlite3    = require('sqlite3').verbose();
const path       = require('path');
const portfinder = require('portfinder');
const cookieParser  = require('cookie-parser');   // For parsing cookies, if needed
const bcrypt     = require('bcrypt');             // For password hashing

const DEFAULT_PORT = parseInt(process.env.PORT, 10) || 3000;
const app = express();

/* ─── SQLite (must exist before routes) ─────────────────────── */
global.db = new sqlite3.Database('database.db', err =>
  err ? console.error('DB connect error:', err)
      : console.log('🗄️  Connected to SQLite')
);

/* ─── Routers & middleware ──────────────────────────────────── */
const authRouter      = require('./routes/auth');
const { ensureAdmin } = require('./middleware/auth');
const organiserRouter = require('./routes/organiser');
const attendeeRouter  = require('./routes/attendee');
const usersRouter     = require('./routes/users');

/* ─── View engine & static ──────────────────────────────────── */
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

/* ─── Body parsers & session ────────────────────────────────── */
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());   // For parsing cookies, if needed  
app.use(session({
  secret: 'auction-secret',
  resave: false,
  saveUninitialized: false
}));
app.use((req, res, next) => { res.locals.session = req.session; next(); });

/* ─── Mount routes ──────────────────────────────────────────── */
app.use('/',          authRouter);
app.use('/organiser', ensureAdmin, organiserRouter);
app.use('/attendee',  attendeeRouter);
app.use('/users',     usersRouter);
app.get('/', (_req, res) => res.render('index'));

/* ─── 404 & error handlers ─────────────────────────────────── */
app.use((_req, res) => res.status(404).render('404'));
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).send('Internal Server Error');
});

/* ─── Listen on first free port ─────────────────────────────── */
portfinder.basePort = DEFAULT_PORT;
portfinder.getPortPromise()
  .then(port => app.listen(port,
           () => console.log(`🚀  http://localhost:${port}`)))
  .catch(err => { console.error('❌  No free port', err); process.exit(1); });
