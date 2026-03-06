import { supabase, supabaseUrl, supabaseAnonKey } from './supabase';
import { getEffectiveMenuDate } from './meals';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  meal_items?: MealItem[] | null;
}

export interface MealItem {
  id: number;
  name: string;
  hall: string;
  meal: string;
  station: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface ChatLogRow {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  meal_items: MealItem[] | null;
  created_at: string;
}

/**
 * Fetches the current user's AI usage for today.
 */
export async function getAIUsage(userId: string): Promise<{ messageCount: number; dailyLimit: number }> {
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  try {
    const { data, error } = await supabase
      .from('ai_usage')
      .select('message_count')
      .eq('user_id', userId)
      .eq('date', today)
      .maybeSingle();

    if (error) {
      console.warn('Failed to fetch AI usage:', error.message);
      return { messageCount: 0, dailyLimit: 25 };
    }

    return { messageCount: data?.message_count ?? 0, dailyLimit: 25 };
  } catch {
    return { messageCount: 0, dailyLimit: 25 };
  }
}

/**
 * Sends a message to the AI chat Edge Function.
 * Returns the assistant's response content and any meal item suggestions.
 */
export async function sendMessage(
  message: string,
  history: ChatMessage[]
): Promise<{ content: string; mealItems: MealItem[] | null; remaining?: number; dailyLimit?: number }> {
  // Verify we have an active session (JWT) before calling the Edge Function
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData?.session) {
    throw new Error('Your session has expired. Please log in again.');
  }

  const date = await getEffectiveMenuDate();
  const session = sessionData.session;

  // Only send last 10 messages as context — exclude the current user message
  // since it's passed separately as `message`. The Edge Function expects
  // history to be prior conversation context only.
  const trimmedHistory = history.slice(-10).map((m) => ({
    role: m.role,
    content: m.content,
  }));

  // userId is derived server-side from the JWT — never sent by the client
  const invokeBody = { message, history: trimmedHistory, date };

  const response = await fetch(`${supabaseUrl}/functions/v1/ai-chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseAnonKey,
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(invokeBody),
  });

  const responseText = await response.text();

  if (!response.ok) {
    console.error(`[AI] Edge Function error — status=${response.status}, body=${responseText}`);
    throw new Error(`AI error (${response.status}): ${responseText}`);
  }

  const data = JSON.parse(responseText);

  if (data?.error) {
    if (__DEV__) console.error('[AI] Function returned error in body:', data.error);
    throw new Error(data.error);
  }

  return {
    content: data?.content ?? '',
    mealItems: data?.mealItems ?? null,
    remaining: data?.remaining,
    dailyLimit: data?.dailyLimit,
  };
}

/**
 * Estimated meal nutrition response from the AI.
 */
export interface EstimatedMeal {
  name: string;
  calories: number;
  protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
  remaining: number;
  estimateLimit: number;
}

/**
 * Sends a meal description to the AI for nutrition estimation.
 * Uses a separate daily limit (15/day) tracked as estimate_count.
 */
export async function estimateMeal(description: string): Promise<EstimatedMeal> {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData?.session) {
    throw new Error('Your session has expired. Please log in again.');
  }

  const session = sessionData.session;

  const response = await fetch(`${supabaseUrl}/functions/v1/ai-chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseAnonKey,
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ mode: 'estimate_meal', description }),
  });

  const responseText = await response.text();

  if (!response.ok) {
    let errorMsg = `AI error (${response.status})`;
    try {
      const parsed = JSON.parse(responseText);
      if (parsed?.error) errorMsg = parsed.error;
    } catch { /* use default */ }
    throw new Error(errorMsg);
  }

  const data = JSON.parse(responseText);
  if (data?.error) {
    throw new Error(data.error);
  }

  return {
    name: data.name ?? 'Custom Meal',
    calories: data.calories ?? 0,
    protein_g: data.protein_g ?? 0,
    total_carbs_g: data.total_carbs_g ?? 0,
    total_fat_g: data.total_fat_g ?? 0,
    remaining: data.remaining ?? 0,
    estimateLimit: data.estimateLimit ?? 15,
  };
}

// ── Meal Plan types ──────────────────────────────────────────────────────────

export interface MealPlanItem {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface MealPlanMeal {
  type: 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';
  time: string;
  location: string;
  items: MealPlanItem[];
  totalCalories: number;
  note: string;
}

export interface MealPlanResponse {
  meals: MealPlanMeal[];
  dailyTotal: { calories: number; protein: number; carbs: number; fat: number };
  tip: string;
  remaining: number;
  planLimit: number;
}

/**
 * Requests a daily meal plan from the AI Edge Function.
 */
export async function requestMealPlan(
  schedule: { name: string; start: string; end: string; location?: string }[],
  goals: { calories: number; protein: number; carbs: number; fat: number },
  preferences: { dietary: string[]; allergies: string[] },
): Promise<MealPlanResponse> {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData?.session) {
    throw new Error('Your session has expired. Please log in again.');
  }

  const session = sessionData.session;

  const response = await fetch(`${supabaseUrl}/functions/v1/ai-chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseAnonKey,
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      mode: 'meal_plan',
      schedule,
      goals,
      preferences,
    }),
  });

  const responseText = await response.text();

  if (!response.ok) {
    let errorMsg = `AI error (${response.status})`;
    try {
      const parsed = JSON.parse(responseText);
      if (parsed?.error) errorMsg = parsed.error;
    } catch { /* use default */ }
    throw new Error(errorMsg);
  }

  const data = JSON.parse(responseText);
  if (data?.error) {
    throw new Error(data.error);
  }

  return {
    meals: data.meals ?? [],
    dailyTotal: data.dailyTotal ?? { calories: 0, protein: 0, carbs: 0, fat: 0 },
    tip: data.tip ?? '',
    remaining: data.remaining ?? 0,
    planLimit: data.planLimit ?? 3,
  };
}

/**
 * Fetches the full chat history for a user, ordered oldest-first.
 */
export async function getChatHistory(userId: string): Promise<ChatLogRow[]> {
  const { data, error } = await supabase
    .from('ai_chat_logs')
    .select('id, role, content, meal_items, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(error.message || 'Failed to load chat history');
  }

  return (data as ChatLogRow[]) ?? [];
}

/**
 * Deletes all chat history for a user.
 */
export async function clearChatHistory(userId: string): Promise<void> {
  const { error } = await supabase
    .from('ai_chat_logs')
    .delete()
    .eq('user_id', userId);

  if (error) {
    throw new Error(error.message || 'Failed to clear chat history');
  }
}
