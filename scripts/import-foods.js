#!/usr/bin/env node
/**
 * Food database importer — Node.js version (no Python needed).
 * Downloads Open Food Facts data and imports to Supabase.
 *
 * Run from the project root:
 *   node scripts/import-foods.js
 *
 * Requires env vars (loaded from .env automatically):
 *   EXPO_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const zlib = require('zlib');
const readline = require('readline');
const { randomUUID } = require('crypto');

// ── Load .env manually (no dotenv dependency needed) ──────────────────────────
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8')
    .split('\n')
    .forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eq = trimmed.indexOf('=');
      if (eq === -1) return;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    });
}

const SUPABASE_URL = (process.env.EXPO_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('ERROR: Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const TMP_DIR = path.join(__dirname, '..', 'tmp');
const GZ_FILE = path.join(TMP_DIR, 'off_products.csv.gz');
const CSV_FILE = path.join(TMP_DIR, 'off_products.csv');
const OFF_URL =
  'https://static.openfoodfacts.org/data/en.openfoodfacts.org.products.csv.gz';

const TARGET_COUNTRIES = new Set([
  'en:israel', 'en:united-states', 'en:germany', 'en:france',
  'en:united-kingdom', 'en:spain', 'en:italy', 'en:netherlands',
]);

// ── Helpers ───────────────────────────────────────────────────────────────────

function safeFloat(v, def = 0) {
  const f = parseFloat(v);
  return Number.isFinite(f) && f >= 0 && f <= 9999 ? f : def;
}

function round(v, decimals = 2) {
  return Math.round(v * 10 ** decimals) / 10 ** decimals;
}

function contains(text, keywords) {
  return keywords.some((k) => text.includes(k));
}

// ── Download ──────────────────────────────────────────────────────────────────

function download(url, dest) {
  return new Promise((resolve, reject) => {
    console.log('Downloading Open Food Facts data (~1 GB). This takes 5-15 min...');
    const file = fs.createWriteStream(dest);
    let downloaded = 0;
    const req = https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        fs.unlinkSync(dest);
        return download(res.headers.location, dest).then(resolve).catch(reject);
      }
      res.on('data', (chunk) => {
        downloaded += chunk.length;
        process.stdout.write(`\r  ${(downloaded / 1e6).toFixed(1)} MB downloaded`);
      });
      res.pipe(file);
      file.on('finish', () => { file.close(); console.log('\nDownload complete.'); resolve(); });
    });
    req.on('error', reject);
    file.on('error', reject);
  });
}

// ── Decompress ────────────────────────────────────────────────────────────────

function decompress(gz, csv) {
  return new Promise((resolve, reject) => {
    console.log('Extracting (this may take a few minutes)...');
    const input = fs.createReadStream(gz);
    const output = fs.createWriteStream(csv);
    input.pipe(zlib.createGunzip()).pipe(output);
    output.on('finish', () => { console.log('Extraction complete.'); resolve(); });
    output.on('error', reject);
    input.on('error', reject);
  });
}

// ── Parse TSV line into columns ───────────────────────────────────────────────

function parseTSVLine(line) {
  const cols = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQuotes = !inQuotes; continue; }
    if (c === '\t' && !inQuotes) { cols.push(cur); cur = ''; continue; }
    cur += c;
  }
  cols.push(cur);
  return cols;
}

// ── Upload batch to Supabase ──────────────────────────────────────────────────

async function uploadBatch(rows) {
  const body = JSON.stringify(rows);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/foods`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=ignore-duplicates',
    },
    body,
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Supabase ${res.status}: ${txt.slice(0, 200)}`);
  }
}

// ── Sleep ─────────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

  if (!fs.existsSync(CSV_FILE)) {
    if (!fs.existsSync(GZ_FILE)) await download(OFF_URL, GZ_FILE);
    await decompress(GZ_FILE, CSV_FILE);
  } else {
    console.log('CSV already extracted — skipping download/decompress.');
  }

  console.log('Parsing and filtering foods...');

  const rl = readline.createInterface({
    input: fs.createReadStream(CSV_FILE, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  let headers = null;
  const foods = [];
  let rowNum = 0;
  let skipped = 0;
  const MAX_FOODS = 280000;

  for await (const line of rl) {
    if (!headers) { headers = parseTSVLine(line); continue; }
    rowNum++;
    if (rowNum % 100000 === 0) console.log(`  Row ${rowNum.toLocaleString()} — kept ${foods.length.toLocaleString()}`);
    if (foods.length >= MAX_FOODS) break;

    const cols = parseTSVLine(line);
    const get = (col) => (cols[headers.indexOf(col)] || '').trim();

    const name = get('product_name').slice(0, 200);
    if (!name) { skipped++; continue; }

    const cal  = safeFloat(get('energy-kcal_100g'), -1);
    const pro  = safeFloat(get('proteins_100g'), -1);
    const carb = safeFloat(get('carbohydrates_100g'), -1);
    const fat  = safeFloat(get('fat_100g'), -1);

    if ([cal, pro, carb, fat].some((v) => v < 0)) { skipped++; continue; }

    const countries = get('countries_tags').toLowerCase();
    const inTarget = [...TARGET_COUNTRIES].some((c) => countries.includes(c));
    if (!inTarget && foods.length > 80000) { skipped++; continue; }

    const ingredients = (get('ingredients_text') + get('allergens')).toLowerCase();
    const labels = get('labels_tags').toLowerCase();

    foods.push({
      id: randomUUID(),
      barcode: get('code') || null,
      name_en: name,
      name_he: null, name_ar: null, name_de: null, name_zh: null,
      brand: get('brands').slice(0, 100) || null,
      category: get('categories').slice(0, 100) || null,
      calories_per_100g: round(cal, 1),
      protein_per_100g: round(pro, 2),
      carbs_per_100g: round(carb, 2),
      fat_per_100g: round(fat, 2),
      fiber_per_100g: round(safeFloat(get('fiber_100g')), 2),
      sugar_per_100g: round(safeFloat(get('sugars_100g')), 2),
      sodium_per_100g: round(safeFloat(get('sodium_100g')), 3),
      contains_gluten:  contains(ingredients, ['gluten', 'wheat', 'barley']),
      contains_nuts:    contains(ingredients, ['nuts', 'almond', 'cashew', 'walnut', 'hazelnut']),
      contains_dairy:   contains(ingredients, ['milk', 'dairy', 'lactose', 'cheese', 'butter']),
      contains_eggs:    ingredients.includes('egg'),
      contains_soy:     contains(ingredients, ['soy', 'soja', 'soya']),
      contains_fish:    contains(ingredients, ['fish', 'salmon', 'tuna', 'cod']),
      contains_sesame:  contains(ingredients, ['sesame', 'tahini']),
      is_vegan:         labels.includes('vegan'),
      is_vegetarian:    labels.includes('vegetarian'),
      is_kosher:        labels.includes('kosher'),
      is_halal:         labels.includes('halal'),
      source: 'open_food_facts',
    });
  }

  console.log(`\nProcessed: ${foods.length.toLocaleString()} kept, ${skipped.toLocaleString()} skipped`);
  console.log('Uploading to Supabase in batches of 500...\n');

  const BATCH = 500;
  let success = 0;
  let failed = 0;

  for (let i = 0; i < foods.length; i += BATCH) {
    const batch = foods.slice(i, i + BATCH);
    try {
      await uploadBatch(batch);
      success += batch.length;
    } catch (err) {
      failed += batch.length;
      console.error(`  Batch ${Math.floor(i / BATCH)} failed: ${err.message}`);
    }
    if (i % 10000 === 0) {
      process.stdout.write(`\r  Uploaded ${success.toLocaleString()} / ${foods.length.toLocaleString()}`);
    }
    await sleep(50); // gentle rate limiting
  }

  console.log(`\n\nDone! ${success.toLocaleString()} foods uploaded, ${failed.toLocaleString()} failed.`);
  console.log('Check Supabase Table Editor → foods to confirm.');
}

main().catch((err) => { console.error('Fatal error:', err); process.exit(1); });
