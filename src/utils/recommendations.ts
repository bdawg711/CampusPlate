import { supabase } from './supabase';
import { getFavoritesOnTodaysMenu, FavoriteMenuItem } from './favorites';
import { getHallAverages } from './ratings';
import { getAllHallStatuses, HallStatus } from './hours';
import { getMealQueryValues } from './meals';

export interface RecommendedItem {
  id: number;
  name: string;
  rec_num: string;
  station: string;
  dining_hall_id: number;
  hall_name: string;
  meal: string;
  calories: number;
  protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
}

export interface TopRatedHallItem {
  id: number;
  name: string;
  avg: number;
  count: number;
  status: HallStatus;
}

/**
 * Get favorited items that appear on today's menu.
 * Delegates to getFavoritesOnTodaysMenu from favorites.ts.
 */
export async function getFavoritesToday(
  userId: string,
  date: string
): Promise<FavoriteMenuItem[]> {
  return getFavoritesOnTodaysMenu(userId, date);
}

/**
 * Get menu items that fit the user's macro goals for the current meal period.
 * Goal mapping (profiles.goal → filter):
 *   moderate_cut (lose): calories < 400
 *   lean_bulk (bulk): protein_g > 25
 *   maintain: calories 300–600, protein_g > 15
 * Max 10 items, deduplicated by rec_num.
 */
export async function getFitsYourMacros(
  userId: string,
  date: string,
  mealPeriod: string
): Promise<RecommendedItem[]> {
  try {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('goal')
      .eq('id', userId)
      .single();

    if (profileError) throw new Error(`Failed to fetch profile: ${profileError.message}`);
    const goal = profile?.goal ?? 'maintain';

    const mealValues = getMealQueryValues(mealPeriod);
    const { data: items, error: itemError } = await supabase
      .from('menu_items')
      .select('id, name, rec_num, station, dining_hall_id, meal, nutrition(calories, protein_g, total_carbs_g, total_fat_g), dining_halls(name)')
      .eq('date', date)
      .in('meal', mealValues);

    if (itemError) throw new Error(`Failed to fetch menu items: ${itemError.message}`);
    if (!items?.length) return [];

    const filtered = items.filter((item) => {
      const rawN = item.nutrition as any;
      const n = Array.isArray(rawN) ? rawN[0] : rawN;
      if (!n) return false;
      const cal = n.calories ?? 0;
      const pro = n.protein_g ?? 0;
      if (cal <= 0) return false;

      switch (goal) {
        case 'moderate_cut':
          return cal < 400;
        case 'lean_bulk':
          return pro > 25;
        case 'maintain':
        default:
          return cal >= 300 && cal <= 600 && pro > 15;
      }
    });

    // Deduplicate by rec_num
    const seen = new Set<string>();
    const unique: typeof filtered = [];
    for (const item of filtered) {
      const key = item.rec_num || String(item.id);
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(item);
      }
    }

    return unique.slice(0, 10).map(mapToRecommendedItem);
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to fetch macro recommendations');
  }
}

/**
 * Get top-rated dining halls sorted by average rating descending.
 * Includes current open/closed status. Max 5 halls.
 */
export async function getTopRatedHalls(): Promise<TopRatedHallItem[]> {
  try {
    const [averages, statuses, hallsRes] = await Promise.all([
      getHallAverages(),
      getAllHallStatuses(new Date()),
      supabase.from('dining_halls').select('id, name'),
    ]);

    if (hallsRes.error) throw new Error(`Failed to fetch halls: ${hallsRes.error.message}`);

    const hallMap: Record<number, string> = {};
    for (const h of hallsRes.data ?? []) {
      hallMap[h.id] = h.name;
    }

    return Object.entries(averages)
      .map(([idStr, avg]) => {
        const id = Number(idStr);
        return {
          id,
          name: hallMap[id] ?? `Hall ${id}`,
          avg: avg.avg,
          count: avg.count,
          status: statuses[id] ?? { isOpen: false },
        };
      })
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 5);
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to fetch top rated halls');
  }
}

