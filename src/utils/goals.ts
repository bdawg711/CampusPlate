import { supabase } from './supabase';
import { ActivityLevel, GoalType, calculateDailyGoal } from './nutrition';

export interface Goals {
  goalCalories: number;
  goalProtein: number;
  goalCarbs: number;
  goalFat: number;
}

const DEFAULTS: Goals = {
  goalCalories: 2000,
  goalProtein: 150,
  goalCarbs: 200,
  goalFat: 65,
};

export async function getGoals(userId: string): Promise<Goals> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('goal_calories, goal_protein_g, goal_carbs_g, goal_fat_g')
      .eq('id', userId)
      .single();

    if (error || !data) return DEFAULTS;

    return {
      goalCalories: data.goal_calories ?? DEFAULTS.goalCalories,
      goalProtein: data.goal_protein_g ?? DEFAULTS.goalProtein,
      goalCarbs: data.goal_carbs_g ?? DEFAULTS.goalCarbs,
      goalFat: data.goal_fat_g ?? DEFAULTS.goalFat,
    };
  } catch {
    return DEFAULTS;
  }
}

export async function saveCustomGoals(userId: string, goals: Goals): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({
      goal_calories: goals.goalCalories,
      goal_protein_g: goals.goalProtein,
      goal_carbs_g: goals.goalCarbs,
      goal_fat_g: goals.goalFat,
      updated_at: new Date().toISOString(), // timestamptz column — toISOString is safe here, not a date column
    })
    .eq('id', userId);

  if (error) throw new Error(`Failed to save goals: ${error.message}`);
}

export async function recalculateGoals(userId: string): Promise<Goals> {
  const { data, error } = await supabase
    .from('profiles')
    .select('weight, height, age, is_male, activity_level, goal')
    .eq('id', userId)
    .single();

  if (error || !data) throw new Error('Could not fetch profile for recalculation');

  // weight stored in lbs, height stored in cm (matches onboarding save)
  const weightLbs: number = data.weight ?? 150;
  const weightKg = Math.round(weightLbs * 0.453592);
  const heightCm: number = data.height ?? 170;
  const age: number = data.age ?? 20;
  const isMale: boolean = data.is_male ?? true;
  const activityLevel: ActivityLevel = data.activity_level ?? 'light';
  const goal: GoalType = data.goal ?? 'maintain';

  const goalCalories = calculateDailyGoal(weightKg, heightCm, age, isMale, goal, activityLevel);

  // Macro split — matches onboarding calcMacros exactly:
  // protein = weight_lbs × 0.8, fat = 25% of cals / 9, carbs = remainder / 4
  const goalProtein = Math.round(weightLbs * 0.8);
  const goalFat = Math.round((goalCalories * 0.25) / 9);
  const goalCarbs = Math.round((goalCalories - goalProtein * 4 - goalFat * 9) / 4);

  const newGoals: Goals = { goalCalories, goalProtein, goalCarbs, goalFat };
  await saveCustomGoals(userId, newGoals);
  return newGoals;
}
