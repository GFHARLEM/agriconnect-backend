/**
 * routes/analytics.js
 * ----------------------------------------------------------------------------
 * Analytics endpoints.
 *
 * Fixes applied:
 *   - CRITICAL #3: no farmer PII (phones) is ever returned.
 *   - MEDIUM: query-parameter validation.
 *
 * Enhancements:
 *   - In-memory 30-second cache for heavy aggregations.
 *   - Bounded `limit` parameter (1–100) to prevent abuse.
 *   - Unified `{ ok, data }` envelope.
 */

const express = require('express');
const router = express.Router();
const db = require('../db/supabase');

// Simple TTL cache
function ttlCache(ttlMs) {
  const store = new Map();
  return {
    async get(key, producer) {
      const hit = store.get(key);
      if (hit && Date.now() - hit.ts < ttlMs) return hit.value;
      const value = await producer();
      store.set(key, { ts: Date.now(), value });
      return value;
    },
  };
}
const cache = ttlCache(30_000);

function sanitizeLimit(raw, fallback = 10) {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, 1), 100);
}

router.get('/top-pests', async (req, res) => {
  try {
    const limit = sanitizeLimit(req.query.limit, 10);
    const data = await cache.get(`top-pests:${limit}`, () => db.getTopPests(limit));
    res.json({ ok: true, data });
  } catch (err) {
    console.error(`[ERROR] /top-pests: ${err.message}`);
    res.status(500).json({ ok: false, error: 'Failed to load top pests' });
  }
});

router.get('/top-crops', async (req, res) => {
  try {
    const limit = sanitizeLimit(req.query.limit, 10);
    const data = await cache.get(`top-crops:${limit}`, () => db.getTopCrops(limit));
    res.json({ ok: true, data });
  } catch (err) {
    console.error(`[ERROR] /top-crops: ${err.message}`);
    res.status(500).json({ ok: false, error: 'Failed to load top crops' });
  }
});

router.get('/farmer-count', async (req, res) => {
  try {
    const data = await cache.get('farmer-count', () => db.getFarmerCount());
    res.json({ ok: true, data: { count: data } });
  } catch (err) {
    console.error(`[ERROR] /farmer-count: ${err.message}`);
    res.status(500).json({ ok: false, error: 'Failed to load farmer count' });
  }
});

router.get('/recent-advisories', async (req, res) => {
  try {
    const limit = sanitizeLimit(req.query.limit, 10);
    // Privacy note: deliberately excludes farmers.phone and farmer_id.
    const data = await db.getRecentAdvisories(limit);
    res.json({ ok: true, data });
  } catch (err) {
    console.error(`[ERROR] /recent-advisories: ${err.message}`);
    res.status(500).json({ ok: false, error: 'Failed to load recent advisories' });
  }
});

module.exports = router;
