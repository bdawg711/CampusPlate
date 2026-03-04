import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import {
  initializePurchases,
  checkSubscription,
  purchaseMonthly,
  restorePurchases,
} from '@/src/utils/purchases';
import { getSession } from '@/src/utils/auth';

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

  // Initialize RevenueCat and check subscription on mount
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        if (Platform.OS === 'web') {
          if (mounted) setLoading(false);
          return;
        }

        const session = await getSession();
        const userId = session?.user?.id;

        if (!initialized.current) {
          await initializePurchases(userId);
          initialized.current = true;
        }

        const { isPremium: premium } = await checkSubscription();
        if (mounted) {
          setIsPremium(premium);
          if (__DEV__) console.log('[Subscription] Status on mount:', premium ? 'premium' : 'free');
        }
      } catch (e: any) {
        console.warn('[Subscription] Init error:', e?.message);
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
    try {
      const success = await purchaseMonthly();
      if (success) {
        setIsPremium(true);
      }
      return success;
    } catch (e: any) {
      console.warn('[Subscription] Purchase error:', e?.message);
      throw e;
    }
  }, []);

  const restore = useCallback(async (): Promise<boolean> => {
    try {
      const success = await restorePurchases();
      setIsPremium(success);
      return success;
    } catch (e: any) {
      console.warn('[Subscription] Restore error:', e?.message);
      throw e;
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
