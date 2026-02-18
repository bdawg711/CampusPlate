export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active';

const activityMultipliers: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
};

export const calculateDailyGoal = (
  weight: number,
  height: number,
  age: number,
  isMale: boolean,
  goal: 'cut' | 'bulk' | 'maintain',
  activityLevel: ActivityLevel = 'light'
) => {
  let bmr = (10 * weight) + (6.25 * height) - (5 * age);
  bmr = isMale ? bmr + 5 : bmr - 161;
  const tdee = bmr * activityMultipliers[activityLevel];

  if (goal === 'cut') return Math.round(tdee - 500);
  if (goal === 'bulk') return Math.round(tdee + 500);
  return Math.round(tdee);
};
