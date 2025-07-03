// index.js ─ root of Auction-Gala-Planner
const express   = require('express');
const session   = require('express-session');
const sqlite3   = require('sqlite3').verbose();
const path      = require('path');
const portfinder = require('portfinder');          // NEW

const DEFAULT_PORT = parseInt(process.env.PORT, 10) || 3000;
const app = express();

/* ───────────────────────  SQLite connection ─────────────────────── */
global.db = new sqlite3.Database('database.db', err => {
  if (err) console.error(err);
  else     console.log('🗄️  Connected to SQLite');
});

/* ───────────────────────  View engine & static ───────────────────── */
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

/* ───────────────────────  Body parsers & session ─────────────────── */
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(
  session({
    secret: 'auction-secret',
    resave: false,
    saveUninitialized: true
  })
);

/* ─────────────────────────────  Routes ───────────────────────────── */
app.use('/organiser', require('./routes/organiser'));
app.use('/attendee',  require('./routes/attendee'));

app.get('/', (req, res) => res.render('index'));

/* ───────────────────────── 404 & error handlers ──────────────────── */
app.use((req, res) => res.status(404).render('404'));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('Internal Server Error');
});

/* ───────────────────────  Start the server ───────────────────────── */
portfinder.basePort = DEFAULT_PORT;               // start scanning here
portfinder
  .getPortPromise()
  .then(port => {
    app.listen(port, () =>
      console.log(`🚀  Listening on http://localhost:${port}`)
    );
  })
  .catch(err => {
    console.error('❌  Could not find an open port:', err);
    process.exit(1);
  });
