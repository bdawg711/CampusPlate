# Debug Report — CampusPlate Sprint 2

**Date:** 2026-02-19
**Symptoms:** UI issues, data not loading on dashboard and browse tabs

---

## TypeScript Errors (`npx tsc --noEmit`)

### TS Error 1: browse.tsx — Block-scoped variable used before declaration
- **File:** `app/(tabs)/browse.tsx:314`
- **Error:** `TS2448: Block-scoped variable 'loadPlannedItems' used before its declaration`
- **Error:** `TS2454: Variable 'loadPlannedItems' is used before being assigned`
- **What's wrong:** `loadPlannedItems` is declared with `const` at line 322, but referenced in the `useFocusEffect` dependency array at line 314 (before the declaration). This is a Temporal Dead Zone (TDZ) violation.
- **Impact:** May cause runtime crash in strict environments. Babel transpilation currently masks this.
- **Fix:** Move `loadPlannedItems` declaration above the `useFocusEffect` call.

### TS Error 2: favorites.ts — Array-to-object type mismatch
- **File:** `src/utils/favorites.ts:152`
- **Error:** `TS2352: Conversion of type '{ ... }[]' to type '{ ... }' may be a mistake`
- **What's wrong:** The Supabase `nutrition(...)` join returns an **array** (one-to-many FK from `nutrition.menu_item_id → menu_items.id`), but the code casts it directly to a single object `{ calories, protein_g, ... }`.
- **Impact:** `f.nutrition?.calories` returns `undefined` → all favorites show **0 calories** on dashboard.
- **Fix:** Extract the first element from the nutrition array before casting.

---

## Code Review Bugs

### Bug 1 (CRITICAL): hours.ts queries by `day_of_week` but table uses `date`
- **File:** `src/utils/hours.ts` — lines 6, 44, 62-71, 91-100
- **What's wrong:** The `dining_hall_hours` table was changed from a `day_of_week` (integer 0-6) column to a `date` (DATE) column. But the code still:
  - Has `day_of_week: number` in the `HallHourRow` interface
  - Selects `day_of_week` in queries
  - Filters by `.in('day_of_week', [dayOfWeek, nextDay])` using `now.getDay()`
  - Groups results by `day_of_week` comparison
- **Impact:** ALL hall status queries return **empty results**. This breaks:
  - "Open Now" section on dashboard (never shows)
  - Open/closed badges on browse hall cards (never shows)
  - `getQuickAndLight()` recommendations (depends on open halls → always empty)
  - `getTopRatedHalls()` open status (always shows "Closed")
- **Fix:** Rewrite `HallHourRow` to use `date: string`, rewrite all queries to use `.in('date', [todayStr, tomorrowStr])`, group by date string comparison.

### Bug 2 (CRITICAL): recommendations.ts — nutrition array not handled
- **File:** `src/utils/recommendations.ts` — lines 74-78, 217-219, 241
- **What's wrong:** Same array issue as favorites.ts. The `nutrition(...)` join returns an array, but `mapToRecommendedItem()` and filter functions access `item.nutrition.calories` directly on the array.
- **Impact:**
  - `getFitsYourMacros()` — `n.calories` is `undefined`, `cal` defaults to 0, ALL items filtered out → **empty results**
  - `getQuickAndLight()` — same, `n.calories` is `undefined` → **empty results**
  - `mapToRecommendedItem()` — all nutrition values are 0
- **Fix:** Add `const n = Array.isArray(item.nutrition) ? item.nutrition[0] : item.nutrition` before accessing nutrition properties.

### Bug 3 (MODERATE): mealPlans.ts — nutrition array not normalized
- **File:** `src/utils/mealPlans.ts` — line 90, consumed in `index.tsx` lines 766-780
- **What's wrong:** `getPlannedMeals()` returns the raw Supabase response where `menu_items.nutrition` is an array. The `PlannedMeal` interface types it as an object. Consuming code in index.tsx does `m.menu_items?.nutrition?.calories` which returns `undefined` on an array.
- **Impact:** Meal plan summary card shows **0 calories**, 0g for all macros.
- **Fix:** Normalize nutrition to extract first array element in `getPlannedMeals()`.

### Bug 4 (LOW): index.tsx — loadData doesn't depend on planDayOffset
- **File:** `app/(tabs)/index.tsx:259`
- **What's wrong:** `loadData` is memoized with `useCallback(..., [])` (empty deps) but closes over `planDayOffset`. On pull-to-refresh, it always uses the initial offset (1) regardless of the currently selected day.
- **Impact:** Pull-to-refresh may reload the wrong day's meal plan. Minor since the day switcher reloads independently.
- **Fix:** Not critical — acceptable behavior since `handlePlanDayChange` handles day switches separately.

---

## Summary of Fixes Applied

| # | File | Line(s) | Severity | Fix |
|---|------|---------|----------|-----|
| 1 | `src/utils/hours.ts` | 3-100+ | CRITICAL | Rewrite all queries from `day_of_week` to `date` column |
| 2 | `src/utils/recommendations.ts` | 74, 217, 241 | CRITICAL | Handle nutrition array with `Array.isArray` check |
| 3 | `src/utils/favorites.ts` | 145-155 | MODERATE | Extract first element from nutrition array |
| 4 | `src/utils/mealPlans.ts` | 86-96 | MODERATE | Normalize nutrition array in `getPlannedMeals()` |
| 5 | `app/(tabs)/browse.tsx` | 297-332 | LOW | Move `loadPlannedItems` before `useFocusEffect` |
