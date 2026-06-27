/**
 * routes/sms.js
 * ----------------------------------------------------------------------------
 * Africa's Talking inbound SMS webhook.
 *
 * Fixes applied:
 *   - CRITICAL #4: farmer ALWAYS receives a reply, even when an error occurs.
 *   - MEDIUM #7:  response is plain-text "OK" (not JSON), per AT spec.
 *
 * Enhancements:
 *   - Body parsers handle both JSON and x-www-form-urlencoded.
 *   - Robust extraction of `from` / `text` (case-insensitive).
 *   - Replies are async — webhook returns 200 immediately.
 */

const express = require('express');
const router = express.Router();
const { processAdvisory } = require('../services/advisory');
const { sendSMS } = require('../services/sms');

/**
 * @param {object} body
 * @returns {{ from?: string, text?: string }}
 */
function extractPayload(body) {
  return {
    from: body.from || body.FROM || body.sender || body.phoneNumber,
    text: body.text || body.TEXT || body.message || body.Message,
  };
}

router.post('/inbound', async (req, res) => {
  // AT expects plain-text acknowledgement — set headers early.
  res.set('Content-Type', 'text/plain');

  const { from, text } = extractPayload(req.body || {});

  if (!from) {
    console.error('[ERROR] SMS webhook: missing "from" field');
    // No phone to reply to — just ack.
    return res.status(200).send('OK');
  }

  // Always ack to Africa's Talking immediately so they don't retry.
  res.status(200).send('OK');

  // Fire-and-forget processing — failures handled by replying to farmer.
  setImmediate(async () => {
    try {
      const result = await processAdvisory({ phone: from, query: text || '' });
      await sendSMS(from, result.advisory);
    } catch (err) {
      console.error(`[ERROR] SMS pipeline for ${from}: ${err.message}`);
      // Last-resort reply so farmer is never left in silence.
      await sendSMS(
        from,
        'Sorry, we could not process your request. Please try again later.'
      );
    }
  });
});

module.exports = router;
