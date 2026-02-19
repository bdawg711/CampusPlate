import { Platform, Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { supabase } from './supabase';

// ── Types ───────────────────────────────────────────────────────────────────

export interface MealReminder {
  meal: 'Breakfast' | 'Lunch' | 'Dinner';
  enabled: boolean;
  hour: number;
  minute: number;
}

export type MealReminders = MealReminder[];

// ── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_REMINDERS: MealReminders = [
  { meal: 'Breakfast', enabled: false, hour: 8, minute: 0 },
  { meal: 'Lunch', enabled: false, hour: 12, minute: 0 },
  { meal: 'Dinner', enabled: false, hour: 18, minute: 0 },
];

// ── Notification channel (Android) ──────────────────────────────────────────

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// ── Public functions ────────────────────────────────────────────────────────

/**
 * Request notification permissions and return the Expo push token.
 * Returns null if permissions are denied or device is not physical.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    Alert.alert('Physical device required', 'Push notifications only work on a real device.');
    return null;
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('meal-reminders', {
      name: 'Meal Reminders',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    });
  }

  const tokenData = await Notifications.getExpoPushTokenAsync();
  return tokenData.data;
}

/**
 * Cancel all existing scheduled notifications, then schedule a daily
 * repeating notification for each enabled meal reminder.
 * Includes deep-link data: { screen: 'browse', meal: '<MealName>' }.
 */
export async function scheduleMealReminders(reminders: MealReminders): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();

  for (const reminder of reminders) {
    if (!reminder.enabled) continue;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `${reminder.meal} time!`,
        body: `Don't forget to eat and log your ${reminder.meal.toLowerCase()}.`,
        sound: 'default',
        data: { screen: 'browse', meal: reminder.meal },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: reminder.hour,
        minute: reminder.minute,
        channelId: Platform.OS === 'android' ? 'meal-reminders' : undefined,
      },
    });
  }
}

/**
 * Save reminder preferences to profiles.reminder_prefs and schedule notifications.
 */
export async function saveMealReminders(
  userId: string,
  reminders: MealReminders
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ reminder_prefs: reminders })
    .eq('id', userId);

  if (error) {
    throw new Error(error.message || 'Failed to save reminder preferences');
  }

  await scheduleMealReminders(reminders);
}

/**
 * Load reminder preferences from profiles.
 * Returns defaults if null or missing.
 */
export async function loadMealReminders(userId: string): Promise<MealReminders> {
  const { data, error } = await supabase
    .from('profiles')
    .select('reminder_prefs')
    .eq('id', userId)
    .single();

  if (error) {
    throw new Error(error.message || 'Failed to load reminder preferences');
  }

  const prefs = data?.reminder_prefs as MealReminders | null;
  if (!prefs || !Array.isArray(prefs) || prefs.length === 0) {
    return DEFAULT_REMINDERS.map((r) => ({ ...r }));
  }

  return prefs;
}

/**
 * Cancel all scheduled notifications.
 */
export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
