import React, { useCallback, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { requireUserId } from '@/src/utils/auth';
import { supabase } from '@/src/utils/supabase';
import { getCurrentMealPeriod, getEffectiveMenuDate } from '@/src/utils/meals';
import AIChat from '@/src/components/AIChat';
import type { MealItem } from '@/src/utils/ai';
import * as Haptics from 'expo-haptics';

export default function AIScreen() {
  const { colors } = useTheme();
  const [, setRefreshKey] = useState(0);

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
        console.error('AI log meal failed:', error.message);
        Alert.alert('Error', 'Failed to log meal. Please try again.');
        return;
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Logged!', `${item.name} (${item.calories} cal) added to your log.`);
      setRefreshKey((k) => k + 1);
    } catch (e: any) {
      console.error('AI log error:', e?.message);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    }
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AIChat mode="tab" onLogItem={handleLogItem} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
