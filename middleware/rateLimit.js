/**
 * middleware/rateLimit.js
 * ----------------------------------------------------------------------------
 * NEW FEATURE: rate limiting to protect SMS/USSD endpoints from abuse.
 */

const rateLimit = require('express-rate-limit');
const config = require('../config');

const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests, please try again later.',
});

module.exports = limiter;
