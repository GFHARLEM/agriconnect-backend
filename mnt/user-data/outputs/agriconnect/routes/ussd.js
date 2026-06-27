// routes/ussd.js
// ─────────────────────────────────────────────────────────────────────────────
// Handles USSD sessions from Africa's Talking.
//
// AT sends: sessionId, serviceCode, phoneNumber, text
// We must reply with plain text starting with "CON " or "END "
// within ~5 seconds or AT times out the session.
// ─────────────────────────────────────────────────────────────────────────────

const express = require("express");
const router  = express.Router();
const { handleUSSD } = require("../services/ussd");

// POST /ussd
router.post("/", async (req, res) => {
  const { sessionId, serviceCode, phoneNumber, text } = req.body;

  console.log(`📱 USSD [${sessionId}] from ${phoneNumber}, input: "${text}"`);

  // Africa's Talking expects plain text – not JSON
  res.set("Content-Type", "text/plain");

  try {
    const response = await handleUSSD({ sessionId, phoneNumber, text });
    res.send(response);
  } catch (err) {
    console.error("USSD route error:", err.message);
    res.send("END Something went wrong. Please try again.");
  }
});

module.exports = router;
