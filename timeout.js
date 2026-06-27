/**
 * middleware/timeout.js
 * ----------------------------------------------------------------------------
 * Fix MEDIUM #14: request timeout middleware.
 *
 * Aborts requests that exceed the configured timeout, returning 504.
 */

const config = require('../config');

module.exports = function timeout(req, res, next) {
  const timer = setTimeout(() => {
    if (!res.headersSent) {
      res.set('Content-Type', 'text/plain');
      res.status(504).send('Request timeout');
    }
  }, config.requestTimeoutMs);

  res.on('finish', () => clearTimeout(timer));
  res.on('close', () => clearTimeout(timer));
  next();
};