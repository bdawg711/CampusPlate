import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Switch,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Text } from '@/src/theme/restyleTheme';
import { useTheme } from '@/src/context/ThemeContext';
import { requireUserId } from '@/src/utils/auth';
import {
  MealReminders,
  loadMealReminders,
  saveMealReminders,
  registerForPushNotifications,
} from '@/src/utils/notifications';

const MEAL_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  Breakfast: 'sunrise',
  Lunch: 'sun',
  Dinner: 'moon',
};

function formatTime(hour: number, minute: number): string {
  const h = hour % 12 || 12;
  const ampm = hour < 12 ? 'AM' : 'PM';
  return `${h}:${String(minute).padStart(2, '0')} ${ampm}`;
}

interface ReminderSettingsProps {
  visible: boolean;
  onClose: () => void;
}

export default function ReminderSettings({ visible, onClose }: ReminderSettingsProps) {
  const { colors } = useTheme();
  const [reminders, setReminders] = useState<MealReminders>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingMeal, setEditingMeal] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setEditingMeal(null);
    (async () => {
      setLoading(true);
      try {
        const userId = await requireUserId();
        const prefs = await loadMealReminders(userId);
        setReminders(prefs);
      } catch (e: any) { if (__DEV__) console.error('Failed to load reminders:', e?.message); } finally { setLoading(false); }
    })();
  }, [visible]);

  const handleToggle = async (meal: string) => {
    const idx = reminders.findIndex((r) => r.meal === meal);
    if (idx < 0) return;
    const current = reminders[idx];
    const newEnabled = !current.enabled;

    if (newEnabled) {
      try {
        const token = await registerForPushNotifications();
        if (!token) { Alert.alert('Notifications Disabled', 'Please enable notifications in your device settings to use meal reminders.', [{ text: 'OK' }]); return; }
      } catch (e) {
        console.warn('[Reminders] Failed to register for notifications:', e);
        Alert.alert('Notifications Unavailable', 'Notifications are not available in this environment. Your reminder preferences will still be saved.', [{ text: 'OK' }]);
      }
    }
    const updated = [...reminders];
    updated[idx] = { ...current, enabled: newEnabled };
    setReminders(updated);
  };

  const adjustTime = (meal: string, field: 'hour' | 'minute', delta: number) => {
    const idx = reminders.findIndex((r) => r.meal === meal);
    if (idx < 0) return;
    const current = reminders[idx];
    const updated = [...reminders];
    if (field === 'hour') {
      let newHour = current.hour + delta;
      if (newHour < 0) newHour = 23;
      if (newHour > 23) newHour = 0;
      updated[idx] = { ...current, hour: newHour };
    } else {
      let newMin = current.minute + delta;
      if (newMin < 0) newMin = 45;
      if (newMin > 59) newMin = 0;
      updated[idx] = { ...current, minute: newMin };
    }
    setReminders(updated);
  };

  const toggleAmPm = (meal: string) => {
    const idx = reminders.findIndex((r) => r.meal === meal);
    if (idx < 0) return;
    const current = reminders[idx];
    const updated = [...reminders];
    updated[idx] = { ...current, hour: current.hour < 12 ? current.hour + 12 : current.hour - 12 };
    setReminders(updated);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const userId = await requireUserId();
      await saveMealReminders(userId, reminders);
      Alert.alert('Saved', 'Your meal reminders have been updated.');
      onClose();
    } catch (e: any) { if (__DEV__) console.error('Failed to save reminders:', e?.message); Alert.alert('Error', 'Failed to save reminders. Please try again.'); } finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Modal handle */}
        <View style={{ alignItems: 'center', paddingTop: 8, paddingBottom: 4 }}>
          <View style={{ width: 36, height: 4, borderRadius: 9999, backgroundColor: colors.textDim }} />
        </View>

        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <TouchableOpacity onPress={onClose} style={{ width: 64 }} activeOpacity={0.6}>
            <Text style={{ fontSize: 15, color: colors.textDim, fontFamily: 'DMSans_500Medium' }}>Cancel</Text>
          </TouchableOpacity>
          <Text style={{ flex: 1, textAlign: 'center', fontSize: 17, color: colors.text, fontFamily: 'Outfit_700Bold' }}>Reminders</Text>
          <View style={{ width: 64 }} />
        </View>

        {loading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#861F41" />
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

            <View style={{ borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, overflow: 'hidden' }}>
              {reminders.map((reminder, index) => (
                <React.Fragment key={reminder.meal}>
                  {index > 0 && <View style={{ height: 1, marginLeft: 60, backgroundColor: colors.borderLight }} />}

                  <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 }}>
                    <Switch
                      value={reminder.enabled}
                      onValueChange={() => handleToggle(reminder.meal)}
                      trackColor={{ false: '#9A9A9E', true: '#861F41' }}
                      thumbColor="#FFFFFF"
                    />
                    <View style={{ marginLeft: 12 }}>
                      <Feather name={MEAL_ICONS[reminder.meal] || 'clock'} size={20} color={colors.textDim} />
                    </View>
                    <Text style={{ fontSize: 15, marginLeft: 10, color: colors.text, fontFamily: 'DMSans_600SemiBold' }}>{reminder.meal}</Text>
                    <View style={{ flex: 1 }} />
                    <TouchableOpacity
                      style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.cardAlt }}
                      onPress={() => setEditingMeal(editingMeal === reminder.meal ? null : reminder.meal)}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontSize: 13, color: reminder.enabled ? colors.text : colors.textMuted, fontFamily: 'DMSans_600SemiBold' }}>
                        {formatTime(reminder.hour, reminder.minute)}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Inline time editor */}
                  {editingMeal === reminder.meal && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, paddingHorizontal: 20, marginHorizontal: 16, marginBottom: 12, borderRadius: 8, gap: 12, backgroundColor: colors.cardAlt }}>
                      {/* Hour */}
                      <View style={{ alignItems: 'center' }}>
                        <TouchableOpacity onPress={() => adjustTime(reminder.meal, 'hour', 1)} style={{ width: 40, height: 32, borderRadius: 6, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.card }} activeOpacity={0.6}>
                          <Feather name="chevron-up" size={16} color={colors.text} />
                        </TouchableOpacity>
                        <Text style={{ fontSize: 28, marginVertical: 4, color: colors.text, fontFamily: 'Outfit_700Bold' }}>
                          {String(reminder.hour % 12 || 12).padStart(2, '0')}
                        </Text>
                        <TouchableOpacity onPress={() => adjustTime(reminder.meal, 'hour', -1)} style={{ width: 40, height: 32, borderRadius: 6, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.card }} activeOpacity={0.6}>
                          <Feather name="chevron-down" size={16} color={colors.text} />
                        </TouchableOpacity>
                        <Text style={{ fontSize: 10, marginTop: 4, color: colors.textMuted, fontFamily: 'DMSans_400Regular' }}>Hour</Text>
                      </View>

                      <Text style={{ fontSize: 28, marginBottom: 24, color: colors.text, fontFamily: 'Outfit_700Bold' }}>:</Text>

                      {/* Minute */}
                      <View style={{ alignItems: 'center' }}>
                        <TouchableOpacity onPress={() => adjustTime(reminder.meal, 'minute', 15)} style={{ width: 40, height: 32, borderRadius: 6, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.card }} activeOpacity={0.6}>
                          <Feather name="chevron-up" size={16} color={colors.text} />
                        </TouchableOpacity>
                        <Text style={{ fontSize: 28, marginVertical: 4, color: colors.text, fontFamily: 'Outfit_700Bold' }}>
                          {String(reminder.minute).padStart(2, '0')}
                        </Text>
                        <TouchableOpacity onPress={() => adjustTime(reminder.meal, 'minute', -15)} style={{ width: 40, height: 32, borderRadius: 6, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.card }} activeOpacity={0.6}>
                          <Feather name="chevron-down" size={16} color={colors.text} />
                        </TouchableOpacity>
                        <Text style={{ fontSize: 10, marginTop: 4, color: colors.textMuted, fontFamily: 'DMSans_400Regular' }}>Min</Text>
                      </View>

                      {/* AM/PM toggle */}
                      <TouchableOpacity
                        style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 6, marginLeft: 8, marginBottom: 24, backgroundColor: '#861F41' }}
                        onPress={() => toggleAmPm(reminder.meal)}
                        activeOpacity={0.7}
                      >
                        <Text style={{ color: '#FFFFFF', fontSize: 14, fontFamily: 'DMSans_700Bold' }}>
                          {reminder.hour < 12 ? 'AM' : 'PM'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </React.Fragment>
              ))}
            </View>

            <Text style={{ fontSize: 12, lineHeight: 18, marginTop: 16, marginBottom: 20, textAlign: 'center', color: colors.textMuted, fontFamily: 'DMSans_400Regular' }}>
              Make sure notifications are enabled in your device settings. Reminders repeat daily at the times you set.
            </Text>

            {/* Save — maroon accent */}
            <TouchableOpacity
              style={{ borderRadius: 6, paddingVertical: 16, alignItems: 'center', backgroundColor: '#861F41', opacity: saving ? 0.6 : 1 }}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving
                ? <ActivityIndicator color="#FFFFFF" />
                : <Text style={{ color: '#FFFFFF', fontSize: 16, fontFamily: 'DMSans_700Bold' }}>Save Reminders</Text>
              }
            </TouchableOpacity>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}
