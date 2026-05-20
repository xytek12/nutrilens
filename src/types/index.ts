export type Language = 'en' | 'he' | 'ar' | 'de' | 'zh';
export type Goal = 'lose' | 'maintain' | 'gain';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type Gender = 'male' | 'female' | 'other';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
  birthdate?: string;
  gender?: Gender;
  height_cm?: number;
  weight_kg?: number;
  target_weight_kg?: number;
  goal?: Goal;
  activity_level?: ActivityLevel;
  dietary_preferences?: string[];
  language?: Language;
  onboarding_completed?: boolean;
  trial_started_at?: string;
  subscription_status?: 'free' | 'trial' | 'premium';
  created_at?: string;
}

export interface MealEntry {
  id: string;
  user_id: string;
  meal_name: string;
  eaten_at: string;
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
  total_fiber: number;
  photo_url?: string;
  source: 'ai' | 'manual' | 'search';
  items: MealItem[];
}

export interface MealItem {
  id: string;
  meal_id: string;
  food_name: string;
  weight_grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export interface DailyTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export interface WeightLog {
  id: string;
  user_id: string;
  weight_kg: number;
  logged_at: string;
}
