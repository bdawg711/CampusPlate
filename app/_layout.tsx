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
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { getSession, onAuthChange } from '@/src/utils/auth';
import { supabase } from '@/src/utils/supabase';
import { ThemeProvider, useTheme } from '@/src/context/ThemeContext';
import AuthScreen from './auth';
import OnboardingScreen from './onboarding';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

function RootContent() {
  const { mode, colors } = useTheme();
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
        console.log('[AuthFlow] Initial session check:', s ? 'found session' : 'no session');
        setSession(s ?? null);
      })
      .catch(() => {
        console.log('[AuthFlow] Session check failed, showing auth');
        setSession(null);
      });

    const subscription = onAuthChange((s) => {
      console.log('[AuthFlow] Auth state changed:', s ? 'signed in' : 'signed out');
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
          console.log('[AuthFlow] No profile found, showing onboarding. Error:', profileError.message);
          setOnboardingComplete(false);
          return;
        }
        console.log('[AuthFlow] Profile found: onboarding_complete =', data?.onboarding_complete);
        setOnboardingComplete(data?.onboarding_complete === true);
      } catch (e: any) {
        console.log('[AuthFlow] Profile check exception:', e.message);
        setOnboardingComplete(false);
      }
    })();
  }, [session]);

  if (!loaded || session === undefined || (session && onboardingComplete === undefined)) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.maroon} />
      </View>
    );
  }

  if (!session) {
    return (
      <>
        <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
        <AuthScreen />
      </>
    );
  }

  if (!onboardingComplete) {
    return (
      <>
        <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
        <OnboardingScreen onComplete={() => setOnboardingComplete(true)} />
      </>
    );
  }

  return (
    <>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootContent />
    </ThemeProvider>
  );
}
