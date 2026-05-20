import { ActivityLevel, Gender, Goal, DailyTargets } from '../types';

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export function calculateBMR(
  weightKg: number,
  heightCm: number,
  ageYears: number,
  gender: Gender
): number {
  // Mifflin-St Jeor equation
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  return gender === 'male' ? base + 5 : base - 161;
}

export function calculateTDEE(bmr: number, activityLevel: ActivityLevel): number {
  return Math.round(bmr * ACTIVITY_MULTIPLIERS[activityLevel]);
}

export function calculateDailyTargets(
  weightKg: number,
  heightCm: number,
  ageYears: number,
  gender: Gender,
  activityLevel: ActivityLevel,
  goal: Goal
): DailyTargets {
  const bmr = calculateBMR(weightKg, heightCm, ageYears, gender);
  let calories = calculateTDEE(bmr, activityLevel);

  if (goal === 'lose') calories -= 500;
  if (goal === 'gain') calories += 300;

  // Protein: 2g per kg body weight
  const protein = Math.round(weightKg * 2);
  // Fat: 25% of calories
  const fat = Math.round((calories * 0.25) / 9);
  // Carbs: remainder
  const carbs = Math.round((calories - protein * 4 - fat * 9) / 4);

  return { calories, protein, carbs, fat, fiber: 30 };
}
