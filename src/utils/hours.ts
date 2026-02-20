import { supabase } from './supabase';

// Default VT dining hall hours — used when dining_hall_hours table has no data
const DEFAULT_MEAL_HOURS = [
  { meal: 'Breakfast', open_time: '07:00:00', close_time: '10:00:00' },
  { meal: 'Lunch',     open_time: '11:00:00', close_time: '14:00:00' },
  { meal: 'Dinner',    open_time: '17:00:00', close_time: '21:00:00' },
];

export interface HallHourRow {
  id: number;
  dining_hall_id: number;
  date: string; // 'YYYY-MM-DD'
  meal: string;
  open_time: string; // 'HH:MM:SS'
  close_time: string;
}

export interface HallStatus {
  isOpen: boolean;
  closingSoon?: boolean;  // within 30 min of closing
  currentMeal?: string;
  closingTime?: string;   // human-readable, e.g. "9:00 PM"
  nextOpen?: string;      // human-readable, e.g. "5:00 PM"
  nextMeal?: string;
}

/** Format a Date to 'YYYY-MM-DD' local string. */
function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Convert 'HH:MM' or 'HH:MM:SS' to minutes since midnight for comparison. */
function timeToMinutes(time: string): number {
  const parts = time.split(':');
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

/** Convert 'HH:MM' or 'HH:MM:SS' to human-readable 12h format, e.g. "5:00 PM". */
function formatTime12h(time: string): string {
  const parts = time.split(':');
  let h = parseInt(parts[0], 10);
  const m = parts[1];
  const ampm = h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${m} ${ampm}`;
}

/**
 * Get all hour entries for a specific hall (all dates).
 */
export async function getHallHours(hallId: number): Promise<HallHourRow[]> {
  try {
    const { data, error } = await supabase
      .from('dining_hall_hours')
      .select('id, dining_hall_id, date, meal, open_time, close_time')
      .eq('dining_hall_id', hallId)
      .order('date')
      .order('open_time');

    if (error) throw new Error(`Failed to fetch hall hours: ${error.message}`);
    return data ?? [];
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to fetch hall hours');
  }
}

/**
 * Check if a specific hall is open at the given time.
 * Returns open/closed status, current meal, closing time, and next opening.
 */
export async function isHallOpen(hallId: number, now: Date): Promise<HallStatus> {
  try {
    const today = toLocalDateStr(now);
    const tomorrow = toLocalDateStr(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    // Fetch today's and tomorrow's hours in one query
    const { data, error } = await supabase
      .from('dining_hall_hours')
      .select('meal, open_time, close_time, date')
      .eq('dining_hall_id', hallId)
      .in('date', [today, tomorrow])
      .order('open_time');

    if (error) throw new Error(`Failed to fetch hall hours: ${error.message}`);

    const rows = data ?? [];
    console.log(`[hours] isHallOpen(${hallId}) returned ${rows.length} rows`);

    // Fallback to default hours if no data
    if (rows.length === 0) {
      console.log(`[hours] No hours for hall ${hallId} — using default VT hours`);
      return computeStatus(nowMinutes, DEFAULT_MEAL_HOURS, DEFAULT_MEAL_HOURS);
    }

    const todayHours = rows.filter((r) => r.date === today);
    const tomorrowHours = rows.filter((r) => r.date === tomorrow);

    return computeStatus(nowMinutes, todayHours, tomorrowHours);
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to check hall status');
  }
}

/**
 * Get open/closed status for ALL halls in a single batch query.
 * Returns a map of dining_hall_id → HallStatus.
 */
export async function getAllHallStatuses(now: Date): Promise<Record<number, HallStatus>> {
  try {
    const today = toLocalDateStr(now);
    const tomorrow = toLocalDateStr(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    // Single query for all halls, today + tomorrow
    const { data, error } = await supabase
      .from('dining_hall_hours')
      .select('dining_hall_id, meal, open_time, close_time, date')
      .in('date', [today, tomorrow])
      .order('open_time');

    if (error) throw new Error(`Failed to fetch hall hours: ${error.message}`);

    const rows = data ?? [];
    console.log(`[hours] dining_hall_hours query returned ${rows.length} rows for ${today}/${tomorrow}`);

    // If table is empty, use default time-based fallback for all halls
    if (rows.length === 0) {
      console.log('[hours] No hours data — using default VT dining hours fallback');
      try {
        const { data: hallsData } = await supabase
          .from('dining_halls')
          .select('id');
        const hallIds = (hallsData ?? []).map((h: { id: number }) => h.id);
        const result: Record<number, HallStatus> = {};
        for (const id of hallIds) {
          result[id] = computeStatus(nowMinutes, DEFAULT_MEAL_HOURS, DEFAULT_MEAL_HOURS);
        }
        return result;
      } catch (fallbackErr) {
        console.log('[hours] Fallback dining_halls query also failed:', fallbackErr);
        return {};
      }
    }

    // Group rows by hall
    const byHall: Record<number, { today: typeof data; tomorrow: typeof data }> = {};
    for (const row of rows) {
      if (!byHall[row.dining_hall_id]) {
        byHall[row.dining_hall_id] = { today: [], tomorrow: [] };
      }
      if (row.date === today) {
        byHall[row.dining_hall_id].today.push(row);
      } else {
        byHall[row.dining_hall_id].tomorrow.push(row);
      }
    }

    // Compute status for each hall (isolate per-hall errors so one bad row doesn't break all badges)
    const result: Record<number, HallStatus> = {};
    for (const [hallIdStr, hours] of Object.entries(byHall)) {
      try {
        result[Number(hallIdStr)] = computeStatus(nowMinutes, hours.today, hours.tomorrow);
      } catch {
        // Skip this hall — malformed data shouldn't prevent other halls from showing badges
      }
    }

    return result;
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to fetch hall statuses');
  }
}

/**
 * Pure logic: given current time and today/tomorrow hour rows, compute HallStatus.
 */
function computeStatus(
  nowMinutes: number,
  todayHours: { meal: string; open_time: string; close_time: string }[],
  tomorrowHours: { meal: string; open_time: string; close_time: string }[]
): HallStatus {
  // Check if currently open (open_time <= now < close_time)
  for (const row of todayHours) {
    const open = timeToMinutes(row.open_time);
    const close = timeToMinutes(row.close_time);
    if (nowMinutes >= open && nowMinutes < close) {
      return {
        isOpen: true,
        closingSoon: (close - nowMinutes) <= 30,
        currentMeal: row.meal,
        closingTime: formatTime12h(row.close_time),
      };
    }
  }

  // Closed — find next opening
  // First check remaining meals today
  for (const row of todayHours) {
    const open = timeToMinutes(row.open_time);
    if (open > nowMinutes) {
      return {
        isOpen: false,
        nextOpen: formatTime12h(row.open_time),
        nextMeal: row.meal,
      };
    }
  }

  // No more meals today — check first meal tomorrow
  if (tomorrowHours.length > 0) {
    const first = tomorrowHours[0];
    return {
      isOpen: false,
      nextOpen: formatTime12h(first.open_time),
      nextMeal: first.meal,
    };
  }

  // No hours data at all
  return { isOpen: false };
}
