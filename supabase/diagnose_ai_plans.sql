-- Schema of ai_plans and daily_targets tables
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('ai_plans', 'daily_targets')
ORDER BY table_name, ordinal_position;

-- RLS policies on these tables
SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename IN ('ai_plans', 'daily_targets');

-- Row counts
SELECT 'ai_plans' AS t, COUNT(*) AS rows FROM ai_plans
UNION ALL SELECT 'daily_targets', COUNT(*) FROM daily_targets;
