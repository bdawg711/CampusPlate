export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'very_active' | 'extra_active';

export type GoalType = 'aggressive_cut' | 'moderate_cut' | 'maintain' | 'lean_bulk' | 'aggressive_bulk';

const activityMultipliers: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very_active: 1.725,
  extra_active: 1.9,
};

const goalOffsets: Record<GoalType, number> = {
  aggressive_cut: -500,
  moderate_cut: -300,
  maintain: 0,
  lean_bulk: 300,
  aggressive_bulk: 500,
};

export const GOAL_OPTIONS: { key: GoalType; label: string; description: string }[] = [
  { key: 'aggressive_cut', label: 'Lose weight fast (-500 kcal)', description: '~1 lb/week. Best for short-term cuts.' },
  { key: 'moderate_cut', label: 'Lose weight steadily (-300 kcal)', description: '~0.6 lb/week. Sustainable fat loss.' },
  { key: 'maintain', label: 'Maintain weight', description: 'Stay at current weight.' },
  { key: 'lean_bulk', label: 'Build muscle slowly (+300 kcal)', description: 'Minimize fat gain. ~0.6 lb/week.' },
  { key: 'aggressive_bulk', label: 'Build muscle fast (+500 kcal)', description: 'Maximum growth. ~1 lb/week.' },
];

const normalizeActivity = (level: string): ActivityLevel =>
  level === 'active' ? 'very_active' : level as ActivityLevel;

export const calculateTDEE = (
  weight: number,
  height: number,
  age: number,
  isMale: boolean,
  activityLevel: ActivityLevel | 'active' = 'light'
): number => {
  let bmr = (10 * weight) + (6.25 * height) - (5 * age);
  bmr = isMale ? bmr + 5 : bmr - 161;
  return Math.round(bmr * activityMultipliers[normalizeActivity(activityLevel)]);
};

export const calculateTargetCalories = (
  tdee: number,
  goal: GoalType,
  is_male: boolean
): number => {
  const offset = goalOffsets[goal] ?? 0;
  const target = tdee + offset;
  const min = is_male ? 1500 : 1200;
  return Math.round(Math.min(Math.max(target, min), 4500));
};

export const calculateDailyGoal = (
  weight: number,
  height: number,
  age: number,
  isMale: boolean,
  goal: GoalType | 'cut' | 'bulk',
  activityLevel: ActivityLevel | 'active' = 'light'
): number => {
  const tdee = calculateTDEE(weight, height, age, isMale, activityLevel);

  // Legacy support
  if (goal === 'cut') return Math.round(tdee - 300);
  if (goal === 'bulk') return Math.round(tdee + 300);

  return calculateTargetCalories(tdee, goal as GoalType, isMale);
};

export const getWeeklyProjection = (goalCalories: number, tdee: number): string => {
  const weeklyDiff = (goalCalories - tdee) * 7;
  const lbsPerWeek = Math.abs(weeklyDiff) / 3500;
  if (Math.abs(weeklyDiff) < 100) return 'Maintain current weight';
  const direction = weeklyDiff < 0 ? 'loss' : 'gain';
  return `Estimated: ~${lbsPerWeek.toFixed(1)} lb/week ${direction}`;
};
