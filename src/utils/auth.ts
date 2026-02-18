import { supabase } from './supabase';

export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function resetPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: 'campusplate://reset',
  });
  if (error) throw error;
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export function onAuthChange(callback: (session: any) => void) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
  return data.subscription;
}

export async function getCurrentUserId(): Promise<string | null> {
  const session = await getSession();
  return session?.user?.id ?? null;
}

/** Returns the current user ID, throws if not authenticated */
export async function requireUserId(): Promise<string> {
  const id = await getCurrentUserId();
  if (!id) throw new Error('Not authenticated');
  return id;
}
