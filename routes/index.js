// routes/index.js
const express = require('express');
const router = express.Router();

// GET / - Landing/Home Page
router.get('/', (req, res) => {
  res.render('index', { title: 'Home' });
});

module.exports = router;
