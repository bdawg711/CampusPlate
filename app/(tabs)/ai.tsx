import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert } from 'react-native';
import { Box } from '@/src/theme/restyleTheme';
import { requireUserId } from '@/src/utils/auth';
import { supabase } from '@/src/utils/supabase';
import { getCurrentMealPeriod, getEffectiveMenuDate } from '@/src/utils/meals';
import AIChat from '@/src/components/AIChat';
import MealPlanView from '@/src/components/MealPlanView';
import type { MealItem } from '@/src/utils/ai';
import * as Haptics from 'expo-haptics';
import { useSubscription } from '@/src/context/SubscriptionContext';
import { useTheme } from '@/src/context/ThemeContext';
import PaywallModal from '@/src/components/PaywallModal';
import { useRouter } from 'expo-router';

export default function AIScreen() {
  const { isPremium, loading: subLoading } = useSubscription();
  const { colors } = useTheme();
  const router = useRouter();
  const [, setRefreshKey] = useState(0);
  const [showMealPlan, setShowMealPlan] = useState(false);

  const handleLogItem = useCallback(async (item: MealItem) => {
    try {
      const userId = await requireUserId();
      const date = await getEffectiveMenuDate();
      const { error } = await supabase.from('meal_logs').insert({
        user_id: userId,
        menu_item_id: item.id,
        date,
        meal: item.meal || getCurrentMealPeriod(),
        servings: 1,
      });
      if (error) {
        if (__DEV__) console.error('AI log meal failed:', error.message);
        Alert.alert('Error', 'Failed to log meal. Please try again.');
        return;
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Logged!', `${item.name} (${item.calories} cal) added to your log.`);
      setRefreshKey((k) => k + 1);
    } catch (e: any) {
      if (__DEV__) console.error('AI log error:', e?.message);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    }
  }, []);

  // Show loading while checking subscription status
  if (subLoading) {
    return (
      <Box flex={1} backgroundColor="background" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.maroon} />
      </Box>
    );
  }

  // Gate: show paywall for free users — no chat UI rendered
  if (!isPremium) {
    return (
      <Box flex={1} backgroundColor="background">
        <PaywallModal
          visible={true}
          onClose={() => {
            console.log('[AIScreen] PaywallModal onClose fired, navigating to home tab');
            router.replace('/(tabs)/');
          }}
        />
      </Box>
    );
  }

  return (
    <Box flex={1} backgroundColor="background">
      <AIChat
        mode="tab"
        onLogItem={handleLogItem}
        onPlanMyDay={() => setShowMealPlan(true)}
      />
      <MealPlanView
        visible={showMealPlan}
        onClose={() => setShowMealPlan(false)}
        onLogged={() => setShowMealPlan(false)}
      />
    </Box>
  );
}
