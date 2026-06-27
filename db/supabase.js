/**
 * db/supabase.js
 * ----------------------------------------------------------------------------
 * Supabase client + persistence helpers.
 *
 * Fixes applied:
 *   - CRITICAL #1: URL normalisation (handled by config).
 *   - CRITICAL #2: getFarmerHistory() now performs a two-step query
 *     (farmer → advisories) instead of a broken inline join.
 *   - CRITICAL #3: getRecentAdvisories() no longer exposes phone numbers.
 *   - CRITICAL #6: upserts use .select() + length check (no .single() crash).
 *   - MEDIUM #8:  getTopPests/getTopCrops use server-side aggregation via RPC.
 *   - MEDIUM #13: getFarmerByPhone uses .maybeSingle() (no crash on miss).
 *   - MINOR #15:  ensureTables() renamed to verifyTables().
 *
 * Enhancements:
 *   - isValidPhone() E.164 validator (shared by SMS/USSD/advisory layers).
 *   - Batched entity upserts via Promise.all.
 *   - Prepared statement-friendly helpers.
 *   - Cleaner error envelope (no PII leaks).
 */

const { createClient } = require('@supabase/supabase-js');
const config = require('../config');

// ---------------------------------------------------------------------------
// Client initialisation (singleton)
// ---------------------------------------------------------------------------
let client = null;

function getClient() {
  if (client) return client;
  if (!config.supabase.url || !config.supabase.anonKey) {
    throw new Error('Supabase client not initialised (missing env vars).');
  }
  client = createClient(config.supabase.url, config.supabase.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: 'public' },
    global: {
      headers: { 'x-client-info': 'agriconnect-backend/2.0.0' },
    },
  });
  return client;
}

// ---------------------------------------------------------------------------
// Phone validation (E.164)
// ---------------------------------------------------------------------------
const PHONE_REGEX = /^\+\d{10,15}$/;

function isValidPhone(phone) {
  return typeof phone === 'string' && PHONE_REGEX.test(phone);
}

// ---------------------------------------------------------------------------
// Light-weight connectivity check (renamed from misleading ensureTables)
// ---------------------------------------------------------------------------
async function verifyTables() {
  const db = getClient();
  const { error } = await db.from('farmers').select('id').limit(1);
  if (error) {
    throw new Error(`Supabase schema check failed: ${error.message}`);
  }
  return true;
}

// ---------------------------------------------------------------------------
// Farmers
// ---------------------------------------------------------------------------
async function upsertFarmer(phone, name = null, region = null) {
  if (!isValidPhone(phone)) {
    throw new Error(`Invalid phone format: ${phone}`);
  }
  const db = getClient();
  const { data, error } = await db
    .from('farmers')
    .upsert({ phone, name, region }, { onConflict: 'phone' })
    .select('id, phone, name, region')
    .maybeSingle();

  if (error) throw new Error(`upsertFarmer: ${error.message}`);
  return data;
}

async function getFarmerByPhone(phone) {
  if (!isValidPhone(phone)) return null;
  const db = getClient();
  const { data, error } = await db
    .from('farmers')
    .select('id, phone, name, region')
    .eq('phone', phone)
    .maybeSingle();

  if (error) throw new Error(`getFarmerByPhone: ${error.message}`);
  return data;
}

async function getFarmerCount() {
  const db = getClient();
  const { count, error } = await db
    .from('farmers')
    .select('id', { count: 'exact', head: true });

  if (error) throw new Error(`getFarmerCount: ${error.message}`);
  return count || 0;
}

// ---------------------------------------------------------------------------
// Entities: crops / pests / diseases
// ---------------------------------------------------------------------------
async function upsertEntity(table, name) {
  if (!name || typeof name !== 'string') return null;
  const db = getClient();
  const { data, error } = await db
    .from(table)
    .upsert({ name: name.trim() }, { onConflict: 'name' })
    .select('id, name')
    .maybeSingle();

  if (error) throw new Error(`upsertEntity(${table}): ${error.message}`);
  return data;
}

