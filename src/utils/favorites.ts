import { supabase } from './supabase';

export interface Favorite {
  id: number;
  rec_num: string;
  item_name: string;
  created_at: string;
}

export interface FavoriteMenuItem {
  id: number;
  name: string;
  rec_num: string;
  station: string;
  dining_hall_id: number;
  meal: string;
  nutrition: {
    calories: number;
    protein_g: number;
    total_carbs_g: number;
    total_fat_g: number;
  } | null;
}

/**
 * Toggle a favorite on or off. If the item is already favorited, remove it.
 * If not, add it. Returns true if the item is now favorited, false if removed.
 */
export async function toggleFavorite(
  userId: string,
  recNum: string,
  itemName: string
): Promise<boolean> {
  try {
    // Check if already favorited
    const { data: existing, error: checkError } = await supabase
      .from('favorites')
      .select('id')
      .eq('user_id', userId)
      .eq('rec_num', recNum)
      .maybeSingle();

    if (checkError) throw new Error(`Failed to check favorite: ${checkError.message}`);

    if (existing) {
      // Remove favorite
      const { error: deleteError } = await supabase
        .from('favorites')
        .delete()
        .eq('user_id', userId)
        .eq('rec_num', recNum);

      if (deleteError) throw new Error(`Failed to remove favorite: ${deleteError.message}`);
      return false;
    }

    // Add favorite
    const { error: insertError } = await supabase
      .from('favorites')
      .insert({ user_id: userId, rec_num: recNum, item_name: itemName });

    if (insertError) throw new Error(`Failed to add favorite: ${insertError.message}`);
    return true;
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to toggle favorite');
  }
}

/**
 * Get all favorites for a user.
 */
export async function getFavorites(userId: string): Promise<Favorite[]> {
  try {
    const { data, error } = await supabase
      .from('favorites')
      .select('id, rec_num, item_name, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to fetch favorites: ${error.message}`);
    return data ?? [];
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to fetch favorites');
  }
}

/**
 * Check if a specific item (by rec_num) is favorited by the user.
 */
export async function isFavorited(
  userId: string,
  recNum: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('favorites')
      .select('id')
      .eq('user_id', userId)
      .eq('rec_num', recNum)
      .maybeSingle();

    if (error) throw new Error(`Failed to check favorite: ${error.message}`);
    return !!data;
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to check favorite');
  }
}

/**
 * Get favorited items that appear on today's menu, with nutrition data.
 * Joins favorites → menu_items (on rec_num + date) → nutrition.
 */
export async function getFavoritesOnTodaysMenu(
  userId: string,
  date: string
): Promise<FavoriteMenuItem[]> {
  try {
    // 1. Get user's favorite rec_nums
    const { data: favs, error: favError } = await supabase
      .from('favorites')
      .select('rec_num')
      .eq('user_id', userId);

    if (favError) throw new Error(`Failed to fetch favorites: ${favError.message}`);
    if (!favs?.length) return [];

    const recNums = favs.map((f) => f.rec_num);

    // 2. Find matching menu items on today's menu with nutrition
    const { data: items, error: itemError } = await supabase
      .from('menu_items')
      .select('id, name, rec_num, station, dining_hall_id, meal, nutrition(calories, protein_g, total_carbs_g, total_fat_g)')
      .eq('date', date)
      .in('rec_num', recNums);

    if (itemError) throw new Error(`Failed to fetch menu items: ${itemError.message}`);
    if (!items?.length) return [];

    // Deduplicate by rec_num (same dish may appear at multiple halls — keep first)
    const seen = new Set<string>();
    const unique: FavoriteMenuItem[] = [];
    for (const item of items) {
      if (!seen.has(item.rec_num)) {
        seen.add(item.rec_num);
        // Supabase returns nutrition as an array (one-to-many FK) — extract first element
        const rawN = item.nutrition;
        const n = Array.isArray(rawN) ? rawN[0] : rawN;
        unique.push({
          id: item.id,
          name: item.name,
          rec_num: item.rec_num,
          station: item.station,
          dining_hall_id: item.dining_hall_id,
          meal: item.meal,
          nutrition: n ?? null,
        });
      }
    }

    return unique;
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to fetch favorites on today\'s menu');
  }
}
