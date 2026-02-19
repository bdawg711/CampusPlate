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

export async function addWater(userId: string, ounces: number): Promise<number> {
  const today = getLocalDate();
  const current = await getTodayWater(userId);
  const newTotal = current + ounces;

  const { error } = await supabase
    .from('water_logs')
    .upsert(
      { user_id: userId, date: today, glasses: newTotal, updated_at: new Date().toISOString() }, // timestamptz column — toISOString is safe here, not a date column
      { onConflict: 'user_id,date' }
    );
  if (error) throw new Error(`Failed to add water: ${error.message}`);

  return newTotal;
}

export async function getWaterGoal(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from('profiles')
    .select('water_goal_oz')
    .eq('id', userId)
    .single();

  if (error || !data || data.water_goal_oz == null) return 64;
  return data.water_goal_oz;
}

export async function setWaterGoal(userId: string, goalOz: number): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ water_goal_oz: goalOz })
    .eq('id', userId);
  if (error) throw new Error(`Failed to set water goal: ${error.message}`);
}

export async function removeWater(userId: string, ounces: number): Promise<number> {
  const today = getLocalDate();
  const current = await getTodayWater(userId);
  const newTotal = Math.max(current - ounces, 0);

  const { error } = await supabase
    .from('water_logs')
    .upsert(
      { user_id: userId, date: today, glasses: newTotal, updated_at: new Date().toISOString() }, // timestamptz column — toISOString is safe here, not a date column
      { onConflict: 'user_id,date' }
    );
  if (error) throw new Error(`Failed to remove water: ${error.message}`);

  return newTotal;
}
