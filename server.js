/**
 * server.js
 * ----------------------------------------------------------------------------
 * Express entrypoint.
 *
 * Fixes applied:
 *   - MEDIUM #14: timeout middleware.
 *
 * Enhancements:
 *   - Helmet for security headers.
 *   - Compression for JSON responses.
 *   - Rate limiting on all routes.
 *   - Graceful shutdown (SIGINT/SIGTERM).
 *   - Health endpoint returns DB connectivity status.
 */

const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const config = require('./config');
const { verifyTables } = require('./db/supabase');

const logger = require('./middleware/logger');
const timeout = require('./middleware/timeout');
const rateLimit = require('./middleware/rateLimit');

const smsRoutes = require('./routes/sms');
const ussdRoutes = require('./routes/ussd');
const analyticsRoutes = require('./routes/analytics');

const app = express();

// ----- Security & compression ---------------------------------------------
app.use(helmet());
app.use(compression());

// ----- Body parsers --------------------------------------------------------
app.use(express.json({ limit: '64kb' }));
app.use(express.urlencoded({ extended: true, limit: '64kb' }));

// ----- Observability & protection -----------------------------------------
app.use(logger);
//app.use(timeout);
app.use(rateLimit);
// Add this root route for Render's health check
app.get('/', (req, res) => {
  res.json({ ok: true, service: 'AgriConnect API' });
});

// ----- Health check --------------------------------------------------------
app.get('/health', async (req, res) => {
  try {
    await verifyTables();
    return res.json({ ok: true, status: 'healthy', db: 'connected' });
  } catch (err) {
    console.error(`[ERROR] health: ${err.message}`);
    return res.status(503).json({ ok: false, status: 'degraded', db: 'disconnected' });
  }
});

// ----- Routes --------------------------------------------------------------
app.use('/sms', smsRoutes);
app.use('/ussd', ussdRoutes);
app.use('/analytics', analyticsRoutes);

// ----- 404 -----------------------------------------------------------------
app.use((req, res) => {
  res.status(404).send('Not Found');
});

// ----- Global error handler ------------------------------------------------
app.use((err, req, res, next) => {
  console.error(`[ERROR] unhandled: ${err.message}`);
  if (res.headersSent) return next(err);
  res.status(500).send('Internal Server Error');
});

// ----- Boot ----------------------------------------------------------------
const server = app.listen(config.port, async () => {
  console.log(`[INFO] AgriConnect running on http://localhost:${config.port} (${config.env})`);
  try {
    await verifyTables();
    console.log('[INFO] Supabase schema verified.');
  } catch (err) {
    console.warn(`[WARN] Supabase schema check failed: ${err.message}`);
  }
});

// ----- Graceful shutdown ---------------------------------------------------
function shutdown(signal) {
  console.log(`[INFO] ${signal} received — shutting down...`);
  server.close(() => {
    console.log('[INFO] HTTP server closed.');
    process.exit(0);
  });
  // Force-exit after 10s if hanging.
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => {
  console.error('[ERROR] Unhandled promise rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[ERROR] Uncaught exception:', err);
  shutdown('uncaughtException');
});

module.exports = app;
