require('dotenv').config();

const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'FEATHERLESS_API_KEY', 'AT_API_KEY', 'AT_USERNAME'];

const missing = required.filter(key => !process.env[key]);
if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

module.exports = {
  supabase: {
    url: process.env.SUPABASE_URL.replace(/\/rest\/v1\/?$/, ''),
    anonKey: process.env.SUPABASE_ANON_KEY,
  },
  featherless: {
    apiKey: process.env.FEATHERLESS_API_KEY,
    baseUrl: process.env.FEATHERLESS_BASE_URL || 'https://api.featherless.ai/v1',
    model: process.env.FEATHERLESS_MODEL || 'deepseek-ai/DeepSeek-V3-0324',
  },
  africaSTalking: {
    apiKey: process.env.AT_API_KEY,
    username: process.env.AT_USERNAME,
  },
    port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  },
};
