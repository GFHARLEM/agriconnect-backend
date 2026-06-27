/**
 * middleware/logger.js
 * ----------------------------------------------------------------------------
 * Request logger.
 *
 * Fixes applied:
 *   - MINOR #17: skip verbose logging in production, redact query params.
 *
 * Enhancements:
 *   - PII redaction for known sensitive query params (phone, from, text).
 *   - Logs method, path, status, duration, content-length.
 */

const morgan = require('morgan');
const config = require('../config');

const SENSITIVE = ['phone', 'from', 'text', 'token', 'key', 'password'];

morgan.token('duration-ms', (req, res) => {
  const ms = res._startTime ? Date.now() - res._startTime : '-';
  return ms;
});

function redactQuery(path) {
  if (!path || !path.includes('?')) return path;
  const [base, qs] = path.split('?');
  const pairs = qs.split('&').map((pair) => {
    const [k, v] = pair.split('=');
    if (SENSITIVE.includes(k.toLowerCase())) return `${k}=REDACTED`;
    return pair;
  });
  return `${base}?${pairs.join('&')}`;
}

const format = config.isProd
  ? ':method :url :status :res[content-length] - :response-time ms'
  : ':method :url :status :response-time ms';

const logger = morgan(format, {
  skip: (req) => config.isProd && req.path === '/health',
  stream: {
    write: (msg) => {
      // Redact before writing.
      const redacted = SENSITIVE.reduce(
        (acc, key) => acc.replace(new RegExp(`${key}=[^&\\s]+`, 'gi'), `${key}=REDACTED`),
        msg
      );
      process.stdout.write(redacted);
    },
  },
});

module.exports = logger;