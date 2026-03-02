import { supabase } from './supabase';

// ── Types ────────────────────────────────────────────────────────────────────

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  totalDaysLogged: number;
  lastLogDate: string | null;
}

export interface Badge {
  id: string;
  name: string;
  emoji: string;
  icon: string;
  description: string;
  type: 'streak' | 'water' | 'logging';
  requirement: number;
  earned: boolean;
  earnedDate?: string;
}

// ── Badge Definitions ────────────────────────────────────────────────────────

export const BADGE_DEFINITIONS: Omit<Badge, 'earned' | 'earnedDate'>[] = [
  { id: 'streak_3',   name: 'Getting Started',  emoji: '', icon: 'zap',       description: '3-day streak',       type: 'streak',  requirement: 3   },
  { id: 'streak_7',   name: 'One Week Strong',   emoji: '', icon: 'award',     description: '7-day streak',       type: 'streak',  requirement: 7   },
  { id: 'streak_14',  name: 'Two Week Warrior',   emoji: '', icon: 'shield',    description: '14-day streak',      type: 'streak',  requirement: 14  },
  { id: 'streak_30',  name: 'Monthly Master',     emoji: '', icon: 'star',      description: '30-day streak',      type: 'streak',  requirement: 30  },
  { id: 'streak_60',  name: 'Unstoppable',        emoji: '', icon: 'sunrise',   description: '60-day streak',      type: 'streak',  requirement: 60  },
  { id: 'streak_100', name: 'Century Club',       emoji: '', icon: 'sun',       description: '100-day streak',     type: 'streak',  requirement: 100 },
  { id: 'water_7',    name: 'Hydration Hero',     emoji: '', icon: 'droplet',   description: 'Water goal 7 days',  type: 'water',   requirement: 7   },
  { id: 'logs_50',    name: 'Dedicated Logger',   emoji: '', icon: 'edit-3',    description: '50 meals logged',    type: 'logging', requirement: 50  },
  { id: 'logs_200',   name: 'Nutrition Nerd',     emoji: '', icon: 'book-open', description: '200 meals logged',   type: 'logging', requirement: 200 },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function getLocalDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Subtract `n` days from a YYYY-MM-DD string and return a new YYYY-MM-DD string. */
function subtractDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

// ── getStreakData ─────────────────────────────────────────────────────────────

export async function getStreakData(userId: string): Promise<StreakData> {
  try {
    // Fetch dates from both meal_logs and custom_meals
    const [mealLogsRes, customMealsRes] = await Promise.all([
      supabase
        .from('meal_logs')
        .select('date')
        .eq('user_id', userId)
        .order('date', { ascending: false }),
      supabase
        .from('custom_meals')
        .select('date')
        .eq('user_id', userId)
        .order('date', { ascending: false }),
    ]);

    const mealDates = (mealLogsRes.data ?? []).map((row: { date: string }) => row.date);
    const customDates = (customMealsRes.data ?? []).map((row: { date: string }) => row.date);

    // Deduplicate dates from both sources
    const uniqueDates = [...new Set([...mealDates, ...customDates])].sort().reverse();

    if (uniqueDates.length === 0) {
      return { currentStreak: 0, longestStreak: 0, totalDaysLogged: 0, lastLogDate: null };
    }

    const dateSet = new Set(uniqueDates);
    const today = getLocalDate();

    // ── Current streak: walk backward from today (or yesterday if today not logged)
    let current = 0;
    let checkDate = dateSet.has(today) ? today : subtractDays(today, 1);

    // If neither today nor yesterday is logged, current streak is 0
    if (!dateSet.has(checkDate)) {
      current = 0;
    } else {
      while (dateSet.has(checkDate)) {
        current++;
        checkDate = subtractDays(checkDate, 1);
      }
    }

    // ── Longest streak: iterate all sorted dates ascending
    const ascending = [...uniqueDates].sort();
    let longest = 1;
    let run = 1;
    for (let i = 1; i < ascending.length; i++) {
      const expected = subtractDays(ascending[i], -0); // current date
      const prevPlusOne = subtractDays(ascending[i - 1], -1); // previous + 1 day
      if (ascending[i] === prevPlusOne) {
        run++;
        if (run > longest) longest = run;
      } else {
        run = 1;
      }
    }
    if (ascending.length === 0) longest = 0;

    return {
      currentStreak: current,
      longestStreak: Math.max(longest, current),
      totalDaysLogged: uniqueDates.length,
      lastLogDate: uniqueDates[0] ?? null,
    };
  } catch {
    return { currentStreak: 0, longestStreak: 0, totalDaysLogged: 0, lastLogDate: null };
  }
}

// ── getBadges ─────────────────────────────────────────────────────────────────

export function getBadges(
  streakData: StreakData,
  waterStreakDays: number,
  totalMeals: number
): Badge[] {
  return BADGE_DEFINITIONS.map((def) => {
    let earned = false;
    if (def.type === 'streak') {
      earned = streakData.longestStreak >= def.requirement;
    } else if (def.type === 'water') {
      earned = waterStreakDays >= def.requirement;
    } else if (def.type === 'logging') {
      earned = totalMeals >= def.requirement;
    }
    return { ...def, earned };
  });
}

// ── getWaterStreak ────────────────────────────────────────────────────────────

export async function getWaterStreak(userId: string): Promise<number> {
  try {
    // Fetch water goal
    const { data: profileData } = await supabase
      .from('profiles')
      .select('water_goal_oz')
      .eq('id', userId)
      .single();

    const waterGoal = profileData?.water_goal_oz ?? 64;

    // Fetch water logs ordered by date descending
    const { data: waterData, error } = await supabase
      .from('water_logs')
      .select('date, glasses')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (error || !waterData || waterData.length === 0) return 0;

    const today = getLocalDate();
    let streak = 0;
    let checkDate = today;

    // Build a map of date → glasses for O(1) lookup
    const waterMap = new Map<string, number>();
    for (const row of waterData) {
      waterMap.set(row.date, row.glasses ?? 0);
    }

    // If today not in map, start from yesterday
    if (!waterMap.has(checkDate)) {
      checkDate = subtractDays(checkDate, 1);
    }

    // Walk backward counting consecutive days meeting goal
    while (waterMap.has(checkDate)) {
      const glasses = waterMap.get(checkDate)!;
      if (glasses < waterGoal) break;
      streak++;
      checkDate = subtractDays(checkDate, 1);
    }

    return streak;
  } catch {
    return 0;
  }
}

// ── getTotalMealsLogged ──────────────────────────────────────────────────────

export async function getTotalMealsLogged(userId: string): Promise<number> {
  try {
    const [mealLogsRes, customMealsRes] = await Promise.all([
      supabase
        .from('meal_logs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId),
      supabase
        .from('custom_meals')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId),
    ]);

    const mealCount = mealLogsRes.count ?? 0;
    const customCount = customMealsRes.count ?? 0;
    return mealCount + customCount;
  } catch {
    return 0;
  }
}
