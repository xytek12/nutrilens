// Safety rules: minimum allowed target weight is 43 kg.
// This prevents users from setting dangerous weight goals.

export const MIN_TARGET_WEIGHT_KG = 43;
export const MIN_CALORIES_PER_DAY = 1200;

export function isTargetWeightSafe(targetKg: number): boolean {
  return targetKg >= MIN_TARGET_WEIGHT_KG;
}

export function isCalorieTargetSafe(calories: number): boolean {
  return calories >= MIN_CALORIES_PER_DAY;
}

export function validateWeightGoal(
  currentWeightKg: number,
  targetWeightKg: number
): { valid: boolean; error?: string } {
  if (targetWeightKg < MIN_TARGET_WEIGHT_KG) {
    return {
      valid: false,
      error: `Target weight must be at least ${MIN_TARGET_WEIGHT_KG} kg for health and safety.`,
    };
  }
  if (targetWeightKg > currentWeightKg * 1.5) {
    return {
      valid: false,
      error: 'Target weight seems too high. Please check your entry.',
    };
  }
  return { valid: true };
}
