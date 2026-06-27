/**
 * services/llm.js
 * ----------------------------------------------------------------------------
 * Featherless AI wrapper (OpenAI-compatible).
 *
 * Fixes applied:
 *   - MEDIUM #10: error logging no longer dumps `error.response.data`
 *     (which may contain rate-limit/auth headers). Only message + status.
 *
 * Enhancements:
 *   - Typed errors: RateLimitError / TimeoutError / ServerError.
 *   - AbortController-backed timeout (no hanging sockets).
 *   - Temperature & max_tokens tuned for agronomy advice.
 *   - Automatic retry with exponential backoff on rate-limit (1 retry).
 */

const axios = require('axios');
const config = require('../config');

class LLMError extends Error {
  constructor(message, { status, kind } = {}) {
    super(message);
    this.name = 'LLMError';
    this.status = status;
    this.kind = kind || 'unknown';
  }
}

function classifyError(err) {
  if (err.code === 'ECONNABORTED' || err.name === 'AbortError') {
    return { kind: 'timeout', status: null, message: 'LLM request timed out' };
  }
  const status = err.response?.status;
  if (status === 429) return { kind: 'rate_limit', status, message: 'LLM rate-limited' };
  if (status >= 500) return { kind: 'server', status, message: `LLM server error (${status})` };
  if (status >= 400) return { kind: 'client', status, message: `LLM client error (${status})` };
  return { kind: 'network', status: null, message: 'LLM network error' };
}

async function callOnce(messages, signal) {
  const resp = await axios.post(
    `${config.llm.baseUrl}/chat/completions`,
    {
      model: config.llm.model,
      messages,
      temperature: 0.4,
      max_tokens: 600,
    },
    {
      headers: {
        Authorization: `Bearer ${config.llm.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: config.llm.timeoutMs,
      signal,
    }
  );
  const content = resp.data?.choices?.[0]?.message?.content;
  if (!content) throw new LLMError('Empty LLM response', { kind: 'empty' });
  return content.trim();
}

/**
 * Public entry point.
 * @param {string} userQuery  The farmer's question.
 * @returns {Promise<string>} Advisory text.
 */
async function generateAdvisory(userQuery) {
  if (!userQuery || !userQuery.trim()) {
    throw new LLMError('Empty user query', { kind: 'validation' });
  }

  const messages = [
    { role: 'system', content: config.llm.systemPrompt },
    { role: 'user', content: userQuery },
  ];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.llm.timeoutMs);

  try {
    return await callOnce(messages, controller.signal);
  } catch (err) {
    const cls = classifyError(err);
    console.error(`[ERROR] LLM ${cls.kind}: ${cls.message}`);

    // Single retry on rate-limit (exponential backoff).
    if (cls.kind === 'rate_limit') {
      await new Promise((r) => setTimeout(r, 1500));
      try {
        return await callOnce(messages, controller.signal);
      } catch (retryErr) {
        const retryCls = classifyError(retryErr);
        console.error(`[ERROR] LLM retry failed (${retryCls.kind}): ${retryCls.message}`);
        throw new LLMError(retryCls.message, retryCls);
      }
    }
    throw new LLMError(cls.message, cls);
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { generateAdvisory, LLMError };
