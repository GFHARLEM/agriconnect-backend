/**
 * services/ussd.js
 * ----------------------------------------------------------------------------
 * USSD state machine for Africa's Talking.
 *
 * Fixes applied:
 *   - MEDIUM #11: every response verified to be under the 182-char USSD limit.
 *   - MINOR: removed emoji from menus (often counts as multi-byte on gateways).
 *
 * Enhancements:
 *   - Session parsed from `text` using "*" separator (AT convention).
 *   - Multi-step flow: Welcome → Advisory / History / Help.
 *   - Helper `safeConcat()` truncates safely to 180 chars (buffer for safety).
 */

const USSD_MAX = 180; // 182 hard gateway limit; leave 2-char buffer
const db = require('../db/supabase');
const { generateAdvisory } = require('./llm');

function truncate(text, max = USSD_MAX) {
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
}

function end(text) {
  return { action: 'END', text: truncate(text) };
}
function cont(text) {
  return { action: 'CON', text: truncate(text) };
}

const WELCOME =
  'Welcome to AgriConnect\n' +
  '1. Ask a farming question\n' +
  '2. View my recent advisories\n' +
  '3. Help';

const HELP_TEXT =
  'END AgriConnect: SMS your question to this shortcode for detailed advice. ' +
  'Example: "My maize leaves have white spots".';

/**
 * Main entrypoint.
 * @param {{ sessionId, phoneNumber, text }} payload
 * @returns {Promise<{ action: string, text: string }>}
 */
async function handleUSSD({ phoneNumber, text }) {
  if (!db.isValidPhone(phoneNumber)) {
    return end('Invalid phone number. Use format +2567XXXXXXX.');
  }

  const steps = (text || '').split('*').filter((s) => s !== '');

  // Level 0 — Welcome
  if (steps.length === 0) return cont(WELCOME);

  const choice = steps[0];

  // Level 1 — Advisory
  if (choice === '1') {
    if (steps.length === 1) {
      return cont('Enter your question (e.g. "My cassava leaves are yellowing"):');
    }
    const question = steps.slice(1).join(' ').trim();
    if (!question) return cont('Question cannot be empty. Enter your question:');

    try {
      const answer = await generateAdvisory(question);
      return end(`Advisory: ${answer}`);
    } catch (err) {
      console.error(`[ERROR] USSD LLM: ${err.message}`);
      return end('Service temporarily unavailable. Please retry shortly.');
    }
  }

  // Level 1 — History
  if (choice === '2') {
    try {
      const history = await db.getFarmerHistory(phoneNumber, 3);
      if (!history.length) {
        return end('No previous advisories found. Send an SMS to get started.');
      }
      const lines = history.map(
        (h, i) => `${i + 1}. ${h.query.slice(0, 40)}`
      );
      return end(`Recent advisories:\n${lines.join('\n')}`);
    } catch (err) {
      console.error(`[ERROR] USSD history: ${err.message}`);
      return end('Could not load history. Please try again later.');
    }
  }

  // Level 1 — Help
  if (choice === '3') return HELP_TEXT;

  return cont('Invalid choice.\n' + WELCOME);
}

module.exports = { handleUSSD };
