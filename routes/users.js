// routes/users.js
const express = require('express');
const router  = express.Router();
const db      = global.db;

/* list */
router.get('/', (req, res, next) => {
  db.all('SELECT * FROM users ORDER BY id', (err, users) => {
    if (err) return next(err);
    res.render('users', { users });
  });
});

/* add form */
router.get('/add', (req, res) => res.render('add-user', { error: null }));

/* add submit */
router.post('/add', (req, res, next) => {
  const name = (req.body.user_name || '').trim();
  if (!name) return res.render('add-user', { error: 'Name required' });
  db.run('INSERT INTO users(user_name) VALUES(?)', [name], err => {
    if (err) {
      if (err.code === 'SQLITE_CONSTRAINT')
        return res.render('add-user', { error: 'Name already exists' });
      return next(err);
    }
    res.redirect('/users');
  });
});

module.exports = router;
