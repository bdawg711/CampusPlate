import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  Share,
  Switch,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useTheme as useRestyleTheme } from '@shopify/restyle';
import { Box, Text, Card, Theme } from '@/src/theme/restyleTheme';
import { requireUserId, signOut } from '@/src/utils/auth';
import { supabase } from '@/src/utils/supabase';
import { setWaterGoal } from '@/src/utils/water';
import { calculateDailyScore } from '@/src/utils/dailyScore';
import EditGoals from '@/src/components/EditGoals';
import EditProfile from '@/src/components/EditProfile';
import EditNutritionPrefs from '@/src/components/EditNutritionPrefs';
import HelpFAQ from '@/src/components/HelpFAQ';
import WeeklyReport from '@/src/components/WeeklyReport';
import ReminderSettings from '@/src/components/ReminderSettings';
import PaywallModal from '@/src/components/PaywallModal';
import ScheduleEditor from '@/src/components/ScheduleEditor';
import { Goals, getGoals, saveCustomGoals, recalculateGoals } from '@/src/utils/goals';
import { getStreakData, getBadges, getWaterStreak, getTotalMealsLogged, StreakData, Badge } from '@/src/utils/streaks';
import StreakBadge from '@/src/components/StreakBadge';
import { scheduleDailySummary } from '@/src/utils/dailySummaryNotification';
import { useTheme as useAppTheme } from '@/src/context/ThemeContext';
import { useSubscription } from '@/src/context/SubscriptionContext';
import { fetchAndParseCalendar } from '@/src/utils/calendar';

type ColorName = keyof Theme['colors'];

