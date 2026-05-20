import { create } from 'zustand';
import { MealEntry } from '../types';

interface MealState {
  todayMeals: MealEntry[];
  setTodayMeals: (meals: MealEntry[]) => void;
  addMeal: (meal: MealEntry) => void;
  removeMeal: (mealId: string) => void;
  totalCaloriesToday: () => number;
}

export const useMealStore = create<MealState>((set, get) => ({
  todayMeals: [],

  setTodayMeals: (meals) => set({ todayMeals: meals }),

  addMeal: (meal) =>
    set((state) => ({ todayMeals: [...state.todayMeals, meal] })),

  removeMeal: (mealId) =>
    set((state) => ({
      todayMeals: state.todayMeals.filter((m) => m.id !== mealId),
    })),

  totalCaloriesToday: () =>
    get().todayMeals.reduce((sum, m) => sum + m.total_calories, 0),
}));
