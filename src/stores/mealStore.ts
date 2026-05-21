import { create } from 'zustand';
import { MealEntry } from '../types';
import { supabase } from '../lib/supabase';

interface MealState {
  todayMeals: MealEntry[];
  loading: boolean;
  setTodayMeals: (meals: MealEntry[]) => void;
  addMeal: (meal: MealEntry) => void;
  removeMeal: (mealId: string) => void;
  loadTodayMeals: (userId: string) => Promise<void>;
  totalCaloriesToday: () => number;
}

export const useMealStore = create<MealState>((set, get) => ({
  todayMeals: [],
  loading: false,

  setTodayMeals: (meals) => set({ todayMeals: meals }),

  addMeal: (meal) =>
    set((state) => ({ todayMeals: [...state.todayMeals, meal] })),

  removeMeal: (mealId) =>
    set((state) => ({
      todayMeals: state.todayMeals.filter((m) => m.id !== mealId),
    })),

  loadTodayMeals: async (userId) => {
    set({ loading: true });
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

    const { data, error } = await supabase
      .from('meals')
      .select('*')
      .eq('user_id', userId)
      .gte('eaten_at', startOfDay)
      .lt('eaten_at', endOfDay)
      .order('eaten_at', { ascending: false });

    if (error || !data) {
      set({ loading: false });
      return;
    }

    // Map DB column names to MealEntry fields
    const meals: MealEntry[] = data.map((row) => ({
      id: row.id,
      user_id: row.user_id,
      meal_name: row.meal_name,
      eaten_at: row.eaten_at,
      total_calories: row.total_calories ?? 0,
      total_protein: row.total_protein_g ?? 0,
      total_carbs: row.total_carbs_g ?? 0,
      total_fat: row.total_fat_g ?? 0,
      total_fiber: row.total_fiber_g ?? 0,
      photo_url: row.photo_url ?? undefined,
      source: row.source === 'ai_vision' ? 'ai' : (row.source ?? 'manual'),
      items: [],
    }));

    set({ todayMeals: meals, loading: false });
  },

  totalCaloriesToday: () =>
    get().todayMeals.reduce((sum, m) => sum + m.total_calories, 0),
}));
