import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kexytkfzoomvhjcotkqs.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtleHl0a2Z6b29tdmhqY290a3FzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzNjk4OTMsImV4cCI6MjA4Njk0NTg5M30.UiXS-ZHAKpS6xrg1D4BEBv0BEv2V1YpU2PR3ynQP3ag';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
