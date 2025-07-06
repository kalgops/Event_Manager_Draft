// index.js
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const path = require('path');
const portfinder = require('portfinder');
const { execSync } = require('child_process');
const compression = require('compression');
const cors = require('cors');

const app = express();
const DEFAULT_PORT = parseInt(process.env.PORT, 10) || 3000;

/* ─── SQLite connection ─────────────────────────────── */
let db;
try {
  const sqlite3 = require('sqlite3').verbose();
  db = new sqlite3.Database('database.db', err => {
    if (err) console.error('❌ sqlite3 native open error:', err);
    else console.log(`✅ Connected via sqlite3 native module: ${path.resolve('database.db')}`);
  });
} catch (err) {
  console.warn('⚠️ sqlite3 native load failed, using CLI fallback');
  db = {
    all(sql, params, cb) {
      if (typeof params === 'function') { cb = params; params = []; }
      const cmd = `sqlite3 -header -csv database.db "${sql.replace(/"/g, '\\"')}"`;
      try {
        const out = execSync(cmd, { encoding: 'utf8' });
        const [headerLine, ...rows] = out.trim().split('\n');
        const headers = headerLine.split(',');
        const result = rows.map(line => {
          const cols = line.split(',');
          const obj = {};
          headers.forEach((h, i) => { obj[h] = cols[i]; });
          return obj;
        });
        cb(null, result);
      } catch (e) { cb(e); }
    },
    run(sql, params, cb) {
      if (typeof params === 'function') { cb = params; params = []; }
      const cmd = `sqlite3 database.db "${sql.replace(/"/g, '\\"')}"`;
      try {
        execSync(cmd);
        cb && cb(null);
      } catch (e) { cb(e); }
    },
    close(cb) { cb && cb(); }
  };
}
global.db = db;

/* ─── View engine + static ───────────────────────────── */
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

/* ─── Middleware ─────────────────────────────────────── */
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cors());
app.use(compression());
app.use(session({
  secret: process.env.SESSION_SECRET || 'change-me',
  resave: false,
  saveUninitialized: false
}));
app.use(flash());

app.use((req, res, next) => {
  res.locals.flash = req.flash();
  res.locals.user = req.session.user || null;
  res.locals.admin = req.session.admin || null;
  next();
});


const organiserRouter = require('./routes/organiser');
const authRouter      = require('./routes/auth').router;
const adminRouter     = require('./routes/admin');
const attendeeRouter  = require('./routes/attendee');
const userRouter      = require('./routes/users');
const paymentRouter   = require('./routes/payment');
const indexRouter     = require('./routes/index');

/* ─── Mount Routes ───────────────────────────────────── */
app.use('/', indexRouter);
app.use('/organiser', organiserRouter);
app.use('/auth', authRouter);
app.use('/admin', adminRouter);
app.use('/attendee', attendeeRouter);
app.use('/users', userRouter);
app.use('/payment', paymentRouter);

/* ─── Health Check ───────────────────────────────────── */
app.get('/status', (req, res) => {
  res.json({ status: 'ok', db: !!db });
});

/* ─── Start Server ───────────────────────────────────── */
portfinder.basePort = DEFAULT_PORT;
portfinder.getPortPromise()
  .then(port => {
    app.listen(port, () => {
      console.log(`🚀 Server running at http://localhost:${port}`);
    });
  })
  .catch(err => {
    console.error('❌ Could not start server:', err);
    process.exit(1);
  });

/* ─── Graceful Shutdown ──────────────────────────────── */
process.on('SIGINT', () => {
  console.log('\n🔌 Shutting down gracefully...');
  db.close(() => {
    console.log('✅ Database connection closed.');
    process.exit(0);
  });
});
