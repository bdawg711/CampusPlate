import React, { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { Box } from '@/src/theme/restyleTheme';
import { requireUserId } from '@/src/utils/auth';
import { supabase } from '@/src/utils/supabase';
import { getCurrentMealPeriod, getEffectiveMenuDate } from '@/src/utils/meals';
import AIChat from '@/src/components/AIChat';
import BarcodeScannerModal from '@/src/components/BarcodeScannerModal';
import AIMealLogModal from '@/src/components/AIMealLogModal';
import type { MealItem } from '@/src/utils/ai';
import * as Haptics from 'expo-haptics';

export default function AIScreen() {
  const [, setRefreshKey] = useState(0);
  const [showScanner, setShowScanner] = useState(false);
  const [showDescribe, setShowDescribe] = useState(false);

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

  return (
    <Box flex={1} backgroundColor="background">
      <AIChat
        mode="tab"
        onLogItem={handleLogItem}
        onScanPress={() => setShowScanner(true)}
        onDescribePress={() => setShowDescribe(true)}
      />
      <BarcodeScannerModal
        visible={showScanner}
        onClose={() => setShowScanner(false)}
        onLogged={() => { setShowScanner(false); setRefreshKey((k) => k + 1); }}
      />
      <AIMealLogModal
        visible={showDescribe}
        onClose={() => setShowDescribe(false)}
        onLogged={() => { setShowDescribe(false); setRefreshKey((k) => k + 1); }}
      />
    </Box>
  );
}
