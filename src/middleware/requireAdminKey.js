const config = require('../config/env');

function requireAdminKey(req, res, next) {
  if (!config.ADMIN_API_KEY) {
    return next();
  }

  const providedKey = req.headers['x-api-key'] || req.query.apiKey;
  if (!providedKey || providedKey !== config.ADMIN_API_KEY) {
    return res.status(401).json({ success: false, message: 'Unauthorized: Invalid or missing API key' });
  }

  return next();
}

module.exports = requireAdminKey;
