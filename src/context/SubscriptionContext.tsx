import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Alert, AppState, AppStateStatus, Platform } from 'react-native';
import {
  initializePurchases,
  checkSubscription,
  purchaseMonthly,
  restorePurchases,
} from '@/src/utils/purchases';
import { getSession } from '@/src/utils/auth';
import { supabase } from '@/src/utils/supabase';

interface SubscriptionContextType {
  isPremium: boolean;
  loading: boolean;
  purchase: () => Promise<boolean>;
  restore: () => Promise<boolean>;
}

const SubscriptionContext = createContext<SubscriptionContextType>({
  isPremium: false,
  loading: true,
  purchase: async () => false,
  restore: async () => false,
});

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);
  const appState = useRef(AppState.currentState);
  const initialized = useRef(false);

  // Track whether premium was granted via Supabase (skip RevenueCat calls)
  const devBypass = useRef(false);

  // Initialize: check Supabase is_premium FIRST, only fall back to RevenueCat if false
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        if (Platform.OS === 'web') {
          if (mounted) setLoading(false);
          return;
        }

        const session = await getSession();
        const sessionUserId = session?.user?.id;

        // Cross-check: also get user ID from getUser() to verify
        const { data: authData } = await supabase.auth.getUser();
        const getUserUserId = authData?.user?.id;
        if (__DEV__) console.log('[Subscription] userId from getSession:', sessionUserId ?? 'none');
        if (__DEV__) console.log('[Subscription] userId from getUser:', getUserUserId ?? 'none');
        if (sessionUserId !== getUserUserId) {
          console.warn('[Subscription] USER ID MISMATCH! getSession:', sessionUserId, 'getUser:', getUserUserId);
        }

        const userId = getUserUserId || sessionUserId;

        // Step 1: Check profiles.is_premium from Supabase FIRST
        if (userId) {
          try {
            const { data, error } = await supabase
              .from('profiles')
              .select('is_premium')
              .eq('id', userId)
              .single();

            if (__DEV__) console.log('[Subscription] Supabase profiles query result:', JSON.stringify(data));
            if (__DEV__) console.log('[Subscription] Supabase profiles query error:', error ? JSON.stringify(error) : 'none');

            if (data?.is_premium === true) {
              devBypass.current = true;
              if (__DEV__) console.log('[Subscription] BYPASS ACTIVE — premium via Supabase, skipping RevenueCat entirely');
              if (mounted) {
                setIsPremium(true);
                setLoading(false);
              }
              // Return early — do NOT configure or touch RevenueCat
              return;
            }
          } catch (e: any) {
            if (__DEV__) console.log('[Subscription] Supabase premium check failed:', e?.message);
          }
        }

        // Step 2: Supabase said not premium (or failed) — try RevenueCat
        if (__DEV__) console.log('[Subscription] No Supabase bypass, initializing RevenueCat...');
        if (!initialized.current) {
          try {
            await initializePurchases(userId);
            initialized.current = true;
          } catch (e: any) {
            console.warn('[Subscription] RevenueCat init failed (Expo Go?):', e?.message);
            if (mounted) setLoading(false);
            return;
          }
        }

        const { isPremium: premium } = await checkSubscription();
        if (__DEV__) console.log('[Subscription] RevenueCat status on mount:', premium ? 'premium' : 'free');
        if (mounted) {
          setIsPremium(premium);
        }
      } catch (e: any) {
        if (__DEV__) console.warn('[Subscription] Init error:', e?.message);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // Re-check subscription when app comes to foreground
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const handleAppStateChange = async (nextState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        // Skip RevenueCat check if premium via Supabase bypass
        if (devBypass.current) return;

        try {
          const { isPremium: premium } = await checkSubscription();
          setIsPremium(premium);
          if (__DEV__) console.log('[Subscription] Foreground re-check:', premium ? 'premium' : 'free');
        } catch (e: any) {
          console.warn('[Subscription] Foreground check error:', e?.message);
        }
      }
      appState.current = nextState;
    };

    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => sub.remove();
  }, []);

  const purchase = useCallback(async (): Promise<boolean> => {
    if (!initialized.current) {
      Alert.alert('Not Available', 'In-app purchases are not available in this environment. Use Supabase to toggle premium for testing.');
      return false;
    }
    try {
      const success = await purchaseMonthly();
      if (success) {
        setIsPremium(true);
      }
      return success;
    } catch (e: any) {
      console.warn('[Subscription] Purchase error:', e?.message);
      Alert.alert('Purchase Failed', 'Something went wrong. Please try again later.');
      return false;
    }
  }, []);

  const restore = useCallback(async (): Promise<boolean> => {
    if (!initialized.current) {
      Alert.alert('Not Available', 'In-app purchases are not available in this environment. Use Supabase to toggle premium for testing.');
      return false;
    }
    try {
      const success = await restorePurchases();
      setIsPremium(success);
      return success;
    } catch (e: any) {
      console.warn('[Subscription] Restore error:', e?.message);
      Alert.alert('Restore Failed', 'Something went wrong. Please try again later.');
      return false;
    }
  }, []);

  return (
    <SubscriptionContext.Provider value={{ isPremium, loading, purchase, restore }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  return useContext(SubscriptionContext);
}
