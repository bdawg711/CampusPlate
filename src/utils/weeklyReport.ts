import { supabase } from './supabase';

// ── RPC response types ──────────────────────────────────────────────────────

interface RPCDailyTotal {
  log_date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  meals_logged: number;
}

interface RPCGoals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  water_goal_oz: number;
}

interface RPCWaterEntry {
  date: string;
  total_oz: number;
}

interface RPCWeightEntry {
  date: string;
  weight: number;
}

interface RPCResponse {
  daily_totals: RPCDailyTotal[];
  goals: RPCGoals | null;
  water_totals: RPCWaterEntry[];
  weight_entries: RPCWeightEntry[];
  streak: number;
}

// ── Processed output types ──────────────────────────────────────────────────

export interface DailyTotal {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  mealsLogged: number;
}

export interface MacroAverages {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface GoalAdherence {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface Goals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  waterGoalOz: number;
}

export interface WaterEntry {
  date: string;
  totalOz: number;
}

export interface WeightEntry {
  date: string;
  weight: number;
}

export interface WeeklyReportData {
  dailyTotals: DailyTotal[];
  averages: MacroAverages;
  goals: Goals;
  adherence: GoalAdherence;
  waterTotals: WaterEntry[];
  avgWaterOz: number;
  daysWaterGoalMet: number;
  weightEntries: WeightEntry[];
  streak: number;
  daysLogged: number;
  mostConsistentMeal: string;
  startDate: string;
  endDate: string;
}

/**
 * Fetches and processes a 7-day weekly nutrition report.
 * Calls the get_weekly_report RPC plus a supplemental query for most consistent meal.
 */
export async function getWeeklyReport(
  userId: string,
  endDate?: string
): Promise<WeeklyReportData> {
  const end = endDate ?? formatLocalDate(new Date());

  // Compute start date (7 days before end, exclusive — the RPC uses > end - 7)
  const endD = new Date(end + 'T00:00:00');
  const startD = new Date(endD);
  startD.setDate(startD.getDate() - 6);
  const start = formatLocalDate(startD);

  // Run RPC, most-consistent-meal query, and direct water query in parallel
  const [rpcResult, mealResult, waterResult] = await Promise.all([
    supabase.rpc('get_weekly_report', { p_user_id: userId, p_end_date: end }),
    supabase
      .from('meal_logs')
      .select('meal, date')
      .eq('user_id', userId)
      .gte('date', start)
      .lte('date', end),
    supabase
      .from('water_logs')
      .select('date, glasses')
      .eq('user_id', userId)
      .gte('date', start)
      .lte('date', end),
  ]);

  if (rpcResult.error) {
    throw new Error(rpcResult.error.message || 'Failed to load weekly report');
  }

  if (mealResult.error) {
    throw new Error(mealResult.error.message || 'Failed to load meal data');
  }

  const rpc: RPCResponse = rpcResult.data ?? {
    daily_totals: [],
    goals: null,
    water_totals: [],
    weight_entries: [],
    streak: 0,
  };

  const dailyTotals: DailyTotal[] = (rpc.daily_totals ?? []).map((d) => ({
    date: d.log_date,
    calories: d.calories,
    protein: d.protein,
    carbs: d.carbs,
    fat: d.fat,
    mealsLogged: d.meals_logged,
  }));

  const daysLogged = dailyTotals.length;

  // ── Averages (over days with data) ──────────────────────────────────────
  const averages = calculateAverages(dailyTotals);

  // ── Goals ───────────────────────────────────────────────────────────────
  const goals: Goals = {
    calories: rpc.goals?.calories ?? 2000,
    protein: rpc.goals?.protein ?? 150,
    carbs: rpc.goals?.carbs ?? 250,
    fat: rpc.goals?.fat ?? 65,
    waterGoalOz: rpc.goals?.water_goal_oz ?? 64,
  };

  // ── Goal adherence (avg / goal * 100) ───────────────────────────────────
  const adherence: GoalAdherence = {
    calories: goals.calories > 0 ? Math.round((averages.calories / goals.calories) * 100) : 0,
    protein: goals.protein > 0 ? Math.round((averages.protein / goals.protein) * 100) : 0,
    carbs: goals.carbs > 0 ? Math.round((averages.carbs / goals.carbs) * 100) : 0,
    fat: goals.fat > 0 ? Math.round((averages.fat / goals.fat) * 100) : 0,
  };

  // ── Water (direct query — RPC may use wrong column name) ────────────────
  const waterRows = waterResult.data ?? [];
  const waterTotals: WaterEntry[] = waterRows.map((w: { date: string; glasses: number }) => ({
    date: w.date,
    totalOz: w.glasses ?? 0,
  }));

  const avgWaterOz =
    waterTotals.length > 0
      ? Math.round(waterTotals.reduce((sum, w) => sum + (w.totalOz || 0), 0) / waterTotals.length)
      : 0;

  const daysWaterGoalMet = waterTotals.filter(
    (w) => w.totalOz >= goals.waterGoalOz
  ).length;

  // ── Weight ──────────────────────────────────────────────────────────────
  const weightEntries: WeightEntry[] = (rpc.weight_entries ?? []).map((w) => ({
    date: w.date,
    weight: w.weight,
  }));

  // ── Most consistent meal ────────────────────────────────────────────────
  const mostConsistentMeal = findMostConsistentMeal(mealResult.data ?? []);

  return {
    dailyTotals,
    averages,
    goals,
    adherence,
    waterTotals,
    avgWaterOz,
    daysWaterGoalMet,
    weightEntries,
    streak: rpc.streak ?? 0,
    daysLogged,
    mostConsistentMeal,
    startDate: start,
    endDate: end,
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function calculateAverages(dailyTotals: DailyTotal[]): MacroAverages {
  if (dailyTotals.length === 0) {
    return { calories: 0, protein: 0, carbs: 0, fat: 0 };
  }

  const count = dailyTotals.length;
  return {
    calories: Math.round(dailyTotals.reduce((s, d) => s + d.calories, 0) / count),
    protein: Math.round(dailyTotals.reduce((s, d) => s + d.protein, 0) / count),
    carbs: Math.round(dailyTotals.reduce((s, d) => s + d.carbs, 0) / count),
    fat: Math.round(dailyTotals.reduce((s, d) => s + d.fat, 0) / count),
  };
}

/**
 * Finds the meal period logged on the most distinct days in the window.
 * Counts distinct (meal, date) pairs per meal type.
 */
function findMostConsistentMeal(
  logs: { meal: string; date: string }[]
): string {
  if (logs.length === 0) return 'None';

  const mealDays: Record<string, Set<string>> = {};

  for (const log of logs) {
    const meal = normalizeMealPeriod(log.meal);
    if (!mealDays[meal]) mealDays[meal] = new Set();
    mealDays[meal].add(log.date);
  }

  let best = 'None';
  let bestCount = 0;

  for (const [meal, days] of Object.entries(mealDays)) {
    if (days.size > bestCount) {
      bestCount = days.size;
      best = meal;
    }
  }

  return best;
}

/**
 * Normalizes non-standard meal labels into the three primary periods.
 */
function normalizeMealPeriod(meal: string): string {
  if (meal === 'Lunch/Dinner') return 'Lunch';
  if (meal === 'Daily Items') return 'Breakfast';
  return meal;
}
