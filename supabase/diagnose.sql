-- ============================================================
-- NUTRILENS DIAGNOSTIC QUERIES
-- Run this in Supabase Dashboard → SQL Editor
-- Copy ALL output and paste back to Claude
-- ============================================================

-- 1. Which tables exist?
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- 2. Row counts for each table
SELECT 'profiles' AS table_name, COUNT(*) AS rows FROM profiles
UNION ALL SELECT 'foods', COUNT(*) FROM foods
UNION ALL SELECT 'meals', COUNT(*) FROM meals
UNION ALL SELECT 'meal_items', COUNT(*) FROM meal_items
UNION ALL SELECT 'weight_logs', COUNT(*) FROM weight_logs;

-- 3. Your profile (replace YOUR_EMAIL below with your actual email)
SELECT
  id,
  name,
  email,
  gender,
  height_cm,
  weight_kg,
  goal,
  activity_level,
  daily_calorie_target,
  daily_protein_target,
  daily_carbs_target,
  daily_fat_target,
  onboarding_completed,
  created_at
FROM profiles
ORDER BY created_at DESC
LIMIT 5;

-- 4. RLS policies on foods table (search reads foods)
SELECT schemaname, tablename, policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'foods';

-- 5. Check foods table has Hebrew/Arabic/German/Chinese names
SELECT
  COUNT(*) FILTER (WHERE name_he IS NOT NULL AND name_he <> '') AS hebrew_rows,
  COUNT(*) FILTER (WHERE name_ar IS NOT NULL AND name_ar <> '') AS arabic_rows,
  COUNT(*) FILTER (WHERE name_de IS NOT NULL AND name_de <> '') AS german_rows,
  COUNT(*) FILTER (WHERE name_zh IS NOT NULL AND name_zh <> '') AS chinese_rows,
  COUNT(*) AS total
FROM foods;

-- 6. Sample English search to confirm foods table works
SELECT id, name_en, calories_per_100g
FROM foods
WHERE name_en ILIKE '%egg%'
LIMIT 5;

-- 7. Does Hebrew search find anything if name_he had data?
SELECT id, name_en, name_he
FROM foods
WHERE name_he ILIKE '%ביצה%'
LIMIT 5;

-- 8. Check storage bucket setup
SELECT id, name, public
FROM storage.buckets
WHERE id = 'meal-photos';
