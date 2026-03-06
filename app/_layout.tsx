import { useFonts } from 'expo-font';
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
import {
  Outfit_300Light,
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
  Outfit_800ExtraBold,
} from '@expo-google-fonts/outfit';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { getSession, onAuthChange } from '@/src/utils/auth';
import { supabase } from '@/src/utils/supabase';
import { loadMealReminders, scheduleMealReminders } from '@/src/utils/notifications';
import { ThemeProvider, useTheme } from '@/src/context/ThemeContext';
import { SubscriptionProvider } from '@/src/context/SubscriptionContext';
import { RestyleProvider } from '@/src/theme/RestyleProvider';
import AuthScreen from './auth';
import OnboardingScreen from './onboarding';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootContent() {
  const { colors, mode } = useTheme();
  const [loaded, error] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
    Outfit_300Light,
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
    Outfit_800ExtraBold,
  });

  const [session, setSession] = useState<any>(undefined);
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  useEffect(() => {
    getSession()
      .then((s) => {
        if (__DEV__) console.log('[AuthFlow] Initial session check:', s ? 'found session' : 'no session');
        setSession(s ?? null);
      })
      .catch(() => {
        if (__DEV__) console.log('[AuthFlow] Session check failed, showing auth');
        setSession(null);
      });

    const subscription = onAuthChange((s) => {
      if (__DEV__) console.log('[AuthFlow] Auth state changed:', s ? 'signed in' : 'signed out');
      setSession(s ?? null);
      if (!s) setOnboardingComplete(undefined);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setOnboardingComplete(undefined);
      return;
    }
    (async () => {
      try {
        const { data, error: profileError } = await supabase
          .from('profiles')
          .select('onboarding_complete')
          .eq('id', session.user.id)
          .single();
        if (profileError) {
          if (__DEV__) console.log('[AuthFlow] No profile found, showing onboarding. Error:', profileError.message);
          setOnboardingComplete(false);
          return;
        }
        if (__DEV__) console.log('[AuthFlow] Profile found: onboarding_complete =', data?.onboarding_complete);
        setOnboardingComplete(data?.onboarding_complete === true);
      } catch (e: any) {
        if (__DEV__) console.log('[AuthFlow] Profile check exception:', e.message);
        setOnboardingComplete(false);
      }
    })();
  }, [session]);

  // ── Auth deep-link handler (email verification) ──
  useEffect(() => {
    const handleUrl = async (url: string) => {
      try {
        const parsed = Linking.parse(url);
        if (!parsed.path?.startsWith('auth/callback')) return;

        const tokenHash = parsed.queryParams?.token_hash as string | undefined;
        const type = parsed.queryParams?.type as string | undefined;
        if (!tokenHash || !type) return;

        const { error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: type as 'signup' | 'email',
        });
        if (verifyError) {
          if (__DEV__) console.error('[DeepLink] verifyOtp failed:', verifyError.message);
        } else {
          if (__DEV__) console.log('[DeepLink] Email verified successfully');
          // onAuthStateChange will fire and update session → navigates automatically
        }
      } catch (e: any) {
        if (__DEV__) console.error('[DeepLink] Error handling URL:', e.message);
      }
    };

    // Cold start: app was closed when the link was tapped
    Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url);
    });

    // Warm start: app is already open
    const subscription = Linking.addEventListener('url', (event) => {
      handleUrl(event.url);
    });

    return () => subscription.remove();
  }, []);

  // ── Notification deep-link listener ──
  const router = useRouter();
  const notificationResponseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    if (!session || !onboardingComplete) return;

    try {
      notificationResponseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data;
        if (data?.screen === 'browse' && data?.meal) {
          router.push({ pathname: '/(tabs)/browse', params: { meal: data.meal as string } });
        }
      });
    } catch (e) {
      console.warn('[Notifications] Failed to add notification response listener:', e);
    }

    return () => {
      notificationResponseListener.current?.remove();
    };
  }, [session, onboardingComplete]);

  // ── Restore meal reminders on app launch ──
  useEffect(() => {
    if (!session || !onboardingComplete) return;

    (async () => {
      try {
        const userId = session.user?.id;
        if (!userId) return;
        const reminders = await loadMealReminders(userId);
        const hasEnabled = reminders.some((r) => r.enabled);
        if (hasEnabled) {
          await scheduleMealReminders(reminders);
          if (__DEV__) console.log('[Reminders] Restored meal reminders on launch');
        }
      } catch (e: any) {
        if (__DEV__) console.log('[Reminders] Failed to restore reminders:', e?.message);
      }
    })();
  }, [session, onboardingComplete]);

  if (!loaded || session === undefined || (session && onboardingComplete === undefined)) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.maroon} />
      </View>
    );
  }

  const statusBarStyle = mode === 'dark' ? 'light' : 'dark';

  if (!session) {
    return (
      <>
        <StatusBar style={statusBarStyle} />
        <AuthScreen />
      </>
    );
  }

  if (!onboardingComplete) {
    return (
      <>
        <StatusBar style={statusBarStyle} />
        <OnboardingScreen onComplete={() => setOnboardingComplete(true)} />
      </>
    );
  }

  return (
    <>
      <StatusBar style={statusBarStyle} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <SubscriptionProvider>
        <RestyleProvider>
          <RootContent />
        </RestyleProvider>
      </SubscriptionProvider>
    </ThemeProvider>
  );
}
