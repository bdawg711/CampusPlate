import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { Goals, getGoals, saveCustomGoals, recalculateGoals } from '@/src/utils/goals';
import { getStreakData, getBadges, getWaterStreak, getTotalMealsLogged, StreakData, Badge } from '@/src/utils/streaks';
import StreakBadge from '@/src/components/StreakBadge';

type ColorName = keyof Theme['colors'];

export default function SettingsRestyle() {
  const theme = useRestyleTheme<Theme>();

  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [streakData, setStreakData] = useState<StreakData | null>(null);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [waterGoalOz, setWaterGoalOz] = useState<number>(64);
  const [totalMeals, setTotalMeals] = useState(0);
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
  const [waterGoalModalVisible, setWaterGoalModalVisible] = useState(false);
  const [waterGoalInput, setWaterGoalInput] = useState('');

  const [currentGoals, setCurrentGoals] = useState<Goals>({
    goalCalories: 2000,
    goalProtein: 150,
    goalCarbs: 200,
    goalFat: 65,
  });

  const loadData = useCallback(async () => {
    try {
      const userId = await requireUserId();
      const { data } = await supabase
        .from('profiles')
        .select('name, year, dorm, goal_calories, high_protein, water_goal_oz, reminder_prefs')
        .eq('id', userId)
        .single();
      if (data) {
        setProfile(data);
        setWaterGoalOz(data.water_goal_oz ?? 64);
        const prefs = data.reminder_prefs as any[] | null;
        setRemindersOn(Array.isArray(prefs) && prefs.some((r: any) => r?.enabled));
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
      setScoreGrade(dailyScore.grade);
      setScoreGradeColor(dailyScore.gradeColor);
    } catch (e) {
      if (__DEV__) console.error('More load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const toggleHighProtein = async () => {
    try {
      const userId = await requireUserId();
      const newVal = !profile?.high_protein;
      const { error } = await supabase.from('profiles').update({ high_protein: newVal }).eq('id', userId);
      if (error) { if (__DEV__) console.error('Toggle failed:', error.message); Alert.alert('Error', 'Failed to save. Please try again.'); return; }
      setProfile((p: any) => p ? { ...p, high_protein: newVal } : p);
    } catch (e) {
      if (__DEV__) console.error('Toggle error:', e);
    }
  };

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
    const newGoals = await recalculateGoals(userId);
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
  const SettingsRow = ({ icon, iconBg, iconColor, label, onPress, rightContent, textColor, isLast }: {
    icon: keyof typeof Feather.glyphMap;
    iconBg: ColorName;
    iconColor: ColorName;
    label: string;
    onPress?: () => void;
    rightContent?: React.ReactNode;
    textColor?: ColorName;
    isLast?: boolean;
  }) => (
    <>
      <TouchableOpacity onPress={onPress} activeOpacity={onPress ? 0.6 : 1}>
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
          <Text variant="body" color={textColor || 'text'}>{label}</Text>
          <Box flex={1} />
          {rightContent}
          {!rightContent && textColor !== 'error' && (
            <Feather name="chevron-right" size={18} color={theme.colors.textDim} style={{ opacity: 0.5 }} />
          )}
        </Box>
      </TouchableOpacity>
      {!isLast && <Box height={1} backgroundColor="borderLight" style={{ marginLeft: 46 }} />}
    </>
  );

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
              <Text variant="statValue" style={{ color: scoreGradeColor }}>{scoreGrade}</Text>
              <Text variant="statLabel" style={{ marginTop: 2 }}>SCORE</Text>
            </Box>
          </Box>

          {/* Badges */}
          {badges.length > 0 && (
            <Box style={{ marginTop: 20 }}>
              <Box flexDirection="row" justifyContent="space-between" alignItems="center" style={{ marginBottom: 14 }}>
                <Text variant="cardTitle" style={{ fontSize: 14 }}>Badges</Text>
                <Text variant="dim" style={{ fontSize: 12 }}>
                  {badges.filter((b) => b.earned).length} of {badges.length}
                </Text>
              </Box>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 20 }}>
                {badges.map((b) => (
                  <Box key={b.id} style={{ marginRight: 10 }}>
                    <StreakBadge badge={b} size="small" />
                  </Box>
                ))}
              </ScrollView>
            </Box>
          )}
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
            label="Nutrition Preferences" onPress={() => setNutritionPrefsModalVisible(true)}
          />
          <SettingsRow
            icon="activity" iconBg="goldTint" iconColor="gold"
            label="Gym Mode" isLast
            rightContent={
              <Switch
                value={profile?.high_protein || false}
                onValueChange={toggleHighProtein}
                trackColor={{ false: theme.colors.silverLight, true: theme.colors.maroon }}
                thumbColor="#fff"
              />
            }
          />
        </Card>

        {/* ── APP section ── */}
        <Text variant="sectionHeader" style={{ paddingHorizontal: 20, marginTop: 20, marginBottom: 6 }}>APP</Text>
        <Card borderRadius="l" marginHorizontal="m" style={{ paddingHorizontal: 18, paddingVertical: 2 }}>
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
            icon="bar-chart-2" iconBg="maroonTint" iconColor="maroon"
            label="Weekly Report" onPress={handleWeeklyReport} isLast
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
            onPress={() => Alert.alert('CampusPlate v2.5', 'Virginia Tech dining nutrition tracker.\nTrack meals, hit your macros, eat smarter.\n\nBuilt for Hokies, by Hokies.')}
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
