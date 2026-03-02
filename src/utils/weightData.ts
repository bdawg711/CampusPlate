import { supabase } from './supabase';

// ── Types ────────────────────────────────────────────────────────────────────

export interface WeightEntry {
  date: string;
  weight: number;
}

export interface WeightTrend {
  average: number;
  difference: number;       // last - first
  change3Day: number | null;
  change7Day: number | null;
  smoothed: { date: string; weight: number }[];
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

// ── getWeightHistory ─────────────────────────────────────────────────────────

export async function getWeightHistory(
  userId: string,
  days: number = 30
): Promise<WeightEntry[]> {
  const today = getLocalDate();
  const startDate = subtractDays(today, days);

  try {
    const { data, error } = await supabase
      .from('weight_logs')
      .select('date, weight_lbs')
      .eq('user_id', userId)
      .gte('date', startDate)
      .order('date', { ascending: true });

    if (error || !data) return [];

    return data.map((row: any) => ({
      date: row.date as string,
      weight: row.weight_lbs as number,
    }));
  } catch {
    return [];
  }
}

// ── calculateWeightTrend ─────────────────────────────────────────────────────

export function calculateWeightTrend(entries: WeightEntry[]): WeightTrend {
  if (entries.length === 0) {
    return { average: 0, difference: 0, change3Day: null, change7Day: null, smoothed: [] };
  }

  // Average
  const sum = entries.reduce((acc, e) => acc + e.weight, 0);
  const average = Math.round((sum / entries.length) * 10) / 10;

  // Difference: last - first
  const difference = Math.round((entries[entries.length - 1].weight - entries[0].weight) * 10) / 10;

  // change3Day: last weight minus weight from ~3 entries ago (or closest)
  const lastWeight = entries[entries.length - 1].weight;
  const change3Day = entries.length >= 4
    ? Math.round((lastWeight - entries[entries.length - 4].weight) * 10) / 10
    : null;

  // change7Day: last weight minus weight from ~7 entries ago (or closest)
  const change7Day = entries.length >= 8
    ? Math.round((lastWeight - entries[entries.length - 8].weight) * 10) / 10
    : null;

  // Smoothed: 3-point moving average
  const smoothed: { date: string; weight: number }[] = [];
  for (let i = 0; i < entries.length; i++) {
    if (i === 0) {
      // First point: average of first two (or just first if only one)
      const avg = entries.length > 1
        ? (entries[0].weight + entries[1].weight) / 2
        : entries[0].weight;
      smoothed.push({ date: entries[i].date, weight: Math.round(avg * 10) / 10 });
    } else if (i === entries.length - 1) {
      // Last point: average of last two
      const avg = (entries[i - 1].weight + entries[i].weight) / 2;
      smoothed.push({ date: entries[i].date, weight: Math.round(avg * 10) / 10 });
    } else {
      // Middle points: 3-point average
      const avg = (entries[i - 1].weight + entries[i].weight + entries[i + 1].weight) / 3;
      smoothed.push({ date: entries[i].date, weight: Math.round(avg * 10) / 10 });
    }
  }

  return { average, difference, change3Day, change7Day, smoothed };
}
