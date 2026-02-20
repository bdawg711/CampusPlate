import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/src/context/ThemeContext';
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

export default function MoreScreen() {
  const { mode, colors, toggleTheme } = useTheme();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [streakData, setStreakData] = useState<StreakData | null>(null);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [waterGoalOz, setWaterGoalOz] = useState<number>(64);
  const [totalMeals, setTotalMeals] = useState(0);
  const [scoreGrade, setScoreGrade] = useState('—');
  const [scoreGradeColor, setScoreGradeColor] = useState('#34C759');

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

      // Fetch streak, water streak, and total meals in parallel
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

      // Compute daily score for stats row
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
      console.error('More load error:', e);
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
      if (error) { console.error('Toggle failed:', error.message); Alert.alert('Error', 'Failed to save. Please try again.'); return; }
      setProfile((p: any) => p ? { ...p, high_protein: newVal } : p);
    } catch (e) {
      console.error('Toggle error:', e);
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
      console.error('Failed to save water goal:', e);
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
      console.error('Failed to save goals:', error);
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
        message: 'Check out CampusPlate — track your dining nutrition at Virginia Tech! 🍽️',
      });
    } catch { /* ignore */ }
  };

  const SettingsRow = ({ icon, iconBg, iconColor, label, onPress, rightContent, textColor, isLast }: {
    icon: keyof typeof Feather.glyphMap; iconBg: string; iconColor: string;
    label: string; onPress?: () => void; rightContent?: React.ReactNode;
    textColor?: string; isLast?: boolean;
  }) => (
    <>
      <TouchableOpacity style={st.settingsRow} onPress={onPress} activeOpacity={onPress ? 0.6 : 1}>
        <View style={[st.rowIcon, { backgroundColor: iconBg }]}>
          <Feather name={icon} size={16} color={iconColor} />
        </View>
        <Text style={[st.rowLabel, { color: textColor || colors.text }]}>{label}</Text>
        <View style={{ flex: 1 }} />
        {rightContent}
        {!rightContent && textColor !== colors.red && (
          <Feather name="chevron-right" size={18} color={colors.textDim} style={{ opacity: 0.5 }} />
        )}
      </TouchableOpacity>
      {!isLast && <View style={[st.rowDivider, { backgroundColor: colors.cardGlassBorder }]} />}
    </>
  );

  if (loading) {
    return (
      <SafeAreaView style={[st.safe, { backgroundColor: colors.background }]}>
        <View style={st.loadingWrap}><ActivityIndicator size="large" color={colors.maroon} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[st.safe, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={st.pad} showsVerticalScrollIndicator={false}>
        {/* Page Title */}
        <Text style={[st.pageTitle, { color: colors.text }]}>Settings</Text>

        {/* Profile Card */}
        <View style={[st.profileCard, { backgroundColor: colors.cardGlass, borderColor: colors.cardGlassBorder }]}>
          {/* Top row: avatar + name + edit */}
          <View style={st.profileTop}>
            <View style={[st.avatar, { backgroundColor: colors.maroon }]}>
              <Text style={[{ fontSize: 22, color: '#fff', fontFamily: 'Outfit_700Bold' }]}>
                {(profile?.name || 'U').split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[{ fontSize: 20, color: colors.text, fontFamily: 'Outfit_700Bold' }]}>
                {profile?.name || 'Student'}
              </Text>
              <Text style={[{ fontSize: 14, color: colors.textMuted, fontFamily: 'DMSans_400Regular', marginTop: 2 }]}>
                {profile?.year || ''}{profile?.year && profile?.dorm ? ' · ' : ''}{profile?.dorm || ''}
              </Text>
            </View>
            <TouchableOpacity
              style={[st.editBtn, { borderColor: colors.cardGlassBorder }]}
              onPress={() => setProfileModalVisible(true)}
              activeOpacity={0.7}
            >
              <Text style={[{ fontSize: 13, color: colors.textMuted, fontFamily: 'DMSans_500Medium' }]}>Edit</Text>
            </TouchableOpacity>
          </View>

          {/* Stats Row */}
          <View style={[st.statsRow, { backgroundColor: colors.cardAlt }]}>
            <View style={st.stat}>
              <Text style={[st.statValue, { color: colors.orange }]}>{streakData?.currentStreak ?? 0}d</Text>
              <Text style={[st.statLabel, { color: colors.textDim }]}>STREAK</Text>
            </View>
            <View style={[st.statDivider, { backgroundColor: colors.cardGlassBorder }]} />
            <View style={st.stat}>
              <Text style={[st.statValue, { color: colors.blue }]}>{totalMeals}</Text>
              <Text style={[st.statLabel, { color: colors.textDim }]}>LOGGED</Text>
            </View>
            <View style={[st.statDivider, { backgroundColor: colors.cardGlassBorder }]} />
            <View style={st.stat}>
              <Text style={[st.statValue, { color: scoreGradeColor }]}>{scoreGrade}</Text>
              <Text style={[st.statLabel, { color: colors.textDim }]}>SCORE</Text>
            </View>
          </View>

          {/* Badges */}
          {badges.length > 0 && (
            <View style={{ marginTop: 20 }}>
              <View style={st.badgesHeader}>
                <Text style={[{ fontSize: 14, color: colors.text, fontFamily: 'DMSans_600SemiBold' }]}>Badges</Text>
                <Text style={[{ fontSize: 12, color: colors.textDim, fontFamily: 'DMSans_400Regular' }]}>
                  {badges.filter((b) => b.earned).length} of {badges.length}
                </Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.badgesScroll}>
                {badges.map((b) => (
                  <View key={b.id} style={st.badgeItem}>
                    <StreakBadge badge={b} size="small" />
                  </View>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        {/* ── NUTRITION ── */}
        <Text style={[st.groupLabel, { color: colors.textDim }]}>NUTRITION</Text>
        <View style={[st.settingsGroup, { backgroundColor: colors.cardGlass, borderColor: colors.cardGlassBorder }]}>
          <SettingsRow
            icon="target" iconBg="rgba(139,30,63,0.15)" iconColor={colors.maroon}
            label="Nutrition Goals" onPress={() => setGoalsModalVisible(true)}
            rightContent={
              <>
                <Text style={[st.rowValue, { color: colors.textDim }]}>{currentGoals.goalCalories.toLocaleString()} kcal</Text>
                <Feather name="chevron-right" size={18} color={colors.textDim} style={{ opacity: 0.5 }} />
              </>
            }
          />
          <SettingsRow
            icon="droplet" iconBg="rgba(91,127,255,0.15)" iconColor={colors.blue}
            label="Water Goal" onPress={handleWaterGoal}
            rightContent={
              <>
                <Text style={[st.rowValue, { color: colors.textDim }]}>{waterGoalOz} oz</Text>
                <Feather name="chevron-right" size={18} color={colors.textDim} style={{ opacity: 0.5 }} />
              </>
            }
          />
          <SettingsRow
            icon="heart" iconBg="rgba(52,199,89,0.15)" iconColor={colors.green}
            label="Nutrition Preferences" onPress={() => setNutritionPrefsModalVisible(true)}
          />
          <SettingsRow
            icon="activity" iconBg="rgba(232,119,34,0.15)" iconColor={colors.orange}
            label="Gym Mode" isLast
            rightContent={
              <Switch
                value={profile?.high_protein || false}
                onValueChange={toggleHighProtein}
                trackColor={{ false: colors.textDim, true: colors.maroon }}
                thumbColor="#fff"
              />
            }
          />
        </View>

        {/* ── APP ── */}
        <Text style={[st.groupLabel, { color: colors.textDim }]}>APP</Text>
        <View style={[st.settingsGroup, { backgroundColor: colors.cardGlass, borderColor: colors.cardGlassBorder }]}>
          <SettingsRow
            icon="bell" iconBg="rgba(255,214,10,0.12)" iconColor={colors.yellow}
            label="Reminders" onPress={handleReminders}
            rightContent={
              <>
                <Text style={[st.rowValue, { color: remindersOn ? colors.green : colors.textDim }]}>{remindersOn ? 'On' : 'Off'}</Text>
                <Feather name="chevron-right" size={18} color={colors.textDim} style={{ opacity: 0.5 }} />
              </>
            }
          />
          <SettingsRow
            icon="moon" iconBg="rgba(91,127,255,0.12)" iconColor={colors.blue}
            label="Appearance" onPress={toggleTheme}
            rightContent={
              <>
                <Text style={[st.rowValue, { color: colors.textDim }]}>{mode === 'dark' ? 'Dark' : 'Light'}</Text>
                <Feather name="chevron-right" size={18} color={colors.textDim} style={{ opacity: 0.5 }} />
              </>
            }
          />
          <SettingsRow
            icon="bar-chart-2" iconBg="rgba(139,30,63,0.12)" iconColor={colors.maroon}
            label="Weekly Report" onPress={handleWeeklyReport} isLast
          />
        </View>

        {/* ── ABOUT ── */}
        <Text style={[st.groupLabel, { color: colors.textDim }]}>ABOUT</Text>
        <View style={[st.settingsGroup, { backgroundColor: colors.cardGlass, borderColor: colors.cardGlassBorder }]}>
          <SettingsRow
            icon="help-circle" iconBg="rgba(255,255,255,0.06)" iconColor={colors.textMuted}
            label="Help & FAQ" onPress={() => setHelpModalVisible(true)}
          />
          <SettingsRow
            icon="share-2" iconBg="rgba(255,255,255,0.06)" iconColor={colors.textMuted}
            label="Share CampusPlate" onPress={handleShare}
          />
          <SettingsRow
            icon="info" iconBg="rgba(255,255,255,0.06)" iconColor={colors.textMuted}
            label="About" isLast
            rightContent={
              <>
                <Text style={[st.rowValue, { color: colors.textDim }]}>v2.0</Text>
                <Feather name="chevron-right" size={18} color={colors.textDim} style={{ opacity: 0.5 }} />
              </>
            }
          />
        </View>

        {/* ── SIGN OUT ── */}
        <View style={[st.settingsGroup, { backgroundColor: colors.cardGlass, borderColor: colors.cardGlassBorder, marginTop: 8 }]}>
          <SettingsRow
            icon="log-out" iconBg="rgba(255,69,58,0.12)" iconColor={colors.red}
            label="Sign Out" textColor={colors.red} onPress={handleSignOut} isLast
          />
        </View>

        {/* Footer */}
        <View style={st.footerWrap}>
          <Text style={[st.footerVersion, { color: colors.textDim }]}>CampusPlate v2.0</Text>
          <Text style={[st.footerTagline, { color: colors.textDim }]}>Built for Hokies, by Hokies</Text>
        </View>
      </ScrollView>

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

      {/* Water Goal Modal */}
      <Modal
        visible={waterGoalModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setWaterGoalModalVisible(false)}
      >
        <View style={st.modalOverlay}>
          <View style={[st.modalContent, { backgroundColor: colors.background }]}>
            <Text style={[{ fontSize: 20, color: colors.text, fontFamily: 'Outfit_700Bold', textAlign: 'center', marginBottom: 4 }]}>
              Water Goal
            </Text>
            <Text style={[{ fontSize: 13, color: colors.textMuted, fontFamily: 'DMSans_400Regular', textAlign: 'center', marginBottom: 20 }]}>
              Set your daily water goal in ounces
            </Text>
            <TextInput
              style={[st.waterGoalInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text, fontFamily: 'DMSans_400Regular' }]}
              placeholder="Ounces"
              placeholderTextColor={colors.textDim}
              value={waterGoalInput}
              onChangeText={setWaterGoalInput}
              keyboardType="numeric"
              autoFocus
            />
            <TouchableOpacity
              style={[st.waterGoalSaveBtn, { backgroundColor: colors.maroon }]}
              onPress={saveWaterGoal}
            >
              <Text style={[{ color: '#fff', fontSize: 16, fontFamily: 'DMSans_700Bold' }]}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ marginTop: 12, alignItems: 'center' }}
              onPress={() => setWaterGoalModalVisible(false)}
            >
              <Text style={[{ fontSize: 14, color: colors.textMuted, fontFamily: 'DMSans_600SemiBold' }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1 },
  pad: { paddingTop: 20, paddingBottom: 100 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Page title
  pageTitle: { fontSize: 28, fontFamily: 'Outfit_700Bold', paddingHorizontal: 20 },

  // Profile card
  profileCard: { margin: 16, borderRadius: 18, borderWidth: 1, padding: 24 },
  profileTop: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 20 },
  avatar: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  editBtn: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },

  // Stats row
  statsRow: { flexDirection: 'row', borderRadius: 12, overflow: 'hidden' },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  statValue: { fontSize: 20, fontFamily: 'DMSans_700Bold' },
  statLabel: { fontSize: 11, fontFamily: 'DMSans_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },
  statDivider: { width: 1, marginVertical: 8 },

  // Badges
  badgesHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  badgesScroll: { paddingRight: 20 },
  badgeItem: { marginRight: 10 },

  // Settings groups
  groupLabel: { fontSize: 12, fontFamily: 'DMSans_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: 20, marginTop: 20, marginBottom: 6 },
  settingsGroup: { borderRadius: 16, borderWidth: 1, marginHorizontal: 16, paddingHorizontal: 18, paddingVertical: 2, marginBottom: 0 },

  // Settings rows
  settingsRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  rowIcon: { width: 34, height: 34, borderRadius: 9, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  rowLabel: { fontSize: 15, fontFamily: 'DMSans_500Medium' },
  rowValue: { fontSize: 14, fontFamily: 'DMSans_400Regular', marginRight: 8 },
  rowDivider: { height: 1, marginLeft: 46 },

  // Footer
  footerWrap: { alignItems: 'center', marginTop: 24, paddingBottom: 8 },
  footerVersion: { fontSize: 13, fontFamily: 'DMSans_400Regular' },
  footerTagline: { fontSize: 11, fontFamily: 'DMSans_400Regular', opacity: 0.5, marginTop: 4 },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { width: '100%', borderRadius: 20, padding: 24 },
  waterGoalInput: { borderRadius: 12, padding: 14, fontSize: 16, borderWidth: 1, marginBottom: 16, textAlign: 'center' },
  waterGoalSaveBtn: { padding: 16, borderRadius: 14, alignItems: 'center' },
});
