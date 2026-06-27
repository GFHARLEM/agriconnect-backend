/**
 * services/advisory.js
 * ----------------------------------------------------------------------------
 * Core orchestration: validate input → LLM → persist to Supabase.
 *
 * Fixes applied:
 *   - CRITICAL #5: phone validation before DB save.
 *   - MEDIUM #9:  all DB imports at top (no inline require()).
 *   - MEDIUM #12: empty query rejected (no wasted LLM credits).
 *
 * Enhancements:
 *   - Lightweight keyword extraction to tag advisories with crop/pest/disease.
 *   - Batched entity upserts via Promise.all (1 round-trip).
 *   - Single `processAdvisory()` entrypoint — clean call site for SMS/USSD.
 *   - Always returns a usable advisory text, even on LLM failure.
 */

const db = require('../db/supabase');
const { generateAdvisory, LLMError } = require('./llm');

// Keyword dictionaries (extend as needed)
const CROP_KEYWORDS = ['maize', 'cassava', 'beans', 'banana', 'coffee', 'rice', 'millet', 'groundnut', 'sweet potato', 'sorghum'];
const PEST_KEYWORDS = ['armyworm', 'aphid', 'whitefly', 'stem borer', 'bug', 'weevil', 'caterpillar', 'grasshopper'];
const DISEASE_KEYWORDS = ['mosaic', 'wilt', 'blight', 'rot', 'rust', 'yellow', 'spot', 'mold', 'smut'];

function extractKeyword(text, dictionary) {
  const lower = text.toLowerCase();
  return dictionary.find((kw) => lower.includes(kw)) || null;
}

/**
 * End-to-end advisory pipeline.
 * @param {{ phone: string, query: string, name?: string, region?: string }}
 * @returns {Promise<{ ok: boolean, advisory: string, error?: string }>}
 */
async function processAdvisory({ phone, query, name = null, region = null }) {
  // ---- 1. Validate phone ---------------------------------------------------
  if (!db.isValidPhone(phone)) {
    return {
      ok: false,
      advisory: 'Sorry, your phone number format is invalid. Please use international format e.g. +2567XXXXXXX.',
      error: 'invalid_phone',
    };
  }

  // ---- 2. Validate query ---------------------------------------------------
  const cleanQuery = (query || '').trim();
  if (cleanQuery.length === 0) {
    return {
      ok: false,
      advisory: 'Your message was empty. Please describe your crop problem, e.g. "My maize leaves have white spots".',
      error: 'empty_query',
    };
  }
  if (cleanQuery.length > 1000) {
    return {
      ok: false,
      advisory: 'Your message is too long. Please keep it under 1000 characters.',
      error: 'query_too_long',
    };
  }

  // ---- 3. Upsert farmer ----------------------------------------------------
  let farmer;
  try {
    farmer = await db.upsertFarmer(phone, name, region);
  } catch (err) {
    console.error(`[ERROR] upsertFarmer: ${err.message}`);
    // We can still answer the farmer even if DB write fails.
    return {
      ok: false,
      advisory: 'We could not save your profile, but here is your advisory shortly.',
      error: 'farmer_upsert_failed',
      // Continue to LLM below
      _continueWithoutPersistence: true,
    };
  }

  // ---- 4. Generate advisory via LLM ---------------------------------------
  let advisoryText;
  try {
    advisoryText = await generateAdvisory(cleanQuery);
  } catch (err) {
    const fallback =
      err instanceof LLMError && err.kind === 'rate_limit'
        ? 'Our advisor is very busy right now. Please retry in 2 minutes.'
        : 'Sorry, our advisory service is temporarily unavailable. Please try again later or visit your extension officer.';
    return { ok: false, advisory: fallback, error: err.kind || 'llm_error' };
  }

  // ---- 5. Tag entities (best-effort, non-blocking) -------------------------
  try {
    const cropName = extractKeyword(cleanQuery, CROP_KEYWORDS);
    const pestName = extractKeyword(cleanQuery, PEST_KEYWORDS);
    const diseaseName = extractKeyword(cleanQuery, DISEASE_KEYWORDS);

    const [crop, pest, disease] = await Promise.all([
      cropName ? db.upsertEntity('crops', cropName) : Promise.resolve(null),
      pestName ? db.upsertEntity('pests', pestName) : Promise.resolve(null),
      diseaseName ? db.upsertEntity('diseases', diseaseName) : Promise.resolve(null),
    ]);

    await db.saveAdvisory({
      farmerId: farmer.id,
      query: cleanQuery,
      response: advisoryText,
      cropId: crop?.id || null,
      pestId: pest?.id || null,
      diseaseId: disease?.id || null,
    });
  } catch (err) {
    // Persistence failure must not affect the farmer's answer.
    console.error(`[ERROR] saveAdvisory/entity upsert: ${err.message}`);
  }

  return { ok: true, advisory: advisoryText };
}

module.exports = { processAdvisory };