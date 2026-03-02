import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

// Fixed identifier so we can cancel/replace the daily summary notification
const DAILY_SUMMARY_ID = 'daily-summary';

/**
 * Schedule or cancel the daily summary notification.
 *
 * @param enabled  Whether the notification should be active.
 * @param time     24-hour time string "HH:MM" (default "21:00" = 9 PM).
 */
export async function scheduleDailySummary(
  enabled: boolean,
  time: string = '21:00',
): Promise<void> {
  // Always cancel the existing daily summary first
  try {
    await Notifications.cancelScheduledNotificationAsync(DAILY_SUMMARY_ID);
  } catch (e) {
    console.warn('[DailySummary] Failed to cancel existing notification:', e);
  }

  if (!enabled) return;

  // Parse hour and minute from "HH:MM"
  const [hourStr, minuteStr] = time.split(':');
  const hour = parseInt(hourStr, 10) || 21;
  const minute = parseInt(minuteStr, 10) || 0;

  // Set up Android channel if needed
  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync('daily-summary', {
        name: 'Daily Recap',
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: 'default',
      });
    } catch (e) {
      console.warn('[DailySummary] Failed to set Android channel:', e);
    }
  }

  try {
    await Notifications.scheduleNotificationAsync({
      identifier: DAILY_SUMMARY_ID,
      content: {
        title: 'Daily Recap',
        body: 'Check your daily score and keep your streak going!',
        sound: 'default',
        data: { screen: 'progress' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
        channelId: Platform.OS === 'android' ? 'daily-summary' : undefined,
      },
    });
  } catch (e) {
    console.warn('[DailySummary] Failed to schedule notification:', e);
  }
}
