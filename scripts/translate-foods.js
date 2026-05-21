#!/usr/bin/env node
/**
 * Translates food names in the Supabase 'foods' table using Gemini API.
 * Translates English → Hebrew, Arabic, German, Chinese.
 *
 * Run: node scripts/translate-foods.js
 *
 * Progress is saved to tmp/translate-progress.json so you can stop (Ctrl+C)
 * and resume anytime — it skips already-translated rows automatically.
 *
 * Timing estimate:
 *   - Gemini free tier: ~12 requests/min (20 foods each) = ~240 foods/min
 *   - 280k foods ≈ 19-20 hours total (can be split across multiple sessions)
 *   - Tip: run overnight, Ctrl+C in the morning, resume tomorrow.
 */

const fs   = require('fs');
const path = require('path');
const https = require('https');

// ── Load .env ──────────────────────────────────────────────────────────────────
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return;
    const eq = t.indexOf('=');
    if (eq === -1) return;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  });
}

const SUPABASE_URL = (process.env.EXPO_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const GEMINI_KEY   = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';

if (!SUPABASE_URL || !SUPABASE_KEY || !GEMINI_KEY) {
  console.error('ERROR: Missing EXPO_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or EXPO_PUBLIC_GEMINI_API_KEY in .env');
  process.exit(1);
}

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`;

const TMP_DIR      = path.join(__dirname, '..', 'tmp');
const PROGRESS_FILE = path.join(TMP_DIR, 'translate-progress.json');
const BATCH_SIZE   = 20;    // food names per Gemini request
const PAGE_SIZE    = 1000;  // rows fetched from Supabase per page
const RPM_LIMIT    = 12;    // requests per minute (free tier = 15, stay a bit under)
const MS_PER_REQ   = Math.ceil(60000 / RPM_LIMIT); // ~5000ms between requests

if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

// ── Progress tracking ──────────────────────────────────────────────────────────

function loadProgress() {
  try {
    return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
  } catch {
    return { translatedIds: [], lastOffset: 0, total: 0, startTime: Date.now() };
  }
}

function saveProgress(p) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(p, null, 2));
}

// ── Supabase helpers ───────────────────────────────────────────────────────────

async function fetchUntranslatedPage(offset, limit) {
  const url = `${SUPABASE_URL}/rest/v1/foods?name_he=is.null&select=id,name_en&order=id&offset=${offset}&limit=${limit}`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) throw new Error(`Supabase fetch error ${res.status}: ${await res.text()}`);
  return res.json();
}

async function countUntranslated() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/foods?name_he=is.null&select=id`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Prefer: 'count=exact',
      'Range-Unit': 'items',
      Range: '0-0',
    },
  });
  const range = res.headers.get('content-range') || '';
  const m = range.match(/\/(\d+)$/);
  return m ? parseInt(m[1], 10) : 0;
}

async function updateTranslations(rows) {
  // Supabase doesn't support bulk upsert with different values per row in one call,
  // so we batch using the upsert endpoint with individual updates via a single JSON array.
  // We'll PATCH each row individually but in parallel batches of 10.
  const PARALLEL = 10;
  for (let i = 0; i < rows.length; i += PARALLEL) {
    const chunk = rows.slice(i, i + PARALLEL);
    await Promise.all(
      chunk.map((row) =>
        fetch(`${SUPABASE_URL}/rest/v1/foods?id=eq.${encodeURIComponent(row.id)}`, {
          method: 'PATCH',
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({
            name_he: row.name_he,
            name_ar: row.name_ar,
            name_de: row.name_de,
            name_zh: row.name_zh,
          }),
        })
      )
    );
  }
}

// ── Gemini translation ─────────────────────────────────────────────────────────

const TRANSLATION_PROMPT = (names) => `You are a food name translator.
Translate the following English food product names into Hebrew, Arabic, German, and Chinese.
Keep translations SHORT — just the food name, no extra explanation.
For branded products or proper nouns with no translation, keep the original English.

Return ONLY a JSON array — no markdown, no explanation — in this exact format:
[
  {"en": "...", "he": "...", "ar": "...", "de": "...", "zh": "..."},
  ...
]

Food names to translate:
${names.map((n, i) => `${i + 1}. ${n}`).join('\n')}`;

