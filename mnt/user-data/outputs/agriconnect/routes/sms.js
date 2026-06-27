// routes/sms.js
// ─────────────────────────────────────────────────────────────────────────────
// Handles inbound SMS from Africa's Talking.
//
// Africa's Talking POSTs to this endpoint when a farmer texts your shortcode.
// Payload fields: from, to, text, date, id, linkId
// ─────────────────────────────────────────────────────────────────────────────

const express  = require("express");
const router   = express.Router();
const { getAdvisory } = require("../services/advisory");
const { sendSMS }     = require("../services/sms");

// POST /sms/inbound
router.post("/inbound", async (req, res) => {
  // Always respond 200 immediately so AT doesn't retry
  res.sendStatus(200);

  const { from: phone, text } = req.body;

  if (!phone || !text) {
    console.warn("SMS inbound: missing phone or text", req.body);
    return;
  }

  console.log(`📥 SMS from ${phone}: "${text}"`);

  try {
    const advisory = await getAdvisory(phone, text);
    await sendSMS(phone, advisory);
  } catch (err) {
    console.error("SMS handler error:", err.message);
    // Attempt to notify the farmer even on error
    await sendSMS(phone, "Sorry, we could not process your request. Please try again.").catch(() => {});
  }
});

module.exports = router;