export default function SettingsRestyle() {
  const theme = useRestyleTheme<Theme>();
  const { mode: themeMode, toggleTheme } = useAppTheme();
  const { isPremium } = useSubscription();

  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [streakData, setStreakData] = useState<StreakData | null>(null);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [waterGoalOz, setWaterGoalOz] = useState<number>(64);
  const [totalMeals, setTotalMeals] = useState(0);
  const [scoreValue, setScoreValue] = useState(0);
  const [scoreGrade, setScoreGrade] = useState('—');
  const [scoreGradeColor, setScoreGradeColor] = useState('#2D8A4E');

  // Modal visibility
  const [goalsModalVisible, setGoalsModalVisible] = useState(false);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [nutritionPrefsModalVisible, setNutritionPrefsModalVisible] = useState(false);
  const [helpModalVisible, setHelpModalVisible] = useState(false);
  const [weeklyReportVisible, setWeeklyReportVisible] = useState(false);
  const [remindersVisible, setRemindersVisible] = useState(false);
  const [remindersOn, setRemindersOn] = useState(false);
  const [dailySummaryEnabled, setDailySummaryEnabled] = useState(true);
  const [dailySummaryTime, setDailySummaryTime] = useState('21:00');
  const [waterGoalModalVisible, setWaterGoalModalVisible] = useState(false);
  const [waterGoalInput, setWaterGoalInput] = useState('');

  // Canvas Calendar
  const [canvasModalVisible, setCanvasModalVisible] = useState(false);
  const [canvasUrl, setCanvasUrl] = useState('');
  const [canvasUrlInput, setCanvasUrlInput] = useState('');
  const [canvasConnecting, setCanvasConnecting] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [scheduleEditorVisible, setScheduleEditorVisible] = useState(false);
  const [aboutModalVisible, setAboutModalVisible] = useState(false);

  const [currentGoals, setCurrentGoals] = useState<Goals>({
    goalCalories: 2000,
    goalProtein: 150,
    goalCarbs: 200,
    goalFat: 65,
  });

  const loadData = useCallback(async () => {
    try {
      const userId = await requireUserId();
      const { data, error } = await supabase
        .from('profiles')
        .select('name, year, dorm, goal_calories, water_goal_oz, reminder_prefs, daily_summary_enabled, daily_summary_time, canvas_ical_url')
        .eq('id', userId)
        .single();
      if (__DEV__) console.log('[Settings] profile fetch result:', JSON.stringify(data));
      if (__DEV__) console.log('[Settings] profile fetch error:', JSON.stringify(error));
      if (data) {
        setProfile(data);
        setWaterGoalOz(data.water_goal_oz ?? 64);
        const prefs = data.reminder_prefs as any[] | null;
        setRemindersOn(Array.isArray(prefs) && prefs.some((r: any) => r?.enabled));
        // Daily summary — default to true if column doesn't exist yet
        setDailySummaryEnabled((data as any).daily_summary_enabled ?? true);
        setDailySummaryTime((data as any).daily_summary_time ?? '21:00');
        // Canvas calendar URL
        setCanvasUrl((data as any).canvas_ical_url ?? '');
      }

      const goals = await getGoals(userId);
      setCurrentGoals(goals);

      const d = new Date();
      const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const [streakResult, waterStreak, totalMealsCount, logsRes, waterRes] = await Promise.all([
        getStreakData(userId),
        getWaterStreak(userId),
        getTotalMealsLogged(userId),
        supabase.from('meal_logs')
          .select('servings, menu_items(nutrition(calories, protein_g, total_carbs_g, total_fat_g))')
          .eq('user_id', userId).eq('date', todayStr),
        supabase.from('water_logs')
          .select('amount_oz')
          .eq('user_id', userId).eq('date', todayStr),
      ]);
      setStreakData(streakResult);
      setTotalMeals(totalMealsCount);
      setBadges(getBadges(streakResult, waterStreak, totalMealsCount));

      const consumed = { calories: 0, protein: 0, carbs: 0, fat: 0 };
      let mealsToday = 0;
      for (const log of logsRes.data ?? []) {
        const n = (log as any).menu_items?.nutrition;
        const nutr = Array.isArray(n) ? n[0] : n;
        if (nutr) {
          consumed.calories += (nutr.calories || 0) * (log.servings || 1);
          consumed.protein += (nutr.protein_g || 0) * (log.servings || 1);
          consumed.carbs += (nutr.total_carbs_g || 0) * (log.servings || 1);
          consumed.fat += (nutr.total_fat_g || 0) * (log.servings || 1);
        }
        mealsToday++;
      }
      const waterToday = (waterRes.data ?? []).reduce((sum: number, w: any) => sum + (w.amount_oz || 0), 0);
      const dailyScore = calculateDailyScore(
        consumed,
        { calories: goals.goalCalories, protein: goals.goalProtein, carbs: goals.goalCarbs, fat: goals.goalFat },
        mealsToday, waterToday, data?.water_goal_oz ?? 64,
      );
      setScoreValue(dailyScore.score);
      setScoreGrade(dailyScore.grade);
      setScoreGradeColor(dailyScore.score >= 80 ? '#2D8A4E' : dailyScore.score >= 50 ? '#C5A55A' : '#861F41');
    } catch (e) {
      if (__DEV__) console.error('More load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const handleWaterGoal = () => {
    setWaterGoalInput(String(waterGoalOz));
    setWaterGoalModalVisible(true);
  };

  const saveWaterGoal = async () => {
    const parsed = parseInt(waterGoalInput, 10);
    if (isNaN(parsed) || parsed < 1) return;
    try {
      const userId = await requireUserId();
      await setWaterGoal(userId, parsed);
      setWaterGoalOz(parsed);
      setWaterGoalModalVisible(false);
    } catch (e) {
      if (__DEV__) console.error('Failed to save water goal:', e);
    }
  };

  const handleSaveGoals = async (goals: Goals): Promise<void> => {
    try {
      const userId = await requireUserId();
      await saveCustomGoals(userId, goals);
      setCurrentGoals(goals);
      setProfile((p: any) => (p ? { ...p, goal_calories: goals.goalCalories } : p));
      setGoalsModalVisible(false);
    } catch (error) {
      if (__DEV__) console.error('Failed to save goals:', error);
    }
  };

  const handleRecalculateGoals = async (): Promise<Goals> => {
    const userId = await requireUserId();
    const { data } = await supabase
      .from('profiles')
      .select('weight, height, age, is_male, activity_level, goal')
      .eq('id', userId)
      .single();
    const newGoals = recalculateGoals(
      data?.weight ?? 150,
      data?.height ?? 170,
      data?.age ?? 20,
      data?.is_male ?? true,
      data?.activity_level ?? 'light',
      data?.goal ?? 'maintain',
    );
    await supabase.from('profiles').update({
      goal_calories: newGoals.goalCalories,
      goal_protein_g: newGoals.goalProtein,
      goal_carbs_g: newGoals.goalCarbs,
      goal_fat_g: newGoals.goalFat,
    }).eq('id', userId);
    setCurrentGoals(newGoals);
    setProfile((p: any) => (p ? { ...p, goal_calories: newGoals.goalCalories } : p));
    return newGoals;
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  const handleReminders = () => {
    setRemindersVisible(true);
  };

  const toggleDailySummary = async () => {
    const newVal = !dailySummaryEnabled;
    setDailySummaryEnabled(newVal);
    try {
      await scheduleDailySummary(newVal, dailySummaryTime);
      const userId = await requireUserId();
      await supabase.from('profiles').update({ daily_summary_enabled: newVal }).eq('id', userId);
    } catch (e) {
      console.warn('[Settings] Failed to toggle daily summary:', e);
    }
  };

  const handleCanvasRow = () => {
    if (!isPremium) {
      setPaywallVisible(true);
      return;
    }
    setCanvasUrlInput(canvasUrl);
    setCanvasModalVisible(true);
  };

  const handleCanvasConnect = async () => {
    const url = canvasUrlInput.trim();
    if (!url.startsWith('https://') || (!url.includes('.ics') && !url.includes('calendar'))) {
      Alert.alert('Invalid URL', 'Please paste a valid Canvas calendar URL. It should start with https:// and contain your calendar feed.');
      return;
    }
    setCanvasConnecting(true);
    try {
      // Validate by fetching and parsing
      await fetchAndParseCalendar(url);
      const userId = await requireUserId();
      const { error } = await supabase
        .from('profiles')
        .update({ canvas_ical_url: url })
        .eq('id', userId);
      if (error) throw error;
      setCanvasUrl(url);
      setCanvasModalVisible(false);
      Alert.alert('Connected!', 'Your Canvas calendar has been linked successfully.');
    } catch (e: any) {
      Alert.alert('Connection Failed', 'Could not fetch your calendar. Please check the URL and try again.');
      if (__DEV__) console.error('[Canvas] Connect error:', e?.message);
    } finally {
      setCanvasConnecting(false);
    }
  };

  const handleCanvasDisconnect = async () => {
    Alert.alert('Disconnect Canvas?', 'Your class schedule will no longer appear on the dashboard.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: async () => {
          try {
            const userId = await requireUserId();
            await supabase.from('profiles').update({ canvas_ical_url: null }).eq('id', userId);
            setCanvasUrl('');
            setCanvasModalVisible(false);
          } catch (e) {
            if (__DEV__) console.error('[Canvas] Disconnect error:', e);
          }
        },
      },
    ]);
  };

  const handleWeeklyReport = () => {
    setWeeklyReportVisible(true);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: 'Check out CampusPlate — track your dining nutrition at Virginia Tech!',
      });
    } catch {}
  };

  // ── SettingsRow sub-component ──
  const SettingsRow = ({ icon, iconBg, iconColor, label, subtitle, onPress, rightContent, textColor, isLast }: {
    icon: keyof typeof Feather.glyphMap;
    iconBg: ColorName;
    iconColor: ColorName;
    label: string;
    subtitle?: string;
    onPress?: () => void;
    rightContent?: React.ReactNode;
    textColor?: ColorName;
    isLast?: boolean;
  }) => {
    const inner = (
      <Box flexDirection="row" alignItems="center" style={{ paddingVertical: 14 }}>
        <Box
          width={34}
          height={34}
          backgroundColor={iconBg}
          justifyContent="center"
          alignItems="center"
          style={{ borderRadius: 8, marginRight: 12 }}
        >
          <Feather name={icon} size={16} color={theme.colors[iconColor]} />
        </Box>
        <Box style={{ flexShrink: 1 }}>
          <Text variant="body" color={textColor || 'text'}>{label}</Text>
          {subtitle ? <Text variant="bodySmall" color="textDim" style={{ marginTop: 2 }}>{subtitle}</Text> : null}
        </Box>
        <Box flex={1} />
        {rightContent}
        {!rightContent && textColor !== 'error' && (
          <Feather name="chevron-right" size={18} color={theme.colors.textDim} style={{ opacity: 0.5 }} />
        )}
      </Box>
    );
    return (
      <>
        {onPress ? (
          <TouchableOpacity onPress={onPress} activeOpacity={0.6}>{inner}</TouchableOpacity>
        ) : inner}
        {!isLast && <Box height={1} backgroundColor="borderLight" style={{ marginLeft: 46 }} />}
      </>
    );
  };

  // ── Loading state ──
  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <Box flex={1} justifyContent="center" alignItems="center">
          <ActivityIndicator size="large" color={theme.colors.maroon} />
        </Box>
      </SafeAreaView>
    );
  }

  // ── Main render ──
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: 20, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await loadData();
              setRefreshing(false);
            }}
            tintColor="#861F41"
          />
        }
      >

        {/* Page title */}
        <Text variant="pageTitle" style={{ paddingHorizontal: 20 }}>Settings</Text>

        {/* ── Profile card ── */}
        <Card variant="feature" margin="m" padding="l">
          {/* Top row: avatar + name + edit */}
          <Box flexDirection="row" alignItems="center" style={{ gap: 16, marginBottom: 20 }}>
            <Box
              width={56}
              height={56}
              borderRadius="full"
              backgroundColor="maroon"
              justifyContent="center"
              alignItems="center"
            >
              <Text
                style={{ fontSize: 22, color: '#fff', fontFamily: 'Outfit_700Bold' }}
              >
                {(profile?.name || 'U').split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)}
              </Text>
            </Box>
            <Box flex={1}>
              <Text style={{ fontSize: 20, fontFamily: 'Outfit_700Bold' }} color="text">
                {profile?.name || 'Student'}
              </Text>
              <Text variant="bodySmall" color="textMuted" style={{ marginTop: 2 }}>
                {profile?.year || ''}{profile?.year && profile?.dorm ? ' · ' : ''}{profile?.dorm || ''}
              </Text>
            </Box>
            <TouchableOpacity onPress={() => setProfileModalVisible(true)} activeOpacity={0.7}>
              <Box borderWidth={1} borderColor="silver" style={{ borderRadius: 6, paddingHorizontal: 14, paddingVertical: 8 }}>
                <Text variant="body" color="textMuted" style={{ fontSize: 13 }}>Edit</Text>
              </Box>
            </TouchableOpacity>
          </Box>

          {/* Stats row */}
          <Box flexDirection="row" backgroundColor="backgroundAlt" overflow="hidden" style={{ borderRadius: 8 }}>
            <Box flex={1} alignItems="center" style={{ paddingVertical: 12 }}>
              <Text variant="statValue" style={{ color: theme.colors.gold }}>{streakData?.currentStreak ?? 0}d</Text>
              <Text variant="statLabel" style={{ marginTop: 2 }}>STREAK</Text>
            </Box>
            <Box width={1} marginVertical="s" backgroundColor="borderLight" />
            <Box flex={1} alignItems="center" style={{ paddingVertical: 12 }}>
              <Text variant="statValue" color="text">{totalMeals}</Text>
              <Text variant="statLabel" style={{ marginTop: 2 }}>LOGGED</Text>
            </Box>
            <Box width={1} marginVertical="s" backgroundColor="borderLight" />
            <Box flex={1} alignItems="center" style={{ paddingVertical: 12 }}>
              <Text variant="statValue" style={{ color: scoreGradeColor }}>{scoreValue}%</Text>
              <Text variant="statLabel" style={{ marginTop: 2 }}>GOAL</Text>
            </Box>
          </Box>

        </Card>

        {/* ── NUTRITION section ── */}
        <Text variant="sectionHeader" style={{ paddingHorizontal: 20, marginTop: 20, marginBottom: 6 }}>NUTRITION</Text>
        <Card borderRadius="l" marginHorizontal="m" style={{ paddingHorizontal: 18, paddingVertical: 2 }}>
          <SettingsRow
            icon="target" iconBg="maroonTint" iconColor="maroon"
            label="Nutrition Goals" onPress={() => setGoalsModalVisible(true)}
            rightContent={
              <>
                <Text variant="bodySmall" color="textDim" marginRight="s">{currentGoals.goalCalories.toLocaleString()} kcal</Text>
                <Feather name="chevron-right" size={18} color={theme.colors.textDim} style={{ opacity: 0.5 }} />
              </>
            }
          />
          <SettingsRow
            icon="droplet" iconBg="silverTint" iconColor="silver"
            label="Water Goal" onPress={handleWaterGoal}
            rightContent={
              <>
                <Text variant="bodySmall" color="textDim" marginRight="s">{waterGoalOz} oz</Text>
                <Feather name="chevron-right" size={18} color={theme.colors.textDim} style={{ opacity: 0.5 }} />
              </>
            }
          />
          <SettingsRow
            icon="heart" iconBg="successTint" iconColor="success"
            label="Nutrition Preferences" onPress={() => setNutritionPrefsModalVisible(true)} isLast
          />
        </Card>

        {/* ── APP section ── */}
        <Text variant="sectionHeader" style={{ paddingHorizontal: 20, marginTop: 20, marginBottom: 6 }}>APP</Text>
        <Card borderRadius="l" marginHorizontal="m" style={{ paddingHorizontal: 18, paddingVertical: 2 }}>
          <SettingsRow
            icon="moon" iconBg="silverTint" iconColor="silver"
            label="Appearance"
            rightContent={
              <Switch
                value={themeMode === 'dark'}
                onValueChange={toggleTheme}
                trackColor={{ false: theme.colors.silverLight, true: theme.colors.maroon }}
                thumbColor="#fff"
              />
            }
          />
          <SettingsRow
            icon="bell" iconBg="warningTint" iconColor="warning"
            label="Reminders" onPress={handleReminders}
            rightContent={
              <>
                <Text variant="bodySmall" style={{ color: remindersOn ? theme.colors.success : theme.colors.textDim, marginRight: 8 }}>{remindersOn ? 'On' : 'Off'}</Text>
                <Feather name="chevron-right" size={18} color={theme.colors.textDim} style={{ opacity: 0.5 }} />
              </>
            }
          />
          <SettingsRow
            icon="bar-chart-2" iconBg="proteinTint" iconColor="proteinRing"
            label="Daily Recap"
            rightContent={
              <Switch
                value={dailySummaryEnabled}
                onValueChange={toggleDailySummary}
                trackColor={{ false: theme.colors.silverLight, true: theme.colors.maroon }}
                thumbColor="#fff"
              />
            }
          />
          <SettingsRow
            icon="file-text" iconBg="maroonTint" iconColor="maroon"
            label="Weekly Report" onPress={handleWeeklyReport} isLast
          />
        </Card>

        {/* ── INTEGRATIONS section ── */}
        <Text variant="sectionHeader" style={{ paddingHorizontal: 20, marginTop: 20, marginBottom: 6 }}>INTEGRATIONS</Text>
        <Card borderRadius="l" marginHorizontal="m" style={{ paddingHorizontal: 18, paddingVertical: 2 }}>
          <SettingsRow
            icon="calendar" iconBg="proteinTint" iconColor="proteinRing"
            label="Class Schedule"
            subtitle="Manage your weekly classes"
            onPress={() => setScheduleEditorVisible(true)}
            isLast
          />
        </Card>

        {/* ── ABOUT section ── */}
        <Text variant="sectionHeader" style={{ paddingHorizontal: 20, marginTop: 20, marginBottom: 6 }}>ABOUT</Text>
        <Card borderRadius="l" marginHorizontal="m" style={{ paddingHorizontal: 18, paddingVertical: 2 }}>
          <SettingsRow
            icon="help-circle" iconBg="silverTint" iconColor="silver"
            label="Help & FAQ" onPress={() => setHelpModalVisible(true)}
          />
          <SettingsRow
            icon="share-2" iconBg="silverTint" iconColor="silver"
            label="Tell a friend" onPress={handleShare}
          />
          <SettingsRow
            icon="info" iconBg="silverTint" iconColor="silver"
            label="About" isLast
            onPress={() => setAboutModalVisible(true)}
            rightContent={
              <>
                <Text variant="bodySmall" color="textDim" marginRight="s">v2.5</Text>
                <Feather name="chevron-right" size={18} color={theme.colors.textDim} style={{ opacity: 0.5 }} />
              </>
            }
          />
        </Card>

        {/* ── Sign out ── */}
        <Card borderRadius="l" marginHorizontal="m" style={{ paddingHorizontal: 18, paddingVertical: 2, marginTop: 8 }}>
          <SettingsRow
            icon="log-out" iconBg="errorTint" iconColor="error"
            label="Sign Out" textColor="error" onPress={handleSignOut} isLast
          />
        </Card>

        {/* ── Footer ── */}
        <Box alignItems="center" style={{ marginTop: 24, paddingBottom: 8 }}>
          <Image
            source={require('@/assets/images/logo-simplified-small.png')}
            style={{ width: 48, height: 48, marginBottom: 8 }}
            resizeMode="contain"
          />
          <Text variant="muted" color="silver" style={{ fontSize: 13 }}>CampusPlate v2.5</Text>
          <Text variant="dim" color="silver" style={{ opacity: 0.5, marginTop: 4 }}>Built for Hokies, by Hokies</Text>
        </Box>
      </ScrollView>

      {/* ── Modals ── */}
      <EditGoals
        visible={goalsModalVisible}
        currentGoals={currentGoals}
        onSave={handleSaveGoals}
        onRecalculate={handleRecalculateGoals}
        onClose={() => setGoalsModalVisible(false)}
      />

      <EditProfile
        visible={profileModalVisible}
        onClose={() => setProfileModalVisible(false)}
        onSaved={loadData}
      />

      <EditNutritionPrefs
        visible={nutritionPrefsModalVisible}
        onClose={() => setNutritionPrefsModalVisible(false)}
        onSaved={loadData}
      />

      <HelpFAQ
        visible={helpModalVisible}
        onClose={() => setHelpModalVisible(false)}
      />

      <WeeklyReport
        visible={weeklyReportVisible}
        onClose={() => setWeeklyReportVisible(false)}
      />

      <ReminderSettings
        visible={remindersVisible}
        onClose={() => { setRemindersVisible(false); loadData(); }}
      />

      {/* Canvas Calendar Setup Modal */}
      <Modal
        visible={canvasModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setCanvasModalVisible(false)}
      >
        <Box flex={1} backgroundColor="background" style={{ paddingTop: 16 }}>
          {/* Header */}
          <Box flexDirection="row" justifyContent="space-between" alignItems="center" style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 }}>
            <Text style={{ fontSize: 20, fontFamily: 'Outfit_700Bold' }} color="text">
              Connect Canvas Calendar
            </Text>
            <TouchableOpacity onPress={() => setCanvasModalVisible(false)}>
              <Feather name="x" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </Box>

          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
            {/* Instructions */}
            <Box style={{ marginBottom: 24 }}>
              <Text variant="muted" style={{ marginBottom: 16, lineHeight: 20 }}>
                Follow these steps to get your Canvas calendar URL:
              </Text>
              {[
                { step: '1', text: 'Open Canvas in your browser' },
                { step: '2', text: 'Go to Account \u2192 Settings' },
                { step: '3', text: 'Scroll to Calendar \u2192 Click "Calendar Feed"' },
                { step: '4', text: 'Copy the URL that appears' },
              ].map((item) => (
                <Box key={item.step} flexDirection="row" alignItems="center" style={{ marginBottom: 12 }}>
                  <Box
                    width={28}
                    height={28}
                    borderRadius="full"
                    backgroundColor="maroonTint"
                    justifyContent="center"
                    alignItems="center"
                    style={{ marginRight: 12 }}
                  >
                    <Text style={{ fontSize: 13, fontFamily: 'DMSans_700Bold', color: theme.colors.maroon }}>
                      {item.step}
                    </Text>
                  </Box>
                  <Text variant="body" color="text" style={{ flex: 1 }}>{item.text}</Text>
                </Box>
              ))}
            </Box>

            {/* URL Input */}
            <TextInput
              style={{
                backgroundColor: theme.colors.inputBg,
                borderColor: theme.colors.inputBorder,
                color: theme.colors.text,
                fontFamily: 'DMSans_400Regular',
                borderRadius: 10,
                padding: 14,
                fontSize: 15,
                borderWidth: 1,
                marginBottom: 16,
              }}
              placeholder="Paste your Canvas calendar URL here"
              placeholderTextColor={theme.colors.textDim}
              value={canvasUrlInput}
              onChangeText={setCanvasUrlInput}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />

            {/* Connect button */}
            <TouchableOpacity
              onPress={handleCanvasConnect}
              disabled={canvasConnecting || !canvasUrlInput.trim()}
              activeOpacity={0.8}
            >
              <Box
                backgroundColor="maroon"
                alignItems="center"
                justifyContent="center"
                style={{ padding: 16, borderRadius: 14, opacity: canvasConnecting || !canvasUrlInput.trim() ? 0.5 : 1 }}
              >
                {canvasConnecting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={{ color: '#fff', fontSize: 16, fontFamily: 'DMSans_700Bold' }}>
                    {canvasUrl ? 'Update' : 'Connect'}
                  </Text>
                )}
              </Box>
            </TouchableOpacity>

            {/* Connected state — show disconnect */}
            {!!canvasUrl && (
              <Box style={{ marginTop: 24, alignItems: 'center' }}>
                <Box flexDirection="row" alignItems="center" style={{ marginBottom: 16 }}>
                  <Feather name="check-circle" size={18} color={theme.colors.success} style={{ marginRight: 8 }} />
                  <Text variant="body" style={{ color: theme.colors.success }}>Calendar Connected</Text>
                </Box>
                <TouchableOpacity onPress={handleCanvasDisconnect}>
                  <Text style={{ fontSize: 14, fontFamily: 'DMSans_500Medium', color: theme.colors.error }}>
                    Disconnect Calendar
                  </Text>
                </TouchableOpacity>
              </Box>
            )}
          </ScrollView>
        </Box>
      </Modal>

      {/* Paywall Modal */}
      <PaywallModal visible={paywallVisible} onClose={() => setPaywallVisible(false)} />

      <ScheduleEditor visible={scheduleEditorVisible} onClose={() => setScheduleEditorVisible(false)} />

      {/* About Modal */}
      <Modal
        visible={aboutModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAboutModalVisible(false)}
      >
        <Box flex={1} justifyContent="center" alignItems="center" padding="l" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <Box backgroundColor="card" width="100%" alignItems="center" style={{ borderRadius: 14, paddingHorizontal: 24, paddingTop: 32, paddingBottom: 24 }}>
            {/* Lightning bolt icon */}
            <Box
              width={72}
              height={72}
              borderRadius="full"
              backgroundColor="maroonTint"
              justifyContent="center"
              alignItems="center"
              style={{ marginBottom: 20 }}
            >
              <Feather name="zap" size={36} color={theme.colors.maroon} />
            </Box>

            <Text style={{ fontSize: 24, fontFamily: 'Outfit_700Bold', marginBottom: 6 }} color="text">
              CampusPlate
            </Text>
            <Text style={{ fontSize: 14, fontFamily: 'DMSans_400Regular', marginBottom: 16 }} color="textMuted">
              v2.5
            </Text>
            <Text style={{ fontSize: 15, fontFamily: 'DMSans_400Regular', textAlign: 'center' }} color="textDim">
              Built for Hokies, by Hokies
            </Text>

            <TouchableOpacity
              onPress={() => setAboutModalVisible(false)}
              activeOpacity={0.8}
              style={{ marginTop: 28, width: '100%' }}
            >
              <Box backgroundColor="maroon" alignItems="center" style={{ padding: 14, borderRadius: 14 }}>
                <Text style={{ color: '#fff', fontSize: 16, fontFamily: 'DMSans_700Bold' }}>Close</Text>
              </Box>
            </TouchableOpacity>
          </Box>
        </Box>
      </Modal>

      <Modal
        visible={waterGoalModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setWaterGoalModalVisible(false)}
      >
        <Box flex={1} justifyContent="center" alignItems="center" padding="l" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <Box backgroundColor="background" width="100%" style={{ borderRadius: 12, padding: 24 }}>
            {/* Modal handle */}
            <Box alignSelf="center" style={{ width: 36, height: 4, borderRadius: 9999, backgroundColor: '#A8A9AD', marginBottom: 16 }} />
            <Text
              style={{ fontSize: 20, fontFamily: 'Outfit_700Bold', textAlign: 'center', marginBottom: 4 }}
              color="text"
            >
              Water Goal
            </Text>
            <Text variant="muted" style={{ textAlign: 'center', marginBottom: 20 }}>
              Set your daily water goal in ounces
            </Text>
            <TextInput
              style={{
                backgroundColor: theme.colors.inputBg,
                borderColor: theme.colors.inputBorder,
                color: theme.colors.text,
                fontFamily: 'DMSans_400Regular',
                borderRadius: 6,
                padding: 14,
                fontSize: 16,
                borderWidth: 1,
                marginBottom: 16,
                textAlign: 'center',
              }}
              placeholder="Ounces"
              placeholderTextColor={theme.colors.textDim}
              value={waterGoalInput}
              onChangeText={setWaterGoalInput}
              keyboardType="numeric"
              autoFocus
            />
            <TouchableOpacity
              onPress={saveWaterGoal}
              activeOpacity={0.8}
            >
              <Box backgroundColor="maroon" alignItems="center" style={{ padding: 16, borderRadius: 6 }}>
                <Text style={{ color: '#fff', fontSize: 16, fontFamily: 'DMSans_700Bold' }}>Save</Text>
              </Box>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setWaterGoalModalVisible(false)}
              style={{ marginTop: 12, alignItems: 'center' }}
            >
              <Text style={{ fontSize: 14, fontFamily: 'DMSans_600SemiBold', color: '#A8A9AD' }}>Cancel</Text>
            </TouchableOpacity>
          </Box>
        </Box>
      </Modal>
    </SafeAreaView>
  );
}
