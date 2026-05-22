// Caches AI-generated meal/workout plans in the ai_plans table so we don't
// burn an API call every time the Plan screen opens.
// One plan per user per language per day.
import { supabase } from './supabase';
import type { AIPlan } from './gemini';

const PLAN_TYPE = 'daily_meal_workout';

// YYYY-MM-DD in local time (matches Postgres date column)
function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Returns today's active plan in the given language, or null if none exists.
export async function loadActivePlan(
  userId: string,
  language: string,
): Promise<AIPlan | null> {
  if (!userId) return null;

  const { data, error } = await supabase
    .from('ai_plans')
    .select('plan_data, generated_at, language, week_start_date')
    .eq('user_id', userId)
    .eq('plan_type', PLAN_TYPE)
    .eq('is_active', true)
    .eq('language', language)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  // Only reuse if the active plan was generated today (local date).
  // week_start_date is set to today's date when we save, so we check that.
  if (data.week_start_date !== todayStr()) return null;

  return data.plan_data as AIPlan;
}

// Marks previous active plans inactive and inserts the new one as active.
// Errors are swallowed — caching is best-effort, never blocks the user.
export async function saveActivePlan(
  userId: string,
  language: string,
  plan: AIPlan,
): Promise<void> {
  if (!userId) return;

  try {
    await supabase
      .from('ai_plans')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('plan_type', PLAN_TYPE)
      .eq('is_active', true);

    await supabase.from('ai_plans').insert({
      user_id: userId,
      plan_type: PLAN_TYPE,
      plan_data: plan,
      generated_at: new Date().toISOString(),
      week_start_date: todayStr(),
      is_active: true,
      language,
    });
  } catch (err) {
    // Cache failures must not break the user-facing flow
    console.warn('Plan cache save failed:', err);
  }
}
