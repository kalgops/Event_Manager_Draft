// routes/auth.js
const express  = require('express');
const bcrypt   = require('bcrypt');
const router   = express.Router();
const db       = global.db;

/* GET login form */
router.get('/login', (req, res) =>
  res.render('login', { error:null, next:req.query.next||'/organiser' }));

/* POST login */
router.post('/login', (req, res, next) => {
  const { username, password, next:nextUrl } = req.body;
  db.get('SELECT * FROM organisers WHERE username = ?', [username], (err, org) => {
    if (err) return next(err);
    if (!org) return res.render('login', { error:'Bad credentials', next:nextUrl });
    bcrypt.compare(password, org.password_hash, (err2, ok) => {
      if (err2) return next(err2);
      if (!ok)  return res.render('login', { error:'Bad credentials', next:nextUrl });
      req.session.organiserId = org.id;
      req.session.username    = org.username;
      res.redirect(nextUrl || '/organiser');
    });
  });
});

/* GET logout */
router.get('/logout', (req, res) => req.session.destroy(() => res.redirect('/login')));

module.exports = router;
// Ensure the organiser is logged in
const { ensureAdmin } = require('../middleware/auth');  