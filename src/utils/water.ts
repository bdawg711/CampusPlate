import { supabase } from './supabase';

function getLocalDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function getTodayWater(userId: string): Promise<number> {
  const today = getLocalDate();
  const { data, error } = await supabase
    .from('water_logs')
    .select('glasses')
    .eq('user_id', userId)
    .eq('date', today)
    .single();

  if (error || !data) return 0;
  return data.glasses ?? 0;
}

export async function addGlass(userId: string): Promise<number> {
  const today = getLocalDate();
  const current = await getTodayWater(userId);
  const next = current + 1;

  await supabase
    .from('water_logs')
    .upsert(
      { user_id: userId, date: today, glasses: next, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,date' }
    );

  return next;
}

export async function removeGlass(userId: string): Promise<number> {
  const today = getLocalDate();
  const current = await getTodayWater(userId);
  if (current <= 0) return 0;

  const next = current - 1;

  await supabase
    .from('water_logs')
    .upsert(
      { user_id: userId, date: today, glasses: next, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,date' }
    );

  return next;
}
