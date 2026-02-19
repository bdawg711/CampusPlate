import { supabase } from './supabase';

export interface PlannedMeal {
  id: number;
  menu_item_id: number;
  meal: string;
  servings: number;
  menu_items: {
    id: number;
    name: string;
    station: string;
    dining_hall_id: number;
    nutrition: {
      calories: number;
      protein_g: number;
      total_carbs_g: number;
      total_fat_g: number;
    } | null;
  };
}

export interface PlannedMealsSummary {
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  itemCount: number;
}

/**
 * Add an item to the meal plan for a given date.
 */
export async function addToPlan(
  userId: string,
  menuItemId: number,
  date: string,
  meal: string,
  servings: number = 1
): Promise<void> {
  try {
    const { error } = await supabase
      .from('meal_plans')
      .insert({
        user_id: userId,
        menu_item_id: menuItemId,
        date,
        meal,
        servings,
      });

    if (error) throw new Error(`Failed to add to plan: ${error.message}`);
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to add to plan');
  }
}

/**
 * Remove an item from the meal plan for a given date.
 */
export async function removeFromPlan(
  userId: string,
  menuItemId: number,
  date: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from('meal_plans')
      .delete()
      .eq('user_id', userId)
      .eq('menu_item_id', menuItemId)
      .eq('date', date);

    if (error) throw new Error(`Failed to remove from plan: ${error.message}`);
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to remove from plan');
  }
}

/**
 * Get all planned meals for a user on a given date, with nutrition data.
 * Access nutrition via: item.menu_items.nutrition.calories * item.servings
 */
export async function getPlannedMeals(
  userId: string,
  date: string
): Promise<PlannedMeal[]> {
  try {
    const { data, error } = await supabase
      .from('meal_plans')
      .select('id, menu_item_id, meal, servings, menu_items(id, name, station, dining_hall_id, nutrition(calories, protein_g, total_carbs_g, total_fat_g))')
      .eq('user_id', userId)
      .eq('date', date)
      .order('created_at');

    if (error) throw new Error(`Failed to fetch planned meals: ${error.message}`);

    // Normalize nutrition: Supabase returns it as an array (one-to-many FK) — extract first element
    const normalized = (data ?? []).map((row: any) => {
      const mi = row.menu_items;
      if (mi) {
        const rawN = mi.nutrition;
        mi.nutrition = Array.isArray(rawN) ? rawN[0] ?? null : rawN;
      }
      return row;
    });

    return normalized as unknown as PlannedMeal[];
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to fetch planned meals');
  }
}

/**
 * Get total calories, protein, carbs, and fat for a user's planned day.
 * Multiplies each item's nutrition by its servings.
 */
export async function getPlannedMealsSummary(
  userId: string,
  date: string
): Promise<PlannedMealsSummary> {
  try {
    const meals = await getPlannedMeals(userId, date);

    let totalCalories = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFat = 0;

    for (const item of meals) {
      const n = item.menu_items?.nutrition;
      if (n) {
        totalCalories += (n.calories ?? 0) * item.servings;
        totalProtein += (n.protein_g ?? 0) * item.servings;
        totalCarbs += (n.total_carbs_g ?? 0) * item.servings;
        totalFat += (n.total_fat_g ?? 0) * item.servings;
      }
    }

    return {
      totalCalories: Math.round(totalCalories),
      totalProtein: Math.round(totalProtein),
      totalCarbs: Math.round(totalCarbs),
      totalFat: Math.round(totalFat),
      itemCount: meals.length,
    };
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to fetch planned meals summary');
  }
}
