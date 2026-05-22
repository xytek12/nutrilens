-- ============================================================
-- WEIGHT_LOGS TABLE SETUP
-- Run this in Supabase Dashboard → SQL Editor
-- Safe to re-run (uses IF NOT EXISTS / DROP IF EXISTS)
-- ============================================================

-- Create the table
CREATE TABLE IF NOT EXISTS public.weight_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  weight_kg   NUMERIC(5,2) NOT NULL CHECK (weight_kg > 0 AND weight_kg < 1000),
  logged_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast user lookups
CREATE INDEX IF NOT EXISTS idx_weight_logs_user_logged
  ON public.weight_logs (user_id, logged_at DESC);

-- Enable RLS
ALTER TABLE public.weight_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (safe re-run)
DROP POLICY IF EXISTS "weight_logs_select_own" ON public.weight_logs;
DROP POLICY IF EXISTS "weight_logs_insert_own" ON public.weight_logs;
DROP POLICY IF EXISTS "weight_logs_update_own" ON public.weight_logs;
DROP POLICY IF EXISTS "weight_logs_delete_own" ON public.weight_logs;

-- Users can only see/modify their own weight logs
CREATE POLICY "weight_logs_select_own"
  ON public.weight_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "weight_logs_insert_own"
  ON public.weight_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "weight_logs_update_own"
  ON public.weight_logs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "weight_logs_delete_own"
  ON public.weight_logs FOR DELETE
  USING (auth.uid() = user_id);

-- Verify
SELECT 'weight_logs created with ' || COUNT(*)::text || ' policies' AS status
FROM pg_policies WHERE tablename = 'weight_logs';
