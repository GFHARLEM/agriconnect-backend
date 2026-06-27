/**
 * services/sms.js
 * ----------------------------------------------------------------------------
 * Africa's Talking SMS sender.
 *
 * Fixes applied:
 *   - MINOR #16: no message content in logs — only phone + length.
 *
 * Enhancements:
 *   - Input validation (phone E.164, non-empty message).
 *   - Auto-truncate message to 160 chars (single-segment SMS).
 *   - Sandbox-aware (uses AT sandbox mode when configured).
 *   - Returns structured result for callers.
 */

const africastalking = require('africastalking');
const config = require('../config');
const { isValidPhone } = require('../db/supabase');

const SMS_MAX_CHARS = 160;

const atClient = africastalking({
  apiKey: config.at.apiKey,
  username: config.at.username,
});

const smsService = atClient.SMS;

/**
 * Send an SMS to a single recipient.
 * @param {string} to       E.164 phone number, e.g. +256712345678
 * @param {string} message  Message body.
 * @returns {Promise<{ ok: boolean, messageId?: string, error?: string }>}
 */
async function sendSMS(to, message) {
  if (!isValidPhone(to)) {
    return { ok: false, error: `Invalid recipient phone: ${to}` };
  }
  if (!message || !message.trim()) {
    return { ok: false, error: 'Message body cannot be empty' };
  }

  const body = message.length > SMS_MAX_CHARS
    ? message.slice(0, SMS_MAX_CHARS - 1) + '…'
    : message;

  try {
    const result = await smsService.send({
      to: [to],
      message: body,
      from: config.at.senderId,
    });

    // Africa's Talking wraps responses per-recipient.
    const recipients = result?.SMSMessageData?.Recipients || [];
    const first = recipients[0] || {};
    const ok = (first.status || '').toLowerCase() === 'success';

    // Privacy-safe log: phone + length only, no message content.
    console.log(
      `[INFO] SMS ${ok ? 'sent' : 'failed'} to ${to} | len=${body.length} | code=${first.statusCode || '-'}`
    );

    return { ok, messageId: first.messageId, error: ok ? undefined : first.status };
  } catch (err) {
    console.error(`[ERROR] SMS dispatch to ${to} failed: ${err.message}`);
    return { ok: false, error: err.message };
  }
}

module.exports = { sendSMS };
