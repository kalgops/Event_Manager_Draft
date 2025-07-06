// routes/users.js
const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /users
router.get('/', (req, res, next) => {
  db.all('SELECT id, name, email FROM users ORDER BY id DESC', [], (err, users) => {
    if (err) return next(err);
    res.render('users', { title: 'User List', users });
  });
});

module.exports = router;
// This code handles the user management routes, allowing admins to view a list of users.