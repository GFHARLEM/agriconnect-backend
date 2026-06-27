/**
 * config/index.js
 * ----------------------------------------------------------------------------
 * Centralised, validated configuration object.
 *
 * Fix applied:
 *   - CRITICAL #1: SUPABASE_URL with `/rest/v1/` suffix no longer breaks the
 *     Supabase client. We strip any trailing path automatically.
 *
 * Enhancements:
 *   - Single source of truth for all env vars.
 *   - Fail-fast validation: server will not boot with missing critical vars.
 *   - Type coercion for numbers / booleans.
 *   - Exposes a `LOG_LEVEL` and `isProd` flag used elsewhere.
 */

require('dotenv').config();

/**
 * Strip trailing path segments from the Supabase URL.
 * Accepts both `https://x.supabase.co` and `https://x.supabase.co/rest/v1/`.
 */
function normalizeSupabaseUrl(raw) {
  if (!raw || typeof raw !== 'string') return '';
  // Remove trailing slashes, then drop any /rest/v1 or /auth/v1 suffix.
  return raw.trim().replace(/\/+$/, '').replace(/\/(rest|auth)\/v\d+$/i, '');
}

function required(name, value) {
  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function toInt(value, fallback) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function toBool(value, fallback = false) {
  if (value === undefined) return fallback;
  return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
}

const config = {
  env: process.env.NODE_ENV || 'development',
  isProd: (process.env.NODE_ENV || 'development') === 'production',
  isDev: (process.env.NODE_ENV || 'development') === 'development',
  logLevel: process.env.LOG_LEVEL || 'info',

  port: toInt(process.env.PORT, 3000),
  requestTimeoutMs: toInt(process.env.REQUEST_TIMEOUT_MS, 30000),

  supabase: {
    url: normalizeSupabaseUrl(process.env.SUPABASE_URL),
    anonKey: required('SUPABASE_ANON_KEY', process.env.SUPABASE_ANON_KEY),
  },

  llm: {
    apiKey: required('FEATHERLESS_API_KEY', process.env.FEATHERLESS_API_KEY),
    model: process.env.FEATHERLESS_MODEL || 'deepseek-ai/DeepSeek-V3',
    baseUrl: 'https://api.featherless.ai/v1',
    timeoutMs: toInt(process.env.LLM_TIMEOUT_MS, 30000),
    // Agriculture-focused system prompt — improves relevance & token economy.
    systemPrompt:
      'You are AgriConnect, an expert agronomist assistant for Ugandan ' +
      'smallholder farmers. Answer in clear, simple English under 480 ' +
      'characters. Focus on practical, low-cost, locally available remedies. ' +
      'When unsure, advise visiting the nearest agricultural extension officer.',
  },

  at: {
    username: process.env.AT_USERNAME || 'sandbox',
    apiKey: required('AT_API_KEY', process.env.AT_API_KEY),
    senderId: process.env.AT_SENDER_ID || 'AGRICONNECT',
    sandbox: toBool(process.env.AT_SANDBOX, true),
  },

  rateLimit: {
    windowMs: toInt(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
    max: toInt(process.env.RATE_LIMIT_MAX, 300),
  },
};

module.exports = Object.freeze(config);