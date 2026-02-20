import { supabase } from './supabase';

// ── Constants ────────────────────────────────────────────────────────────────

export const FDA_DAILY_VALUES = {
  saturatedFat: { amount: 20, unit: 'g', column: 'sat_fat_g' },
  transFat:     { amount: 0, unit: 'g', column: 'trans_fat_g' },
  cholesterol:  { amount: 300, unit: 'mg', column: 'cholesterol_mg' },
  sodium:       { amount: 2300, unit: 'mg', column: 'sodium_mg' },
  fiber:        { amount: 28, unit: 'g', column: 'dietary_fiber_g' },
  sugars:       { amount: 0, unit: 'g', column: 'sugars_g' },          // no official target
  addedSugars:  { amount: 50, unit: 'g', column: 'added_sugars_g' },
  vitaminD:     { amount: 20, unit: 'mcg', column: 'vitamin_d_mcg' },
  calcium:      { amount: 1000, unit: 'mg', column: 'calcium_mg' },
  iron:         { amount: 18, unit: 'mg', column: 'iron_mg' },
  potassium:    { amount: 4700, unit: 'mg', column: 'potassium_mg' },
} as const;

// ── Types ────────────────────────────────────────────────────────────────────

export interface MicronutrientData {
  saturatedFat: number;
  transFat: number;
  cholesterol: number;
  sodium: number;
  fiber: number;
  sugars: number;
  addedSugars: number;
  vitaminD: number;
  calcium: number;
  iron: number;
  potassium: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const EMPTY: MicronutrientData = {
  saturatedFat: 0, transFat: 0, cholesterol: 0, sodium: 0,
  fiber: 0, sugars: 0, addedSugars: 0,
  vitaminD: 0, calcium: 0, iron: 0, potassium: 0,
};

function sumRows(rows: any[]): MicronutrientData {
  const result = { ...EMPTY };
  for (const row of rows) {
    const servings = (row.servings ?? 1) as number;
    const n = row.menu_items?.nutrition;
    if (!n) continue;
    result.saturatedFat += (n.sat_fat_g ?? 0) * servings;
    result.transFat    += (n.trans_fat_g ?? 0) * servings;
    result.cholesterol += (n.cholesterol_mg ?? 0) * servings;
    result.sodium      += (n.sodium_mg ?? 0) * servings;
    result.fiber       += (n.dietary_fiber_g ?? 0) * servings;
    result.sugars      += (n.sugars_g ?? 0) * servings;
    result.addedSugars += (n.added_sugars_g ?? 0) * servings;
    result.vitaminD    += (n.vitamin_d_mcg ?? 0) * servings;
    result.calcium     += (n.calcium_mg ?? 0) * servings;
    result.iron        += (n.iron_mg ?? 0) * servings;
    result.potassium   += (n.potassium_mg ?? 0) * servings;
  }
  return roundAll(result);
}

function roundAll(d: MicronutrientData): MicronutrientData {
  return {
    saturatedFat: Math.round(d.saturatedFat * 10) / 10,
    transFat:     Math.round(d.transFat * 10) / 10,
    cholesterol:  Math.round(d.cholesterol),
    sodium:       Math.round(d.sodium),
    fiber:        Math.round(d.fiber * 10) / 10,
    sugars:       Math.round(d.sugars * 10) / 10,
    addedSugars:  Math.round(d.addedSugars * 10) / 10,
    vitaminD:     Math.round(d.vitaminD * 10) / 10,
    calcium:      Math.round(d.calcium),
    iron:         Math.round(d.iron * 10) / 10,
    potassium:    Math.round(d.potassium),
  };
}

const MICRO_SELECT = 'servings, menu_items(nutrition(sat_fat_g, trans_fat_g, cholesterol_mg, sodium_mg, dietary_fiber_g, sugars_g, added_sugars_g, vitamin_d_mcg, calcium_mg, iron_mg, potassium_mg))';

// ── getDailyMicronutrients ───────────────────────────────────────────────────

export async function getDailyMicronutrients(
  userId: string,
  date: string
): Promise<MicronutrientData> {
  try {
    const { data, error } = await supabase
      .from('meal_logs')
      .select(MICRO_SELECT)
      .eq('user_id', userId)
      .eq('date', date);

    if (error || !data) return { ...EMPTY };
    return sumRows(data);
  } catch {
    return { ...EMPTY };
  }
}

// ── getPeriodMicronutrients ──────────────────────────────────────────────────

export async function getPeriodMicronutrients(
  userId: string,
  startDate: string,
  endDate: string
): Promise<MicronutrientData> {
  try {
    const { data, error } = await supabase
      .from('meal_logs')
      .select(MICRO_SELECT + ', date')
      .eq('user_id', userId)
      .gte('date', startDate)
      .lte('date', endDate);

    if (error || !data || data.length === 0) return { ...EMPTY };

    // Sum all values
    const totals = sumRows(data);

    // Divide by unique dates to get daily average
    const uniqueDates = new Set(data.map((row: any) => row.date));
    const numDays = uniqueDates.size || 1;

    return roundAll({
      saturatedFat: totals.saturatedFat / numDays,
      transFat:     totals.transFat / numDays,
      cholesterol:  totals.cholesterol / numDays,
      sodium:       totals.sodium / numDays,
      fiber:        totals.fiber / numDays,
      sugars:       totals.sugars / numDays,
      addedSugars:  totals.addedSugars / numDays,
      vitaminD:     totals.vitaminD / numDays,
      calcium:      totals.calcium / numDays,
      iron:         totals.iron / numDays,
      potassium:    totals.potassium / numDays,
    });
  } catch {
    return { ...EMPTY };
  }
}
