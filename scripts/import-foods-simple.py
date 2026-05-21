#!/usr/bin/env python3
"""
Simplified food database importer.
Downloads Open Food Facts data and imports to Supabase.
Run: python3 scripts/import-foods-simple.py
"""

import os, json, csv, uuid, urllib.request, urllib.error, gzip, shutil, time

SUPABASE_URL = os.environ.get('EXPO_PUBLIC_SUPABASE_URL', '').rstrip('/')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERROR: Set EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env")
    print("Then run: source .env && python3 scripts/import-foods-simple.py")
    exit(1)

os.makedirs('tmp', exist_ok=True)
CSV_GZ = 'tmp/off_products.csv.gz'
CSV_FILE = 'tmp/off_products.csv'

# Download if not already present
if not os.path.exists(CSV_FILE):
    if not os.path.exists(CSV_GZ):
        print("Downloading Open Food Facts data (~1GB)... This takes 5-10 min.")
        url = 'https://static.openfoodfacts.org/data/en.openfoodfacts.org.products.csv.gz'
        urllib.request.urlretrieve(url, CSV_GZ)
        print("Download complete.")
    print("Extracting...")
    with gzip.open(CSV_GZ, 'rb') as f_in:
        with open(CSV_FILE, 'wb') as f_out:
            shutil.copyfileobj(f_in, f_out)
    print("Extraction complete.")

TARGET_COUNTRIES = {'en:israel','en:united-states','en:germany','en:france',
                    'en:united-kingdom','en:spain','en:italy','en:netherlands'}

def safe_float(v, d=0.0):
    try:
        f = float(v)
        return f if 0 <= f <= 9999 else d
    except: return d

print("Processing foods...")
foods = []
skipped = 0

with open(CSV_FILE, encoding='utf-8', errors='replace') as f:
    reader = csv.DictReader(f, delimiter='\t')
    for i, row in enumerate(reader):
        if i % 100000 == 0: print(f"  Row {i:,} — kept {len(foods):,}")
        if len(foods) >= 280000: break

        name = (row.get('product_name') or '').strip()[:200]
        if not name: skipped += 1; continue

        cal = safe_float(row.get('energy-kcal_100g'), -1)
        pro = safe_float(row.get('proteins_100g'), -1)
        carb = safe_float(row.get('carbohydrates_100g'), -1)
        fat = safe_float(row.get('fat_100g'), -1)

        if any(v < 0 for v in [cal, pro, carb, fat]):
            skipped += 1; continue

        countries = (row.get('countries_tags') or '').lower()
        if not any(c in countries for c in TARGET_COUNTRIES) and len(foods) > 80000:
            skipped += 1; continue

        ingredients = ((row.get('ingredients_text') or '') +
                       (row.get('allergens') or '')).lower()

        foods.append({
            'id': str(uuid.uuid4()),
            'barcode': (row.get('code') or None),
            'name_en': name,
            'name_he': None, 'name_ar': None, 'name_de': None, 'name_zh': None,
            'brand': (row.get('brands') or '')[:100] or None,
            'category': (row.get('categories') or '')[:100] or None,
            'calories_per_100g': round(cal, 1),
            'protein_per_100g': round(pro, 2),
            'carbs_per_100g': round(carb, 2),
            'fat_per_100g': round(fat, 2),
            'fiber_per_100g': round(safe_float(row.get('fiber_100g')), 2),
            'sugar_per_100g': round(safe_float(row.get('sugars_100g')), 2),
            'sodium_per_100g': round(safe_float(row.get('sodium_100g')), 3),
            'contains_gluten': any(k in ingredients for k in ['gluten','wheat','barley']),
            'contains_nuts': any(k in ingredients for k in ['nuts','almond','cashew','walnut','hazelnut']),
            'contains_dairy': any(k in ingredients for k in ['milk','dairy','lactose','cheese','butter']),
            'contains_eggs': 'egg' in ingredients,
            'contains_soy': any(k in ingredients for k in ['soy','soja','soya']),
            'contains_fish': any(k in ingredients for k in ['fish','salmon','tuna','cod']),
            'contains_sesame': any(k in ingredients for k in ['sesame','tahini']),
            'is_vegan': 'vegan' in (row.get('labels_tags') or '').lower(),
            'is_vegetarian': 'vegetarian' in (row.get('labels_tags') or '').lower(),
            'is_kosher': 'kosher' in (row.get('labels_tags') or '').lower(),
            'is_halal': 'halal' in (row.get('labels_tags') or '').lower(),
            'source': 'open_food_facts',
        })

print(f"Processed: {len(foods):,} kept, {skipped:,} skipped")
print("Uploading to Supabase in batches...")

headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': f'Bearer {SUPABASE_KEY}',
    'Content-Type': 'application/json',
    'Prefer': 'resolution=ignore-duplicates',
}

BATCH = 500
success = failed = 0
for i in range(0, len(foods), BATCH):
    batch = foods[i:i+BATCH]
    data = json.dumps(batch).encode()
    req = urllib.request.Request(f'{SUPABASE_URL}/rest/v1/foods', data=data,
                                  headers=headers, method='POST')
    try:
        urllib.request.urlopen(req, timeout=30)
        success += len(batch)
    except Exception as e:
        failed += len(batch)
        print(f"  Batch {i//BATCH} failed: {e}")

    if i % 10000 == 0:
        print(f"  Uploaded {success:,} / {len(foods):,}")
    time.sleep(0.05)  # Rate limiting

print(f"\nDone! {success:,} foods uploaded, {failed:,} failed.")
print("Check Supabase Table Editor → foods to confirm.")
