import { supabase } from './supabase';

// ── Types ────────────────────────────────────────────────────────────────────

export interface DayLog {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  mealsLogged: number;
}

export interface ProgressData {
  days: DayLog[];
  weeklyAverages: {
    thisWeek: { calories: number; protein: number; carbs: number; fat: number };
    lastWeek: { calories: number; protein: number; carbs: number; fat: number };
  };
  goals: { calories: number; protein: number; carbs: number; fat: number };
  totalMealsLogged: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getLocalDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function subtractDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

// ── Main Function ────────────────────────────────────────────────────────────

export async function getProgressData(
  userId: string,
  days: number = 30
): Promise<ProgressData> {
  const today = getLocalDate();
  const startDate = subtractDays(today, days);

  try {
    // Single query for meal logs with nutrition via nested join
    const { data: logsData, error: logsError } = await supabase
      .from('meal_logs')
      .select('date, servings, menu_items(nutrition(calories, protein_g, total_carbs_g, total_fat_g))')
      .eq('user_id', userId)
      .gte('date', startDate)
      .order('date', { ascending: true });

    // Fetch goals from profiles
    const { data: profileData } = await supabase
      .from('profiles')
      .select('goal_calories, goal_protein_g, goal_carbs_g, goal_fat_g')
      .eq('id', userId)
      .single();

    const goals = {
      calories: profileData?.goal_calories ?? 2000,
      protein: profileData?.goal_protein_g ?? 150,
      carbs: profileData?.goal_carbs_g ?? 250,
      fat: profileData?.goal_fat_g ?? 65,
    };

    if (logsError || !logsData) {
      return { days: [], weeklyAverages: { thisWeek: { calories: 0, protein: 0, carbs: 0, fat: 0 }, lastWeek: { calories: 0, protein: 0, carbs: 0, fat: 0 } }, goals, totalMealsLogged: 0 };
    }

    // Group by date
    const dateMap = new Map<string, { calories: number; protein: number; carbs: number; fat: number; meals: number }>();

    for (const row of logsData as any[]) {
      const date = row.date as string;
      const servings = (row.servings ?? 1) as number;
      const nutrition = row.menu_items?.nutrition;
      const cal  = (nutrition?.calories ?? 0) * servings;
      const prot = (nutrition?.protein_g ?? 0) * servings;
      const carb = (nutrition?.total_carbs_g ?? 0) * servings;
      const fat  = (nutrition?.total_fat_g ?? 0) * servings;

      const existing = dateMap.get(date) ?? { calories: 0, protein: 0, carbs: 0, fat: 0, meals: 0 };
      existing.calories += cal;
      existing.protein += prot;
      existing.carbs += carb;
      existing.fat += fat;
      existing.meals += 1;
      dateMap.set(date, existing);
    }

    // Build DayLog array
    const dayLogs: DayLog[] = [];
    for (const [date, d] of dateMap) {
      dayLogs.push({
        date,
        calories: Math.round(d.calories),
        protein: Math.round(d.protein),
        carbs: Math.round(d.carbs),
        fat: Math.round(d.fat),
        mealsLogged: d.meals,
      });
    }
    dayLogs.sort((a, b) => a.date.localeCompare(b.date));

    // Weekly averages
    const thisWeekStart = subtractDays(today, 6); // last 7 days including today
    const lastWeekStart = subtractDays(today, 13); // days 8-14

    const thisWeekDays = dayLogs.filter(d => d.date >= thisWeekStart && d.date <= today);
    const lastWeekDays = dayLogs.filter(d => d.date >= lastWeekStart && d.date < thisWeekStart);

    const thisWeek = {
      calories: avg(thisWeekDays.map(d => d.calories)),
      protein:  avg(thisWeekDays.map(d => d.protein)),
      carbs:    avg(thisWeekDays.map(d => d.carbs)),
      fat:      avg(thisWeekDays.map(d => d.fat)),
    };

    const lastWeek = {
      calories: avg(lastWeekDays.map(d => d.calories)),
      protein:  avg(lastWeekDays.map(d => d.protein)),
      carbs:    avg(lastWeekDays.map(d => d.carbs)),
      fat:      avg(lastWeekDays.map(d => d.fat)),
    };

    return {
      days: dayLogs,
      weeklyAverages: { thisWeek, lastWeek },
      goals,
      totalMealsLogged: logsData.length,
    };
  } catch {
    return {
      days: [],
      weeklyAverages: {
        thisWeek: { calories: 0, protein: 0, carbs: 0, fat: 0 },
        lastWeek: { calories: 0, protein: 0, carbs: 0, fat: 0 },
      },
      goals: { calories: 2000, protein: 150, carbs: 250, fat: 65 },
      totalMealsLogged: 0,
    };
  }
}
