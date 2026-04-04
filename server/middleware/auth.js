const crypto = require('crypto');

function authMiddleware(req, res, next) {
  // Skip auth for login route
  if (req.path.startsWith('/api/auth')) return next();

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const secret = process.env.SESSION_SECRET || 'postit-secret-2024';
  const validUser = process.env.ADMIN_USERNAME || 'LIORH';
  const validPass = process.env.ADMIN_PASSWORD || 'Lior1974';

  const validToken = crypto.createHmac('sha256', secret)
    .update(validUser + validPass)
    .digest('hex');

  if (token !== validToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
}

module.exports = authMiddleware;
