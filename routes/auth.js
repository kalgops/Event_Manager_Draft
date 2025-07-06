// routes/auth.js
const express = require('express');
const bcrypt  = require('bcrypt');
const db      = require('../db');      // <-- ensure this import
const router  = express.Router();

// GET /login
router.get('/login', (req, res) =>
  res.render('login', { title: 'Login', errors: [] })
);

// POST /login
router.post('/login', (req, res, next) => {
  const { username, password } = req.body;
  const errors = [];
  if (!username) errors.push('Username required');
  if (!password) errors.push('Password required');
  if (errors.length) {
    return res.render('login', { title: 'Login', errors });
  }

  db.get(
    'SELECT * FROM organisers WHERE username = ?',
    [username],
    (err, user) => {
      if (err) return next(err);
      if (!user) {
        return res.render('login', { title: 'Login', errors: ['Invalid credentials'] });
      }
      bcrypt.compare(password, user.password_hash, (err, ok) => {
        if (err) return next(err);
        if (!ok) {
          return res.render('login', { title: 'Login', errors: ['Invalid credentials'] });
        }
        // unify under session.user so your middleware will pick it up:
        req.session.user = {
          id:   user.id,
          type: 'organiser',
          name: user.username
        };
        res.redirect('/organiser');
      });
    }
  );
});

// GET /logout
router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

module.exports = router;
