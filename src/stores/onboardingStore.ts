import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Goal, ActivityLevel, Gender } from '../types';

export interface OnboardingData {
  name: string;
  birthdate: string;       // 'YYYY-MM-DD'
  gender: Gender | '';
  height_cm: number | null;
  weight_kg: number | null;
  goal: Goal | '';
  activity_level: ActivityLevel | '';
}

export function calculateTargets(d: Partial<OnboardingData>) {
  if (!d.weight_kg || !d.height_cm) return { calories: 2000, protein: 160, carbs: 220, fat: 65 };

  const age = d.birthdate
    ? Math.max(10, Math.floor((Date.now() - new Date(d.birthdate).getTime()) / 31_557_600_000))
    : 30;

  const w = d.weight_kg;
  const h = d.height_cm;
  let bmr: number;
  if (d.gender === 'male')        bmr = 10 * w + 6.25 * h - 5 * age + 5;
  else if (d.gender === 'female') bmr = 10 * w + 6.25 * h - 5 * age - 161;
  else                            bmr = 10 * w + 6.25 * h - 5 * age - 78;

  const mults: Record<ActivityLevel, number> = {
    sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9,
  };
  const tdee = bmr * (d.activity_level ? (mults[d.activity_level as ActivityLevel] ?? 1.375) : 1.375);

  let calories = Math.round(
    d.goal === 'lose' ? tdee - 500 : d.goal === 'gain' ? tdee + 300 : tdee
  );
  const minCal = d.gender === 'female' ? 1200 : 1500;
  calories = Math.max(calories, minCal);

  const protein = Math.round(w * 2.0);
  const fat     = Math.round((calories * 0.25) / 9);
  const carbs   = Math.max(Math.round((calories - protein * 4 - fat * 9) / 4), 50);

  return { calories, protein, carbs, fat };
}

interface OnboardingState extends OnboardingData {
  setField: <K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) => void;
  complete:  (userId: string) => Promise<{ error?: string }>;
  reset:     () => void;
}

const INIT: OnboardingData = {
  name: '', birthdate: '', gender: '', height_cm: null, weight_kg: null, goal: '', activity_level: '',
};

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  ...INIT,

  setField: (key, value) => set({ [key]: value } as any),

  reset: () => set(INIT),

  complete: async (userId) => {
    const d = get();
    const t = calculateTargets(d);

    const { error } = await supabase
      .from('profiles')
      .update({
        name:                  d.name        || null,
        birthdate:             d.birthdate   || null,
        gender:                d.gender      || null,
        height_cm:             d.height_cm,
        weight_kg:             d.weight_kg,
        goal:                  d.goal        || null,
        activity_level:        d.activity_level || null,
        daily_calorie_target:  t.calories,
        daily_protein_target:  t.protein,
        daily_carbs_target:    t.carbs,
        daily_fat_target:      t.fat,
        onboarding_completed:  true,
      })
      .eq('id', userId);

    if (error) return { error: error.message };
    return {};
  },
}));
