import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { useTheme } from '@/src/context/ThemeContext';
import { requireUserId } from '@/src/utils/auth';
import { supabase } from '@/src/utils/supabase';
import { getTodayWater, getWaterGoal } from '@/src/utils/water';
import { calculateDailyScore, DailyScore } from '@/src/utils/dailyScore';
import { getProgressData, ProgressData } from '@/src/utils/progressData';
import { getStreakData, getBadges, getWaterStreak, getTotalMealsLogged, StreakData, Badge } from '@/src/utils/streaks';
import DailyScoreCard from '@/src/components/DailyScoreCard';
import StreakDisplay from '@/src/components/StreakDisplay';
import CalorieChart from '@/src/components/CalorieChart';
import MacroBreakdown from '@/src/components/MacroBreakdown';
import StreakBadge from '@/src/components/StreakBadge';
import WeightChart from '@/src/components/WeightChart';
import { getWeightHistory, calculateWeightTrend, WeightEntry, WeightTrend } from '@/src/utils/weightData';
import MicronutrientScreen from '@/src/components/MicronutrientScreen';
import ShareCard from '@/src/components/ShareCard';
import WeeklyReport from '@/src/components/WeeklyReport';

function getLocalDate(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getDayLabel(offset: number) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString('en-US', { weekday: 'short' });
}

interface DayData {
  date: string;
  label: string;
  logged: boolean;
}

type RangeType = '1W' | '1M' | '3M' | 'All';

