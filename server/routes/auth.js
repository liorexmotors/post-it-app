const express = require('express');
const router = express.Router();
const crypto = require('crypto');

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  const validUser = process.env.ADMIN_USERNAME || 'LIORH';
  const validPass = process.env.ADMIN_PASSWORD || 'Lior1974';

  if (username === validUser && password === validPass) {
    // Simple token: HMAC of credentials with a secret
    const secret = process.env.SESSION_SECRET || 'postit-secret-2024';
    const token = crypto.createHmac('sha256', secret)
      .update(validUser + validPass)
      .digest('hex');
    res.json({ success: true, token });
  } else {
    res.status(401).json({ error: 'שם משתמש או סיסמה שגויים' });
  }
});

// GET /api/auth/verify
router.get('/verify', (req, res) => {
  res.json({ valid: true });
});

module.exports = router;
