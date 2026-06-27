/**
 * routes/ussd.js
 * ----------------------------------------------------------------------------
 * Africa's Talking USSD webhook.
 *
 * Enhancements:
 *   - Accepts both JSON and form-urlencoded bodies.
 *   - Returns plain-text `CON ...` / `END ...` responses.
 *   - Centralised error → user-friendly fallback.
 */

const express = require('express');
const router = express.Router();
const { handleUSSD } = require('../services/ussd');

router.post('/', async (req, res) => {
  res.set('Content-Type', 'text/plain');

  const payload = {
    sessionId: req.body.sessionId || req.body.session_id,
    phoneNumber: req.body.phoneNumber || req.body.phone_number,
    text: req.body.text || '',
  };

  try {
    const { action, text } = await handleUSSD(payload);
    return res.status(200).send(`${action} ${text}`);
  } catch (err) {
    console.error(`[ERROR] USSD: ${err.message}`);
    return res.status(200).send('END Service temporarily unavailable. Please try again later.');
  }
});

module.exports = router;
