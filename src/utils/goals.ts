import { supabase } from './supabase';
import { ActivityLevel, GoalType, calculateTDEE, calculateTargetCalories } from './nutrition';

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

// Protein g/kg by goal
const proteinPerKg: Record<GoalType, number> = {
  moderate_cut: 2.1,
  aggressive_cut: 2.3,
  maintain: 1.7,
  lean_bulk: 1.8,
  aggressive_bulk: 1.75,
};

// Fat as % of target calories by goal
const fatPercent: Record<GoalType, number> = {
  moderate_cut: 0.25,
  aggressive_cut: 0.25,
  maintain: 0.30,
  lean_bulk: 0.27,
  aggressive_bulk: 0.25,
};

// Protein g/kg ranges for getProteinRange
const proteinRanges: Record<GoalType, { min: number; max: number }> = {
  moderate_cut: { min: 2.0, max: 2.4 },
  aggressive_cut: { min: 2.2, max: 2.4 },
  maintain: { min: 1.6, max: 1.8 },
  lean_bulk: { min: 1.6, max: 2.0 },
  aggressive_bulk: { min: 1.6, max: 2.0 },
};

function calculateMacros(targetCalories: number, weightKg: number, goal: GoalType): { protein: number; fat: number; carbs: number } {
  const protein = Math.round(weightKg * proteinPerKg[goal]);

  let currentFatPercent = fatPercent[goal];
  let fat = Math.round((targetCalories * currentFatPercent) / 9);
  let carbKcal = targetCalories - (protein * 4) - (fat * 9);
  let carbs = Math.round(carbKcal / 4);

  // Edge case: if carbs negative, reduce fat by 5% and recalculate once
  if (carbs < 0) {
    currentFatPercent -= 0.05;
    fat = Math.round((targetCalories * currentFatPercent) / 9);
    carbKcal = targetCalories - (protein * 4) - (fat * 9);
    carbs = Math.round(carbKcal / 4);
  }

  return { protein, fat, carbs };
}

export function getProteinRange(goal: GoalType, weightKg: number): { min: number; max: number } {
  const range = proteinRanges[goal];
  return {
    min: Math.round(weightKg * range.min),
    max: Math.round(weightKg * range.max),
  };
}

export function calculateWaterGoal(weightLbs: number): number {
  return Math.max(64, Math.min(weightLbs, 160));
}

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

export function recalculateGoals(
  weightLbs: number,
  heightCm: number,
  age: number,
  isMale: boolean,
  activityLevel: ActivityLevel,
  goal: GoalType,
): Goals {
  const weightKg = weightLbs / 2.20462;
  const weightKgRounded = Math.round(weightKg);

  const tdee = calculateTDEE(weightKgRounded, heightCm, age, isMale, activityLevel);
  const goalCalories = calculateTargetCalories(tdee, goal, isMale);
  const { protein: goalProtein, fat: goalFat, carbs: goalCarbs } = calculateMacros(goalCalories, weightKg, goal);

  return { goalCalories, goalProtein, goalCarbs, goalFat };
}