export default function ProgressScreen() {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [range, setRange] = useState<RangeType>('1M');

  // Data states
  const [dailyScore, setDailyScore] = useState<DailyScore | null>(null);
  const [streakData, setStreakData] = useState<StreakData | null>(null);
  const [progressData, setProgressData] = useState<ProgressData | null>(null);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [weekDots, setWeekDots] = useState<DayData[]>([]);

  // Weight data
  const [weightEntries, setWeightEntries] = useState<WeightEntry[]>([]);
  const [weightTrend, setWeightTrend] = useState<WeightTrend | null>(null);

  // Weight logging
  const [weightInput, setWeightInput] = useState('');
  const [savingWeight, setSavingWeight] = useState(false);
  const [lastWeight, setLastWeight] = useState<number | null>(null);

  // Share
  const [userName, setUserName] = useState('');
  const [sharing, setSharing] = useState(false);
  const shareCardRef = useRef<View>(null) as React.RefObject<View>;

  // Modals
  const [weeklyReportVisible, setWeeklyReportVisible] = useState(false);
  const [showMicros, setShowMicros] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const userId = await requireUserId();

      const rangeDaysMap: Record<RangeType, number> = { '1W': 7, '1M': 30, '3M': 90, 'All': 365 };
      const numDays = rangeDaysMap[range];

      const [profileRes, waterCount, waterGoalOz, streakRes, progressRes, waterStreak, totalMeals, weightHistory] = await Promise.all([
        supabase.from('profiles').select('name, goal_calories, goal_protein_g, goal_carbs_g, goal_fat_g, weight').eq('id', userId).single(),
        getTodayWater(userId),
        getWaterGoal(userId),
        getStreakData(userId),
        getProgressData(userId, numDays),
        getWaterStreak(userId),
        getTotalMealsLogged(userId),
        getWeightHistory(userId, numDays),
      ]);

      if (profileRes.data?.name) setUserName(profileRes.data.name);
      if (profileRes.data?.weight) setLastWeight(profileRes.data.weight);

      // Weight chart data
      setWeightEntries(weightHistory);
      if (weightHistory.length >= 2) {
        setWeightTrend(calculateWeightTrend(weightHistory));
      } else {
        setWeightTrend(null);
      }
      // Update lastWeight from weight_logs if available
      if (weightHistory.length > 0) {
        setLastWeight(weightHistory[weightHistory.length - 1].weight);
      }

      setStreakData(streakRes);
      setProgressData(progressRes);

      const badgeList = getBadges(streakRes, waterStreak, totalMeals);
      setBadges(badgeList);

      // Build 7-day dots for streak section
      const dots: DayData[] = [];
      for (let i = 6; i >= 0; i--) {
        const date = getLocalDate(-i);
        const dayLog = progressRes.days.find(d => d.date === date);
        dots.push({
          date,
          label: getDayLabel(-i),
          logged: (dayLog?.mealsLogged ?? 0) > 0,
        });
      }
      setWeekDots(dots);

      // Calculate today's daily score
      const today = getLocalDate();
      const todayLog = progressRes.days.find(d => d.date === today);
      if (profileRes.data) {
        const p = profileRes.data;
        const score = calculateDailyScore(
          {
            calories: todayLog?.calories ?? 0,
            protein: todayLog?.protein ?? 0,
            carbs: todayLog?.carbs ?? 0,
            fat: todayLog?.fat ?? 0,
          },
          {
            calories: p.goal_calories || 2000,
            protein: p.goal_protein_g || 150,
            carbs: p.goal_carbs_g || 200,
            fat: p.goal_fat_g || 65,
          },
          todayLog?.mealsLogged ?? 0,
          waterCount,
          waterGoalOz,
        );
        setDailyScore(score);
      }
    } catch (e) {
      console.error('Progress load error:', e);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const logWeight = async () => {
    const w = parseFloat(weightInput);
    if (!w || w < 50 || w > 500) return;
    setSavingWeight(true);
    try {
      const userId = await requireUserId();
      const today = getLocalDate();
      const { error } = await supabase.from('weight_logs').upsert(
        { user_id: userId, date: today, weight: w },
        { onConflict: 'user_id,date' }
      );
      if (error) {
        // Fallback: update profiles weight
        await supabase.from('profiles').update({ weight: w }).eq('id', userId);
      }
      setLastWeight(w);
      setWeightInput('');
      // Reload weight chart data
      await loadData();
    } catch (e) {
      console.error('Weight save error:', e);
      Alert.alert('Error', 'Failed to save weight. Please try again.');
    } finally {
      setSavingWeight(false);
    }
  };

  const earnedBadges = badges.filter(b => b.earned).length;

  if (loading) {
    return (
      <SafeAreaView style={[st.safe, { backgroundColor: colors.background }]}>
        <View style={st.loadingWrap}>
          <ActivityIndicator size="large" color={colors.maroon} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[st.safe, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          contentContainerStyle={st.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await loadData();
                setRefreshing(false);
              }}
              tintColor={colors.maroon}
            />
          }
        >
          {/* Header */}
          <Text style={[st.title, { color: colors.text, fontFamily: 'Outfit_700Bold' }]}>Progress</Text>

          {/* Time Range Pills */}
          <View style={st.rangePills}>
            {(['1W', '1M', '3M', 'All'] as RangeType[]).map((r) => (
              <TouchableOpacity
                key={r}
                style={[
                  st.rangePill,
                  {
                    backgroundColor: range === r ? colors.cardAlt : 'transparent',
                  },
                ]}
                onPress={() => setRange(r)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    st.rangePillText,
                    {
                      color: range === r ? colors.text : colors.textDim,
                      fontFamily: range === r ? 'DMSans_600SemiBold' : 'DMSans_400Regular',
                    },
                  ]}
                >
                  {r}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Empty state — no meal logs at all */}
          {(progressData?.totalMealsLogged ?? 0) === 0 && (
            <View style={[st.card, { backgroundColor: colors.card, borderColor: colors.border, marginBottom: 16, alignItems: 'center', paddingVertical: 32 }]}>
              <Text style={{ fontSize: 36 }}>📊</Text>
              <Text style={[{ fontSize: 16, color: colors.text, fontFamily: 'DMSans_600SemiBold', marginTop: 12, textAlign: 'center' }]}>
                Start logging meals to see your progress here!
              </Text>
              <Text style={[{ fontSize: 14, color: colors.textMuted, fontFamily: 'DMSans_400Regular', marginTop: 8, textAlign: 'center' }]}>
                Head to Browse to find your first meal 👉
              </Text>
            </View>
          )}

          {/* SECTION 1 — Daily Score */}
          {dailyScore && (
            <View style={{ marginBottom: 16 }}>
              <DailyScoreCard
                score={dailyScore.score}
                grade={dailyScore.grade}
                gradeColor={dailyScore.gradeColor}
                breakdown={dailyScore.breakdown}
              />
            </View>
          )}

          {/* SECTION 2 — Streak */}
          <View style={[st.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <StreakDisplay
              currentStreak={streakData?.currentStreak ?? 0}
              longestStreak={streakData?.longestStreak ?? 0}
            />
            {/* 7-day dot row */}
            <View style={st.dotRow}>
              {weekDots.map((d, i) => (
                <View key={i} style={{ alignItems: 'center' }}>
                  <View
                    style={[
                      st.streakDot,
                      { backgroundColor: d.logged ? colors.green : colors.textDim },
                    ]}
                  >
                    {d.logged && <Text style={{ fontSize: 12, color: '#fff' }}>✓</Text>}
                  </View>
                  <Text style={[st.dotLabel, { color: colors.textMuted }]}>{d.label}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* SECTION 3 — Calorie Trend */}
          <View style={[st.card, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 16 }]}>
            <Text style={[st.cardTitle, { color: colors.text }]}>Calorie Trend</Text>
            <CalorieChart
              data={progressData?.days ?? []}
              goalCalories={progressData?.goals.calories ?? 2000}
              range={range}
            />
          </View>

          {/* SECTION 4 — Weight Trend */}
          <View style={[st.card, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 16 }]}>
            <Text style={[st.cardTitle, { color: colors.text }]}>Weight Trend</Text>
            {weightEntries.length >= 2 && weightTrend ? (
              <WeightChart entries={weightEntries} trend={weightTrend} />
            ) : (
              <View style={st.placeholderContent}>
                <Feather name="trending-up" size={28} color={colors.textDim} style={{ opacity: 0.4 }} />
                <Text style={[st.placeholderText, { color: colors.textMuted }]}>
                  Log your weight to see trends here
                </Text>
                <Feather name="arrow-down" size={16} color={colors.textDim} style={{ opacity: 0.3, marginTop: 4 }} />
              </View>
            )}
          </View>

          {/* SECTION 5 — Macro Breakdown */}
          <View style={[st.card, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 16 }]}>
            <Text style={[st.cardTitle, { color: colors.text }]}>Macro Split (7-day avg)</Text>
            <MacroBreakdown
              actual={{
                protein: progressData?.weeklyAverages.thisWeek.protein ?? 0,
                carbs: progressData?.weeklyAverages.thisWeek.carbs ?? 0,
                fat: progressData?.weeklyAverages.thisWeek.fat ?? 0,
              }}
              target={{
                protein: progressData?.goals.protein ?? 150,
                carbs: progressData?.goals.carbs ?? 250,
                fat: progressData?.goals.fat ?? 65,
              }}
            />
          </View>

          {/* SECTION 6 — Badges */}
          <View style={{ marginTop: 16 }}>
            <View style={st.sectionHeaderRow}>
              <Text style={[st.sectionHeaderText, { color: colors.text }]}>Your Badges</Text>
              <Text style={[st.sectionHeaderMeta, { color: colors.textDim }]}>
                {earnedBadges} of {badges.length}
              </Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={st.badgeScroll}
            >
              {badges.map((b) => (
                <StreakBadge key={b.id} badge={b} size="small" />
              ))}
            </ScrollView>
          </View>

          {/* SECTION 7 — Micronutrient Link */}
          <TouchableOpacity
            style={[st.linkCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            activeOpacity={0.7}
            onPress={() => setShowMicros(true)}
          >
            <Text style={[st.linkCardText, { color: colors.textMuted }]}>View All Nutrients</Text>
            <Feather name="chevron-right" size={18} color={colors.textDim} />
          </TouchableOpacity>

          {/* SECTION 8 — Weekly Report */}
          <TouchableOpacity
            style={[st.card, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 12 }]}
            onPress={() => setWeeklyReportVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={[st.cardTitle, { color: colors.text }]}>Weekly Report</Text>
            <View style={st.reportRow}>
              <Text style={[st.reportSubtext, { color: colors.textMuted }]}>
                Your weekly report is ready
              </Text>
              <Feather name="chevron-right" size={18} color={colors.textDim} />
            </View>
          </TouchableOpacity>

          {/* SECTION 9 — Weight Logging (always visible) */}
          <View style={[st.card, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 16 }]}>
            <Text style={[st.cardTitle, { color: colors.text }]}>Log Weight</Text>
            {lastWeight ? (
              <Text style={[st.lastWeightText, { color: colors.textMuted }]}>
                Last logged: {lastWeight} lbs
              </Text>
            ) : (
              <Text style={[st.lastWeightText, { color: colors.textMuted }]}>
                Track your weight to see trends
              </Text>
            )}
            <View style={st.weightRow}>
              <TextInput
                style={[
                  st.weightInput,
                  {
                    backgroundColor: colors.inputBg,
                    borderColor: colors.inputBorder,
                    color: colors.text,
                    fontFamily: 'DMSans_400Regular',
                  },
                ]}
                placeholder="Weight in lbs"
                placeholderTextColor={colors.textDim}
                value={weightInput}
                onChangeText={setWeightInput}
                keyboardType="numeric"
              />
              <TouchableOpacity
                style={[st.saveBtn, { backgroundColor: colors.maroon, opacity: savingWeight ? 0.6 : 1 }]}
                onPress={logWeight}
                disabled={savingWeight}
                activeOpacity={0.7}
              >
                <Text style={st.saveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* SECTION 10 — Share */}
          <TouchableOpacity
            style={[st.shareBtn, { borderColor: colors.maroon, opacity: sharing ? 0.6 : 1 }]}
            activeOpacity={0.7}
            disabled={sharing}
            onPress={async () => {
              if (!shareCardRef.current) return;
              setSharing(true);
              try {
                const uri = await captureRef(shareCardRef, { format: 'png', quality: 0.9 });
                await Sharing.shareAsync(uri);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              } catch (e) {
                console.error('Share error:', e);
              } finally {
                setSharing(false);
              }
            }}
          >
            <Feather name="share" size={16} color={colors.maroon} style={{ marginRight: 8 }} />
            <Text style={[st.shareBtnText, { color: colors.maroon }]}>Share Today's Score</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <WeeklyReport
        visible={weeklyReportVisible}
        onClose={() => setWeeklyReportVisible(false)}
      />

      <Modal
        visible={showMicros}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowMicros(false)}
      >
        <MicronutrientScreen onClose={() => setShowMicros(false)} />
      </Modal>

      {/* Off-screen share card for capture */}
      {(() => {
        const today = getLocalDate();
        const todayData = progressData?.days.find(d => d.date === today);
        return (
          <ShareCard
            cardRef={shareCardRef}
            userName={userName}
            date={today}
            calories={todayData?.calories ?? 0}
            goalCalories={progressData?.goals.calories ?? 2000}
            protein={todayData?.protein ?? 0}
            carbs={todayData?.carbs ?? 0}
            fat={todayData?.fat ?? 0}
            grade={dailyScore?.grade ?? '–'}
            gradeColor={dailyScore?.gradeColor ?? colors.textDim}
            streak={streakData?.currentStreak ?? 0}
          />
        );
      })()}
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 20, paddingBottom: 120 },
  title: { fontSize: 26, marginBottom: 16 },

  // Range pills
  rangePills: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  rangePill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  rangePillText: {
    fontSize: 14,
  },

  // Card
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: 'DMSans_600SemiBold',
    marginBottom: 12,
  },

  // Streak dots
  dotRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
  },
  streakDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotLabel: {
    fontSize: 10,
    fontFamily: 'DMSans_400Regular',
    marginTop: 4,
  },

  // Placeholder content
  placeholderContent: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  placeholderText: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
  },

  // Section header
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionHeaderText: {
    fontSize: 16,
    fontFamily: 'DMSans_600SemiBold',
  },
  sectionHeaderMeta: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
  },

  // Badge scroll
  badgeScroll: {
    gap: 12,
    paddingBottom: 4,
  },

  // Link card
  linkCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  linkCardText: {
    fontSize: 15,
    fontFamily: 'DMSans_500Medium',
  },

  // Report
  reportRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reportSubtext: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
  },

  // Weight
  lastWeightText: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    marginBottom: 12,
  },
  weightRow: {
    flexDirection: 'row',
    gap: 10,
  },
  weightInput: {
    flex: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    borderWidth: 1,
  },
  saveBtn: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
  },

  // Share button
  shareBtn: {
    marginTop: 20,
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  shareBtnText: {
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
  },
});
