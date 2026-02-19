import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { requireUserId } from '@/src/utils/auth';
import {
  MealReminders,
  loadMealReminders,
  saveMealReminders,
  registerForPushNotifications,
} from '@/src/utils/notifications';

const MEAL_EMOJI: Record<string, string> = {
  Breakfast: '🌅',
  Lunch: '☀️',
  Dinner: '🌙',
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
      } catch (e: any) {
        console.error('Failed to load reminders:', e?.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [visible]);

  const handleToggle = async (meal: string) => {
    const idx = reminders.findIndex((r) => r.meal === meal);
    if (idx < 0) return;

    const current = reminders[idx];
    const newEnabled = !current.enabled;

    // Request permissions on first enable
    if (newEnabled) {
      try {
        const token = await registerForPushNotifications();
        if (!token) {
          Alert.alert(
            'Notifications Disabled',
            'Please enable notifications in your device settings to use meal reminders.',
            [{ text: 'OK' }],
          );
          return;
        }
      } catch (e) {
        console.warn('[Reminders] Failed to register for notifications:', e);
        Alert.alert(
          'Notifications Unavailable',
          'Notifications are not available in this environment. Your reminder preferences will still be saved.',
          [{ text: 'OK' }],
        );
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
    } catch (e: any) {
      console.error('Failed to save reminders:', e?.message);
      Alert.alert('Error', 'Failed to save reminders. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[st.container, { backgroundColor: colors.background }]}>

        {/* ── Header ── */}
        <View style={[st.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} style={st.headerSide} activeOpacity={0.6}>
            <Text style={[st.cancelText, { color: colors.textMuted, fontFamily: 'DMSans_500Medium' }]}>
              Cancel
            </Text>
          </TouchableOpacity>
          <Text style={[st.headerTitle, { color: colors.text, fontFamily: 'Outfit_700Bold' }]}>
            Reminders
          </Text>
          <View style={st.headerSide} />
        </View>

        {loading ? (
          <View style={st.loadingWrap}>
            <ActivityIndicator size="large" color={colors.maroon} />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={st.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >

            {/* ── Reminder rows ── */}
            <View style={[st.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {reminders.map((reminder, index) => (
                <React.Fragment key={reminder.meal}>
                  {index > 0 && <View style={[st.sep, { backgroundColor: colors.border }]} />}

                  <View style={st.row}>
                    <Switch
                      value={reminder.enabled}
                      onValueChange={() => handleToggle(reminder.meal)}
                      trackColor={{ false: colors.textDim, true: colors.maroon }}
                      thumbColor="#fff"
                    />
                    <Text style={st.emoji}>{MEAL_EMOJI[reminder.meal]}</Text>
                    <Text style={[st.mealName, { color: colors.text, fontFamily: 'DMSans_600SemiBold' }]}>
                      {reminder.meal}
                    </Text>
                    <View style={{ flex: 1 }} />
                    <TouchableOpacity
                      style={[st.timeChip, { backgroundColor: colors.cardAlt }]}
                      onPress={() => setEditingMeal(editingMeal === reminder.meal ? null : reminder.meal)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          st.timeText,
                          {
                            color: reminder.enabled ? colors.text : colors.textMuted,
                            fontFamily: 'DMSans_600SemiBold',
                          },
                        ]}
                      >
                        {formatTime(reminder.hour, reminder.minute)}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* ── Inline time editor ── */}
                  {editingMeal === reminder.meal && (
                    <View style={[st.timeEditor, { backgroundColor: colors.cardAlt }]}>
                      {/* Hour */}
                      <View style={st.timeCol}>
                        <TouchableOpacity
                          onPress={() => adjustTime(reminder.meal, 'hour', 1)}
                          style={[st.arrowBtn, { backgroundColor: colors.card }]}
                          activeOpacity={0.6}
                        >
                          <Text style={[st.arrowText, { color: colors.text }]}>&#9650;</Text>
                        </TouchableOpacity>
                        <Text style={[st.timeVal, { color: colors.text, fontFamily: 'Outfit_700Bold' }]}>
                          {String(reminder.hour % 12 || 12).padStart(2, '0')}
                        </Text>
                        <TouchableOpacity
                          onPress={() => adjustTime(reminder.meal, 'hour', -1)}
                          style={[st.arrowBtn, { backgroundColor: colors.card }]}
                          activeOpacity={0.6}
                        >
                          <Text style={[st.arrowText, { color: colors.text }]}>&#9660;</Text>
                        </TouchableOpacity>
                        <Text style={[st.timeLabel, { color: colors.textMuted, fontFamily: 'DMSans_400Regular' }]}>
                          Hour
                        </Text>
                      </View>

                      <Text style={[st.timeColon, { color: colors.text, fontFamily: 'Outfit_700Bold' }]}>:</Text>

                      {/* Minute (15-min increments) */}
                      <View style={st.timeCol}>
                        <TouchableOpacity
                          onPress={() => adjustTime(reminder.meal, 'minute', 15)}
                          style={[st.arrowBtn, { backgroundColor: colors.card }]}
                          activeOpacity={0.6}
                        >
                          <Text style={[st.arrowText, { color: colors.text }]}>&#9650;</Text>
                        </TouchableOpacity>
                        <Text style={[st.timeVal, { color: colors.text, fontFamily: 'Outfit_700Bold' }]}>
                          {String(reminder.minute).padStart(2, '0')}
                        </Text>
                        <TouchableOpacity
                          onPress={() => adjustTime(reminder.meal, 'minute', -15)}
                          style={[st.arrowBtn, { backgroundColor: colors.card }]}
                          activeOpacity={0.6}
                        >
                          <Text style={[st.arrowText, { color: colors.text }]}>&#9660;</Text>
                        </TouchableOpacity>
                        <Text style={[st.timeLabel, { color: colors.textMuted, fontFamily: 'DMSans_400Regular' }]}>
                          Min
                        </Text>
                      </View>

                      {/* AM / PM toggle */}
                      <TouchableOpacity
                        style={[st.ampmBtn, { backgroundColor: colors.maroon }]}
                        onPress={() => toggleAmPm(reminder.meal)}
                        activeOpacity={0.7}
                      >
                        <Text style={[st.ampmText, { fontFamily: 'DMSans_700Bold' }]}>
                          {reminder.hour < 12 ? 'AM' : 'PM'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </React.Fragment>
              ))}
            </View>

            {/* ── Note about device settings ── */}
            <Text style={[st.note, { color: colors.textMuted, fontFamily: 'DMSans_400Regular' }]}>
              Make sure notifications are enabled in your device settings. Reminders repeat daily at the times you set.
            </Text>

            {/* ── Save button ── */}
            <TouchableOpacity
              style={[st.saveBtn, { backgroundColor: colors.maroon, opacity: saving ? 0.6 : 1 }]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={[st.saveBtnText, { fontFamily: 'DMSans_700Bold' }]}>Save Reminders</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerSide: { width: 64 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17 },
  cancelText: { fontSize: 15 },

  // Content
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 20, paddingBottom: 48 },

  // Card
  card: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  sep: { height: 1, marginLeft: 60 },

  // Reminder row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  emoji: { fontSize: 20, marginLeft: 12 },
  mealName: { fontSize: 15, marginLeft: 10 },
  timeChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  timeText: { fontSize: 13 },

  // Time editor
  timeEditor: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    gap: 12,
  },
  timeCol: { alignItems: 'center' },
  arrowBtn: {
    width: 40,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowText: { fontSize: 14 },
  timeVal: { fontSize: 28, marginVertical: 4 },
  timeColon: { fontSize: 28, marginBottom: 24 },
  timeLabel: { fontSize: 10, marginTop: 4 },
  ampmBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    marginLeft: 8,
    marginBottom: 24,
  },
  ampmText: { color: '#fff', fontSize: 14 },

  // Note
  note: { fontSize: 12, lineHeight: 18, marginTop: 16, marginBottom: 20, textAlign: 'center' },

  // Save
  saveBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 16 },
});