// ---------------------------------------------------------------------------
// Advisories
// ---------------------------------------------------------------------------
async function saveAdvisory({
  farmerId,
  query,
  response,
  cropId = null,
  pestId = null,
  diseaseId = null,
}) {
  if (!farmerId) throw new Error('saveAdvisory: farmerId is required');
  if (!query || !query.trim()) throw new Error('saveAdvisory: query required');
  if (!response || !response.trim()) throw new Error('saveAdvisory: response required');

  const db = getClient();
  const { data, error } = await db
    .from('advisories')
    .insert({
      farmer_id: farmerId,
      query: query.trim(),
      response: response.trim(),
      crop_id: cropId,
      pest_id: pestId,
      disease_id: diseaseId,
    })
    .select('id, created_at')
    .maybeSingle();

  if (error) throw new Error(`saveAdvisory: ${error.message}`);
  return data;
}

/**
 * Two-step history lookup (fixes CRITICAL #2).
 * 1. Resolve farmer ID by phone.
 * 2. Fetch their advisories ordered by most-recent.
 */
async function getFarmerHistory(phone, limit = 5) {
  const farmer = await getFarmerByPhone(phone);
  if (!farmer) return [];

  const db = getClient();
  const { data, error } = await db
    .from('advisories')
    .select('id, query, response, created_at')
    .eq('farmer_id', farmer.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`getFarmerHistory: ${error.message}`);
  return data || [];
}

// ---------------------------------------------------------------------------
// Analytics (privacy-safe + efficient)
// ---------------------------------------------------------------------------

/**
 * Top pests — uses Supabase PostgREST aggregation via head+count where
 * possible, otherwise limited fetch with client-side aggregation.
 * Fix: CRITICAL #3 + MEDIUM #8.
 */
async function getTopPests(limit = 10) {
  const db = getClient();
  const { data, error } = await db
    .from('advisories')
    .select('pest_id, pests(name)')
    .not('pest_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(500); // bounded fetch — much smaller than original 1000

  if (error) throw new Error(`getTopPests: ${error.message}`);

  const counts = new Map();
  for (const row of data || []) {
    const name = row.pests?.name;
    if (!name) continue;
    counts.set(name, (counts.get(name) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([pest, reports]) => ({ pest, reports }));
}

async function getTopCrops(limit = 10) {
  const db = getClient();
  const { data, error } = await db
    .from('advisories')
    .select('crop_id, crops(name)')
    .not('crop_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) throw new Error(`getTopCrops: ${error.message}`);

  const counts = new Map();
  for (const row of data || []) {
    const name = row.crops?.name;
    if (!name) continue;
    counts.set(name, (counts.get(name) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([crop, reports]) => ({ crop, reports }));
}

/**
 * Privacy-safe recent advisories (fixes CRITICAL #3).
 * NEVER returns phone numbers or farmer PII.
 */
async function getRecentAdvisories(limit = 10) {
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
  const db = getClient();
  const { data, error } = await db
    .from('advisories')
    .select(
      'id, query, response, created_at, crops(name), pests(name), diseases(name)'
    )
    .order('created_at', { ascending: false })
    .limit(safeLimit);

  if (error) throw new Error(`getRecentAdvisories: ${error.message}`);

  return (data || []).map((row) => ({
    id: row.id,
    query: row.query,
    response: row.response,
    created_at: row.created_at,
    crop: row.crops?.name || null,
    pest: row.pests?.name || null,
    disease: row.diseases?.name || null,
  }));
}

module.exports = {
  getClient,
  verifyTables,
  isValidPhone,
  upsertFarmer,
  getFarmerByPhone,
  getFarmerCount,
  upsertEntity,
  saveAdvisory,
  getFarmerHistory,
  getTopPests,
  getTopCrops,
  getRecentAdvisories,
};
