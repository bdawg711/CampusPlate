/**
 * Meal filter mapping for database queries.
 *
 * The menu_items table has these meal values:
 *   'Breakfast', 'Lunch', 'Dinner', 'Lunch/Dinner', 'Daily Items'
 *
 * When the user selects a meal filter, we need to include the
 * non-standard labels that belong to that period.
 */

const MEAL_QUERY_MAP: Record<string, string[]> = {
  Breakfast: ['Breakfast', 'Daily Items'],
  Lunch:     ['Lunch', 'Lunch/Dinner', 'Daily Items'],
  Dinner:    ['Dinner', 'Lunch/Dinner', 'Daily Items'],
};

/** Returns the array of DB meal values to query for a given user-facing meal selection. */
export function getMealQueryValues(meal: string): string[] {
  return MEAL_QUERY_MAP[meal] || [meal];
}

/**
 * Determines the current meal period based on time of day.
 * Before 10:30 → Breakfast, before 16:30 → Lunch, else Dinner.
 */
export function getCurrentMealPeriod(): string {
  const h = new Date().getHours();
  const m = new Date().getMinutes();
  if (h < 10 || (h === 10 && m < 30)) return 'Breakfast';
  if (h < 16 || (h === 16 && m < 30)) return 'Lunch';
  return 'Dinner';
}

/**
 * Checks if a meal log belongs to a given meal group for display purposes.
 *
 * meal_logs.meal is normally 'Breakfast'/'Lunch'/'Dinner' (set by the user's
 * filter at log time). But if a log somehow has 'Lunch/Dinner' or 'Daily Items',
 * this handles it without double-counting:
 *   - 'Lunch/Dinner' → shows in both Lunch and Dinner sections
 *   - 'Daily Items'  → shows in the current meal period only
 */
export function logBelongsToMealGroup(logMeal: string, group: string): boolean {
  if (logMeal === group) return true;
  if (logMeal === 'Lunch/Dinner') return group === 'Lunch' || group === 'Dinner';
  if (logMeal === 'Daily Items') return group === getCurrentMealPeriod();
  return false;
}
