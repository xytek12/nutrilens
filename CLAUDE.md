# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Stack

- **Expo SDK 54** / React Native 0.81.5 — New Architecture enabled (`newArchEnabled: true`)
- **Expo Router v6** — file-based routing, typed routes enabled (`typedRoutes: true`)
- **Supabase** — auth (AsyncStorage persistence), Postgres DB, Storage bucket `meal-photos`
- **Zustand** — state management; stores live in `src/stores/`
- **i18next** — 5 languages (en, he, ar, de, zh); translation files in `locales/{lang}/translation.json`

## Commands

```bash
npm run start:tunnel  # Expo Go via ngrok tunnel (phone on a different network)
npm run lint          # ESLint on .ts and .tsx files
npm run type-check    # tsc --noEmit — run before committing
```

## Styling

Use `StyleSheet.create()` from React Native — **NativeWind is installed but not used**. Do not apply Tailwind class names.

Design-system colors: background `#F8FAF8`, primary green `#2DB04B`, light green `#E8F5EC`, text `#1A1A1A`, secondary `#6B7280`, orange `#F97316`, yellow `#EAB308`.

## Environment variables

All client-side keys require the `EXPO_PUBLIC_` prefix. `SUPABASE_SERVICE_ROLE_KEY` is for Node scripts only — never import it in app code.

## AI meal analysis

Use `analyzeMealPhoto(base64)` from `src/lib/gemini.ts`. It handles the model cascade (`gemini-2.5-flash` → `gemini-1.5-flash` → OpenAI `gpt-4o-mini`) internally. Do not call the Gemini or OpenAI APIs directly elsewhere in the app.

## Routing conventions

Route groups `(auth)/` and `(tabs)/` do not appear in URLs. The dashboard (`app/(tabs)/index.tsx`) redirects to `/(auth)/onboarding/step1` when `profile.onboarding_completed !== true` — this is intentional, not a bug.

## i18n

Translation keys are nested: `t('dashboard.greeting_morning', { name })`. When adding a new key, update all five locale files (`locales/en`, `he`, `ar`, `de`, `zh`) to keep them in sync.

## AI meal plan

Use `generatePlan(profileInput)` from `src/lib/gemini.ts` — same Gemini→OpenAI cascade as meal analysis. Plans are cached in the `ai_plans` table (one per user per language per day) via `src/lib/planCache.ts`. The Plan screen reads cache first, only calls AI on first open of the day or when the user taps "Generate New Plan". Do not bypass the cache unless the user explicitly asks for fresh output.

## Food search (multilingual)

The `foods` table has 280k English-only rows (`name_he/ar/de/zh` are all NULL — do not "fix" this by re-querying those columns). `searchFoods()` translates non-English queries to English before hitting the DB using a built-in dictionary first, then MyMemory API as fallback. Add new common terms to `FOOD_DICT` in `src/lib/foodSearch.ts` when users complain a Hebrew word doesn't search.

## Session start protocol

At the start of every session, before doing real work:

1. Read `C:\Users\gal\.claude\projects\C--Users-gal-code\memory\MEMORY.md` and the linked project memory — these track Done / Pending / Standby.
2. Run `git status` to see uncommitted work.
3. If a task list exists from a prior session, surface it briefly so Gal can pick what's next.
4. **Do NOT auto-resume** any task — ask Gal what he wants to focus on.

When you finish a feature, **update the project memory's Done/Pending lists** so the next session sees current state. Stale memory wastes tokens re-discovering what's done.

## Git workflow reminder

After meaningful changes (new feature, schema migration, bugfix), remind Gal: *"Want to commit and push to GitHub?"* — do NOT auto-commit. Offer a one-line commit message based on the actual diff. The remote is `https://github.com/xytek12/nutrilens`.

## Plan-mode persistence

If Gal enters plan mode and approves a plan with ExitPlanMode, append the approved plan to the project memory file before executing the first step. If the session ends mid-plan, the next session can resume by reading it.

## Token efficiency

- Don't re-read a file you just edited — Edit/Write would have errored if it failed.
- Don't restate things from memory back to Gal — he wrote them.
- Don't summarize at the end of every turn — the diff speaks for itself.
- Lead with the answer, then context only if non-obvious.
- Search before asking: a 30-second grep beats a clarifying question.

## Project-specific gotchas (learned the hard way)

- **PostgreSQL** does NOT support `CREATE POLICY IF NOT EXISTS`. Use `DROP POLICY IF EXISTS … ; CREATE POLICY …`.
- **`SafeAreaView`** must come from `react-native-safe-area-context`, NOT from `react-native`.
- **`zh` locale** matches the structure of `en/he/ar/de` — if you see `"meal"` (singular) anywhere, it's stale.
- **PostgREST `.or()` clauses** break on unescaped commas / parens / quotes — sanitize before building the query string.
- **`image_url` column** exists in `foods` but is NULL for all 280k rows; it is intentionally excluded from `FOOD_SELECT`. Use `fetchFoodImage(barcode)` then `fetchFoodImageByName(name_en)` for images on demand.
- **`weight_logs`** writes go through the Progress screen's Log Weight modal. Always update `profiles.weight_kg` alongside so dashboard/plan reflect the latest.
- **Daily targets** live on `profiles.daily_*_target`. The separate `daily_targets` table is currently unused — leave it alone unless implementing per-day historical tracking.