async function translateBatch(names) {
  const body = JSON.stringify({
    contents: [{ parts: [{ text: TRANSLATION_PROMPT(names) }] }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 2000 },
  });

  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });

  if (res.status === 429 || res.status === 503) {
    // Rate limited — wait 60s and retry once
    console.log('  Rate limited, waiting 60s...');
    await sleep(60000);
    return translateBatch(names);
  }

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Gemini error ${res.status}: ${txt.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  // Strip markdown fences if present
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) throw new Error('Not an array');
    return parsed;
  } catch {
    console.warn('  Gemini returned invalid JSON for this batch — skipping batch.');
    return names.map((en) => ({ en, he: null, ar: null, de: null, zh: null }));
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function eta(done, total, startTime) {
  if (done === 0) return '?';
  const elapsed = Date.now() - startTime;
  const rate = done / elapsed; // per ms
  const remaining = (total - done) / rate;
  const h = Math.floor(remaining / 3600000);
  const m = Math.floor((remaining % 3600000) / 60000);
  return `${h}h ${m}m`;
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== NutriLens Food Translator ===\n');

  const progress = loadProgress();
  if (!progress.startTime) progress.startTime = Date.now();

  console.log('Counting untranslated foods...');
  const total = await countUntranslated();
  progress.total = total;
  console.log(`  ${total.toLocaleString()} foods still need translation.\n`);

  if (total === 0) {
    console.log('All foods are already translated!');
    return;
  }

  console.log(`Settings: ${BATCH_SIZE} foods/request, ${RPM_LIMIT} req/min`);
  const hoursEst = Math.ceil((total / BATCH_SIZE) / RPM_LIMIT / 60);
  console.log(`Estimated time: ~${hoursEst} hour(s) for all ${total.toLocaleString()} foods.`);
  console.log('You can Ctrl+C anytime and resume later — progress is saved.\n');

  let translatedThisSession = 0;
  let offset = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    // Fetch a page of untranslated foods
    const page = await fetchUntranslatedPage(0, PAGE_SIZE); // always offset 0 — translated ones drop out
    if (!page || page.length === 0) break;

    // Split page into batches of BATCH_SIZE
    for (let i = 0; i < page.length; i += BATCH_SIZE) {
      const chunk = page.slice(i, i + BATCH_SIZE);
      const names = chunk.map((r) => r.name_en);

      const t0 = Date.now();

      let translations;
      try {
        translations = await translateBatch(names);
      } catch (err) {
        console.error(`  Translation error: ${err.message} — skipping batch`);
        await sleep(MS_PER_REQ);
        continue;
      }

      // Map translations back to rows
      const updates = chunk.map((row, idx) => {
        const tr = translations[idx] || {};
        return {
          id: row.id,
          name_he: tr.he || null,
          name_ar: tr.ar || null,
          name_de: tr.de || null,
          name_zh: tr.zh || null,
        };
      });

      try {
        await updateTranslations(updates);
      } catch (err) {
        console.error(`  Supabase update error: ${err.message}`);
      }

      translatedThisSession += chunk.length;
      const remaining = total - translatedThisSession;
      const etaStr = eta(translatedThisSession, total, progress.startTime);

      process.stdout.write(
        `\r  Translated: ${translatedThisSession.toLocaleString()} | Remaining: ${Math.max(0, remaining).toLocaleString()} | ETA: ${etaStr}   `
      );

      saveProgress({ ...progress, lastOffset: offset, translatedIds: [] });

      // Rate limiting — ensure we don't exceed RPM_LIMIT
      const elapsed = Date.now() - t0;
      const wait = Math.max(0, MS_PER_REQ - elapsed);
      if (wait > 0) await sleep(wait);
    }

    offset += PAGE_SIZE;
  }

  console.log('\n\nAll done! All foods translated.');
  if (fs.existsSync(PROGRESS_FILE)) fs.unlinkSync(PROGRESS_FILE);
}

main().catch((err) => {
  console.error('\nFatal error:', err);
  process.exit(1);
});
