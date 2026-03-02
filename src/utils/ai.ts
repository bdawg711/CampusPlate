import { supabase } from './supabase';
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
 * Sends a message to the AI chat Edge Function.
 * Returns the assistant's response content and any meal item suggestions.
 */
export async function sendMessage(
  message: string,
  history: ChatMessage[]
): Promise<{ content: string; mealItems: MealItem[] | null }> {
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

  const supabaseUrl = 'https://kexytkfzoomvhjcotkqs.supabase.co';
  const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtleHl0a2Z6b29tdmhqY290a3FzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzNjk4OTMsImV4cCI6MjA4Njk0NTg5M30.UiXS-ZHAKpS6xrg1D4BEBv0BEv2V1YpU2PR3ynQP3ag';

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