/**
 * Get items at the user's home hall that they have NOT logged before.
 * Compares rec_nums in meal_logs vs today's menu_items. Max 8 items.
 */
export async function getTrySomethingNew(
  userId: string,
  date: string
): Promise<RecommendedItem[]> {
  try {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('home_hall_id')
      .eq('id', userId)
      .single();

    if (profileError) throw new Error(`Failed to fetch profile: ${profileError.message}`);
    if (!profile?.home_hall_id) return [];

    const [menuRes, logsRes] = await Promise.all([
      supabase
        .from('menu_items')
        .select('id, name, rec_num, station, dining_hall_id, meal, nutrition(calories, protein_g, total_carbs_g, total_fat_g), dining_halls(name)')
        .eq('dining_hall_id', profile.home_hall_id)
        .eq('date', date),
      supabase
        .from('meal_logs')
        .select('menu_items(rec_num)')
        .eq('user_id', userId),
    ]);

    if (menuRes.error) throw new Error(`Failed to fetch menu: ${menuRes.error.message}`);
    if (logsRes.error) throw new Error(`Failed to fetch logs: ${logsRes.error.message}`);

    const loggedRecNums = new Set<string>();
    for (const log of logsRes.data ?? []) {
      const recNum = (log.menu_items as any)?.rec_num;
      if (recNum) loggedRecNums.add(recNum);
    }

    const newItems = (menuRes.data ?? []).filter(
      (item) => item.rec_num && !loggedRecNums.has(item.rec_num)
    );

    return newItems.slice(0, 8).map(mapToRecommendedItem);
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to fetch new item recommendations');
  }
}

/**
 * Get items under 300 calories from currently-open halls.
 * Deduplicated by rec_num. Max 10 items.
 */
export async function getQuickAndLight(
  date: string
): Promise<RecommendedItem[]> {
  try {
    const statuses = await getAllHallStatuses(new Date());
    const openHallIds = Object.entries(statuses)
      .filter(([, s]) => s.isOpen)
      .map(([id]) => Number(id));

    if (openHallIds.length === 0) return [];

    const { data: items, error } = await supabase
      .from('menu_items')
      .select('id, name, rec_num, station, dining_hall_id, meal, nutrition(calories, protein_g, total_carbs_g, total_fat_g), dining_halls(name)')
      .eq('date', date)
      .in('dining_hall_id', openHallIds);

    if (error) throw new Error(`Failed to fetch menu items: ${error.message}`);

    const light = (items ?? []).filter((item) => {
      const rawN = item.nutrition as any;
      const n = Array.isArray(rawN) ? rawN[0] : rawN;
      return n && (n.calories ?? 0) > 0 && (n.calories ?? 0) < 300;
    });

    // Deduplicate by rec_num
    const seen = new Set<string>();
    const unique: typeof light = [];
    for (const item of light) {
      const key = item.rec_num || String(item.id);
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(item);
      }
    }

    return unique.slice(0, 10).map(mapToRecommendedItem);
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to fetch quick & light items');
  }
}

/** Map a raw Supabase menu item row to a RecommendedItem. */
function mapToRecommendedItem(item: any): RecommendedItem {
  // Supabase returns nutrition as an array (one-to-many FK) — extract first element
  const rawN = item.nutrition;
  const n = Array.isArray(rawN) ? rawN[0] : rawN;
  return {
    id: item.id,
    name: item.name,
    rec_num: item.rec_num ?? '',
    station: item.station ?? '',
    dining_hall_id: item.dining_hall_id,
    hall_name: (item.dining_halls as any)?.name ?? '',
    meal: item.meal ?? '',
    calories: n?.calories ?? 0,
    protein_g: n?.protein_g ?? 0,
    total_carbs_g: n?.total_carbs_g ?? 0,
    total_fat_g: n?.total_fat_g ?? 0,
  };
}
