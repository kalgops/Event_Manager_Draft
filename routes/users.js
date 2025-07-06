// routes/users.js
const express = require('express');
const router = express.Router();
const db = global.db; // ✅ Fix: use global.db

// GET /users
router.get('/', (req, res, next) => {
  db.all('SELECT id, name, email FROM users ORDER BY id DESC', [], (err, users) => {
    if (err) return next(err);
    res.render('users', { title: 'User List', users });
  });
});

module.exports = router;
// This file handles user-related routes, such as listing all users.