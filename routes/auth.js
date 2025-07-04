// routes/auth.js
// -----------------------------------------------------------
// Login / logout for organisers.  Stores organiserId + username
// in the session after bcrypt verification.
// -----------------------------------------------------------

const express = require('express');
const bcrypt  = require('bcrypt');
const router  = express.Router();
const db      = global.db;

/* GET  /login – render form */
router.get('/login', (req, res) =>
  res.render('login', {
    error : null,
    next  : req.query.next || '/organiser'
  })
);

/* POST /login – process form */
router.post('/login', (req, res, next) => {
  const { username, password, next: nextUrl } = req.body;

  db.get('SELECT * FROM organisers WHERE username = ?', [username.trim()], async (err, org) => {
    if (err) return next(err);
    if (!org) return res.render('login', { error: 'Bad credentials', next: nextUrl });

    try {
      const ok = await bcrypt.compare(password, org.password_hash);
      if (!ok) return res.render('login', { error: 'Bad credentials', next: nextUrl });

      // success
      req.session.organiserId = org.id;
      req.session.username    = org.username;
      res.redirect(nextUrl || '/organiser');
    } catch (e) { next(e); }
  });
});

/* GET /logout */
router.get('/logout', (req, res) =>
  req.session.destroy(() => res.redirect('/login'))
);

module.exports = router;
