import React, { useCallback, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';

// Restyle primitives
import { Box, Text } from '@/src/theme/restyleTheme';
import StaggeredList from '@/src/components/StaggeredList';

import Skeleton from '@/src/components/Skeleton';
import ErrorState from '@/src/components/ErrorState';
import { requireUserId } from '@/src/utils/auth';
import { supabase } from '@/src/utils/supabase';
import { getTodayWater, getWaterGoal } from '@/src/utils/water';
import { calculateDailyScore, DailyScore } from '@/src/utils/dailyScore';
import { getProgressData, ProgressData } from '@/src/utils/progressData';
import { getStreakData, getBadges, getWaterStreak, getTotalMealsLogged, StreakData, Badge } from '@/src/utils/streaks';
import DailyScoreCard, { ScoreDetailData } from '@/src/components/DailyScoreCard';
import StreakDisplay from '@/src/components/StreakDisplay';
import CalorieChart from '@/src/components/CalorieChart';
import MacroBreakdown from '@/src/components/MacroBreakdown';
import StreakBadge from '@/src/components/StreakBadge';
import WeightChart from '@/src/components/WeightChart';
import { getWeightHistory, calculateWeightTrend, WeightEntry, WeightTrend } from '@/src/utils/weightData';
import MicronutrientScreen from '@/src/components/MicronutrientScreen';
import ShareCard from '@/src/components/ShareCard';
import WeeklyReport from '@/src/components/WeeklyReport';
import { triggerHaptic } from '@/src/utils/haptics';

// ─── Direct color constants for non-Restyle elements ────────────────────────
const C = {
  white: '#FFFFFF',
  offWhite: '#FAFAFA',
  maroon: '#861F41',
  maroonDark: '#6B1835',
  gold: '#C5A55A',
  goldMuted: 'rgba(197,165,90,0.12)',
  silver: '#A8A9AD',
  silverLight: '#C8C9CC',
  silverMuted: 'rgba(168,169,173,0.10)',
  text: '#1A1A1A',
  textMuted: '#6B6B6F',
  textDim: '#9A9A9E',
  border: '#E8E8EA',
  borderLight: '#F0F0F2',
  inputBg: '#F5F5F7',
  success: '#34C759',
  warning: '#C5A55A',
  error: '#FF453A',
  blue: '#4A7FC5',
};

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

// ─── Section Header — silver uppercase with divider ─────────────────────────
function SectionHeader({ title, isFirst = false }: { title: string; isFirst?: boolean }) {
  return (
    <View style={{ marginTop: isFirst ? 0 : 28 }}>
      {!isFirst && (
        <View
          style={{
            height: 1,
            backgroundColor: C.borderLight,
            marginHorizontal: 0,
            marginBottom: 16,
          }}
        />
      )}
      <Text
        style={{
          fontSize: 12,
          fontFamily: 'DMSans_700Bold',
          color: C.silver,
          letterSpacing: 1.5,
          textTransform: 'uppercase',
          marginBottom: 14,
        }}
      >
        {title}
      </Text>
    </View>
  );
}

export default function ProgressScreen() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [range, setRange] = useState<RangeType>('1M');

  // Data states
  const [dailyScore, setDailyScore] = useState<DailyScore | null>(null);
  const [scoreDetail, setScoreDetail] = useState<ScoreDetailData | undefined>(undefined);
  const [streakData, setStreakData] = useState<StreakData | null>(null);
  const [progressData, setProgressData] = useState<ProgressData | null>(null);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [weekDots, setWeekDots] = useState<DayData[]>([]);
  const [monthDots, setMonthDots] = useState<DayData[]>([]);

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
  const [showWeightModal, setShowWeightModal] = useState(false);

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

      // Build 28-day data for month calendar grid
      const mDays: DayData[] = [];
      for (let i = 27; i >= 0; i--) {
        const date = getLocalDate(-i);
        const dayLog = progressRes.days.find(d => d.date === date);
        mDays.push({
          date,
          label: '',
          logged: (dayLog?.mealsLogged ?? 0) > 0,
        });
      }
      setMonthDots(mDays);

      // Calculate today's daily score
      const todayStr = getLocalDate();
      const todayLog = progressRes.days.find(d => d.date === todayStr);
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
        setScoreDetail({
          calories: { actual: todayLog?.calories ?? 0, goal: p.goal_calories || 2000 },
          protein: { actual: todayLog?.protein ?? 0, goal: p.goal_protein_g || 150 },
          carbs: { actual: todayLog?.carbs ?? 0, goal: p.goal_carbs_g || 200 },
          fat: { actual: todayLog?.fat ?? 0, goal: p.goal_fat_g || 65 },
          mealsLogged: todayLog?.mealsLogged ?? 0,
          water: { actual: waterCount, goal: waterGoalOz },
        });
      }
    } catch (e) {
      if (__DEV__) console.error('Progress load error:', e);
      setLoadError(true);
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
      const todayStr = getLocalDate();
      const { error } = await supabase.from('weight_logs').upsert(
        { user_id: userId, date: todayStr, weight: w },
        { onConflict: 'user_id,date' }
      );
      if (error) {
        // Fallback: update profiles weight
        await supabase.from('profiles').update({ weight: w }).eq('id', userId);
      }
      setLastWeight(w);
      setWeightInput('');
      setShowWeightModal(false);
      // Reload weight chart data
      await loadData();
    } catch (e) {
      if (__DEV__) console.error('Weight save error:', e);
      Alert.alert('Error', 'Failed to save weight. Please try again.');
    } finally {
      setSavingWeight(false);
    }
  };

  const today = getLocalDate();
  const todayData = progressData?.days.find(d => d.date === today);
  const earnedBadges = badges.filter(b => b.earned);
  const lockedBadges = badges.filter(b => !b.earned);
  const [showAllBadges, setShowAllBadges] = useState(false);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.offWhite }}>
        <Box padding="m" paddingBottom="xxl">
          {/* Title */}
          <Skeleton width={120} height={28} borderRadius={8} style={{ marginBottom: 16 }} />
          {/* Time tabs */}
          <Box flexDirection="row" style={{ gap: 8 }} marginBottom="l">
            <Skeleton width={70} height={36} borderRadius={6} />
            <Skeleton width={70} height={36} borderRadius={6} />
            <Skeleton width={70} height={36} borderRadius={6} />
            <Skeleton width={70} height={36} borderRadius={6} />
          </Box>
          {/* Section header skeleton */}
          <Skeleton width={80} height={10} borderRadius={4} style={{ marginBottom: 14 }} />
          {/* Daily Score card */}
          <Box
            style={{ backgroundColor: '#FFFFFF', borderRadius: 10, borderWidth: 1, borderColor: '#E8E8EA', padding: 16, marginBottom: 16 }}
          >
            <Skeleton width={100} height={12} borderRadius={6} style={{ marginBottom: 12 }} />
            <Box alignItems="center" marginBottom="s">
              <Skeleton width={64} height={64} borderRadius={32} />
            </Box>
            <Skeleton width={60} height={20} borderRadius={6} style={{ alignSelf: 'center', marginBottom: 12 }} />
            <Skeleton width={'100%' as any} height={8} borderRadius={4} style={{ marginBottom: 8 }} />
            <Skeleton width={'100%' as any} height={8} borderRadius={4} style={{ marginBottom: 8 }} />
            <Skeleton width={'80%' as any} height={8} borderRadius={4} />
          </Box>
          {/* Streak card */}
          <Box
            style={{ backgroundColor: '#FFFFFF', borderRadius: 10, borderWidth: 1, borderColor: '#E8E8EA', padding: 16, marginBottom: 16 }}
          >
            <Skeleton width={80} height={12} borderRadius={6} style={{ marginBottom: 12 }} />
            <Box flexDirection="row" alignItems="center" style={{ gap: 12 }}>
              <Skeleton width={48} height={48} borderRadius={24} />
              <Box>
                <Skeleton width={100} height={18} borderRadius={6} style={{ marginBottom: 6 }} />
                <Skeleton width={70} height={12} borderRadius={6} />
              </Box>
            </Box>
          </Box>
          {/* Calorie Trend card */}
          <Box
            style={{ backgroundColor: '#FFFFFF', borderRadius: 10, borderWidth: 1, borderColor: '#E8E8EA', padding: 16, marginBottom: 16 }}
          >
            <Skeleton width={120} height={12} borderRadius={6} style={{ marginBottom: 16 }} />
            <Skeleton width={'100%' as any} height={140} borderRadius={8} />
          </Box>
        </Box>
      </SafeAreaView>
    );
  }

  if (loadError && !dailyScore) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.offWhite }}>
        <Box flex={1} justifyContent="center">
          <ErrorState
            message="Couldn't load your progress. Check your connection and try again."
            onRetry={() => { setLoadError(false); setLoading(true); loadData(); }}
          />
        </Box>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.offWhite }}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
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
            tintColor={C.maroon}
          />
        }
      >
        {/* Header — pageTitle */}
        <Text variant="pageTitle" marginBottom="m">Progress</Text>

        {/* Rectangular time range tabs */}
        <Box flexDirection="row" marginBottom="l" style={{ gap: 0 }}>
          {(['1W', '1M', '3M', 'All'] as RangeType[]).map((r) => {
            const isActive = range === r;
            return (
              <TouchableOpacity
                key={r}
                onPress={() => { triggerHaptic('light'); setRange(r); }}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  alignItems: 'center',
                  backgroundColor: isActive ? C.maroon : 'transparent',
                  borderRadius: isActive ? 6 : 0,
                  borderBottomWidth: isActive ? 0 : 2,
                  borderBottomColor: isActive ? 'transparent' : C.borderLight,
                }}
              >
                <Text
                  variant="body"
                  style={{
                    fontFamily: 'DMSans_600SemiBold',
                    fontSize: 13,
                    color: isActive ? C.white : C.textMuted,
                  }}
                >
                  {r}
                </Text>
              </TouchableOpacity>
            );
          })}
        </Box>

        {/* Empty state — no meal logs at all */}
        {(progressData?.totalMealsLogged ?? 0) === 0 && (
          <Box
            backgroundColor="card"
            borderColor="border"
            borderWidth={1}
            borderRadius="m"
            padding="m"
            marginBottom="m"
            alignItems="center"
            style={{ paddingVertical: 32 }}
          >
            <Feather name="bar-chart-2" size={32} color={C.silver} />
            <Text
              variant="cardTitle"
              style={{ marginTop: 12, textAlign: 'center' }}
            >
              Start logging meals to see your progress here!
            </Text>
            <Text
              variant="muted"
              style={{ marginTop: 8, textAlign: 'center' }}
            >
              Head to Browse to find your first meal
            </Text>
          </Box>
        )}

        <StaggeredList staggerDelay={50}>

          {/* ═══════════════════════════════════════════════════════════
              SECTION 1 — THIS WEEK
             ═══════════════════════════════════════════════════════════ */}
          <SectionHeader title="This Week" isFirst />

          {/* Daily Score */}
          {dailyScore && (
            <Box marginBottom="m">
              <DailyScoreCard
                score={dailyScore.score}
                grade={dailyScore.grade}
                gradeColor={dailyScore.gradeColor}
                breakdown={dailyScore.breakdown}
                detailData={scoreDetail}
              />
            </Box>
          )}

          {/* Streak — visualization changes per range */}
          <Box
            backgroundColor="card"
            borderColor="border"
            borderWidth={1}
            borderRadius="m"
            padding="m"
            marginBottom="m"
          >
            <StreakDisplay
              currentStreak={streakData?.currentStreak ?? 0}
              longestStreak={streakData?.longestStreak ?? 0}
            />

            {/* 1W: 7-day dots */}
            {range === '1W' && (
              <Box flexDirection="row" justifyContent="space-around" style={{ marginTop: 16 }}>
                {weekDots.map((d, i) => {
                  const isToday = d.date === today;
                  const isFuture = d.date > today;
                  return (
                    <Box key={i} alignItems="center">
                      <Box
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 14,
                          justifyContent: 'center',
                          alignItems: 'center',
                          backgroundColor: d.logged
                            ? C.maroon
                            : (isToday || isFuture)
                              ? 'transparent'
                              : C.silver,
                          borderWidth: (!d.logged && isToday) ? 2 : (!d.logged && isFuture) ? 2 : 0,
                          borderColor: (!d.logged && isToday)
                            ? C.gold
                            : (!d.logged && isFuture)
                              ? C.borderLight
                              : 'transparent',
                        }}
                      >
                        {d.logged && <Feather name="check" size={12} color="#fff" />}
                      </Box>
                      <Text variant="dim" style={{ marginTop: 4 }}>{d.label}</Text>
                    </Box>
                  );
                })}
              </Box>
            )}

            {/* 1M: Mini calendar grid — 4 rows of 7 (GitHub contribution graph) */}
            {range === '1M' && (
              <Box style={{ marginTop: 16 }}>
                {/* Day-of-week headers */}
                <Box flexDirection="row" style={{ marginBottom: 6 }}>
                  {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((label, i) => (
                    <Box key={i} style={{ flex: 1, alignItems: 'center' }}>
                      <Text style={{ fontSize: 10, fontFamily: 'DMSans_500Medium', color: C.textDim }}>{label}</Text>
                    </Box>
                  ))}
                </Box>
                {/* 4 rows of 7 squares */}
                {[0, 1, 2, 3].map((row) => (
                  <Box key={row} flexDirection="row" style={{ marginBottom: 4 }}>
                    {[0, 1, 2, 3, 4, 5, 6].map((col) => {
                      const idx = row * 7 + col;
                      const d = monthDots[idx];
                      if (!d) return <Box key={col} style={{ flex: 1, aspectRatio: 1 }} />;
                      const isToday = d.date === today;
                      return (
                        <Box key={col} style={{ flex: 1, padding: 2 }}>
                          <Box
                            style={{
                              aspectRatio: 1,
                              borderRadius: 4,
                              backgroundColor: d.logged ? C.maroon : C.borderLight,
                              borderWidth: isToday ? 2 : 0,
                              borderColor: isToday ? C.gold : 'transparent',
                            }}
                          />
                        </Box>
                      );
                    })}
                  </Box>
                ))}
              </Box>
            )}

            {/* 3M / All: Condensed streak numbers */}
            {(range === '3M' || range === 'All') && (
              <Box flexDirection="row" style={{ marginTop: 16, gap: 24 }}>
                <Box alignItems="center" style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 28,
                      fontFamily: 'Outfit_700Bold',
                      color: C.maroon,
                    }}
                  >
                    {streakData?.currentStreak ?? 0}
                  </Text>
                  <Text variant="dim">Current streak</Text>
                </Box>
                <Box
                  style={{
                    width: 1,
                    backgroundColor: C.borderLight,
                  }}
                />
                <Box alignItems="center" style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 28,
                      fontFamily: 'Outfit_700Bold',
                      color: C.gold,
                    }}
                  >
                    {streakData?.longestStreak ?? 0}
                  </Text>
                  <Text variant="dim">Best streak</Text>
                </Box>
              </Box>
            )}
          </Box>

          {/* Calorie Trend */}
          <Box
            backgroundColor="card"
            borderColor="border"
            borderWidth={1}
            borderRadius="m"
            padding="m"
            marginBottom="s"
          >
            <Text variant="cardTitle" marginBottom="s">Calorie Trend</Text>
            <CalorieChart
              data={progressData?.days ?? []}
              goalCalories={progressData?.goals.calories ?? 2000}
              range={range}
            />
          </Box>

          {/* ═══════════════════════════════════════════════════════════
              SECTION 2 — BODY & NUTRITION
             ═══════════════════════════════════════════════════════════ */}
          <SectionHeader title="Body & Nutrition" />

          {/* Weight Trend — tappable to open log weight modal */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setShowWeightModal(true)}
          >
            <Box
              backgroundColor="card"
              borderColor="border"
              borderWidth={1}
              borderRadius="m"
              padding="m"
              marginBottom="m"
            >
              <Box flexDirection="row" justifyContent="space-between" alignItems="center" marginBottom="s">
                <Text variant="cardTitle">Weight Trend</Text>
                <Box flexDirection="row" alignItems="center" style={{ gap: 4 }}>
                  <Text variant="dim" style={{ color: C.maroon }}>Log Weight</Text>
                  <Feather name="plus-circle" size={14} color={C.maroon} />
                </Box>
              </Box>
              {weightEntries.length >= 2 && weightTrend ? (
                <WeightChart entries={weightEntries} trend={weightTrend} />
              ) : (
                <Box alignItems="center" style={{ paddingVertical: 16, gap: 8 }}>
                  <Feather name="trending-up" size={28} color={C.silver} />
                  <Text variant="muted">Add your weight to start tracking</Text>
                </Box>
              )}
            </Box>
          </TouchableOpacity>

          {/* Macro Split */}
          <Box
            backgroundColor="card"
            borderColor="border"
            borderWidth={1}
            borderRadius="m"
            padding="m"
            marginBottom="m"
          >
            <Text variant="cardTitle" marginBottom="s">Macro Split (7-day avg)</Text>
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
          </Box>

          {/* View All Nutrients link */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setShowMicros(true)}
            style={{
              backgroundColor: C.white,
              borderWidth: 1,
              borderColor: C.border,
              borderRadius: 8,
              padding: 16,
              marginBottom: 4,
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Text variant="body" style={{ color: C.textMuted }}>Nutrition Breakdown</Text>
            <Feather name="chevron-right" size={18} color={C.textDim} />
          </TouchableOpacity>

          {/* ═══════════════════════════════════════════════════════════
              SECTION 3 — ACHIEVEMENTS
             ═══════════════════════════════════════════════════════════ */}
          <SectionHeader title="Achievements" />

          {/* Badges */}
          <Box marginBottom="m">
            {earnedBadges.length > 0 ? (
              <>
                {/* Unlocked badges — prominent */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 16, paddingBottom: 4 }}
                >
                  {earnedBadges.map((b) => (
                    <StreakBadge key={b.id} badge={b} size="large" />
                  ))}
                </ScrollView>

                {/* Locked badges — collapsed */}
                {lockedBadges.length > 0 && (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => setShowAllBadges(!showAllBadges)}
                    style={{ marginTop: 14 }}
                  >
                    <Text
                      variant="muted"
                      style={{ color: C.maroon, fontFamily: 'DMSans_600SemiBold' }}
                    >
                      {lockedBadges.length} more to earn{' '}
                      <Text variant="muted" style={{ color: C.maroon }}>
                        {showAllBadges ? '· Hide' : '· See All'}
                      </Text>
                    </Text>
                  </TouchableOpacity>
                )}
                {showAllBadges && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 12, paddingBottom: 4, marginTop: 12 }}
                  >
                    {lockedBadges.map((b) => (
                      <StreakBadge key={b.id} badge={b} size="small" />
                    ))}
                  </ScrollView>
                )}
              </>
            ) : (
              /* Zero unlocked — motivating card */
              <Box
                backgroundColor="card"
                borderColor="border"
                borderWidth={1}
                borderRadius="m"
                padding="m"
                style={{ alignItems: 'center', paddingVertical: 24 }}
              >
                <Feather name="award" size={32} color={C.gold} />
                <Text
                  variant="cardTitle"
                  style={{ marginTop: 12, textAlign: 'center' }}
                >
                  Your first badge is one day away
                </Text>
                <Text
                  variant="muted"
                  style={{ marginTop: 6, textAlign: 'center' }}
                >
                  Log meals tomorrow to earn Getting Started
                </Text>

                {/* Still allow peeking at locked badges */}
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setShowAllBadges(!showAllBadges)}
                  style={{ marginTop: 14 }}
                >
                  <Text
                    variant="muted"
                    style={{ color: C.maroon, fontFamily: 'DMSans_600SemiBold' }}
                  >
                    {showAllBadges ? 'Hide badges' : `${lockedBadges.length} badges to earn · See All`}
                  </Text>
                </TouchableOpacity>
                {showAllBadges && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 12, paddingBottom: 4, marginTop: 12 }}
                  >
                    {lockedBadges.map((b) => (
                      <StreakBadge key={b.id} badge={b} size="small" />
                    ))}
                  </ScrollView>
                )}
              </Box>
            )}
          </Box>

          {/* Weekly Report link */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setWeeklyReportVisible(true)}
            style={{
              backgroundColor: C.white,
              borderWidth: 1,
              borderColor: C.border,
              borderRadius: 8,
              padding: 16,
              marginBottom: 16,
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Box>
              <Text variant="cardTitle">Weekly Report</Text>
              <Text variant="muted">Your week in review</Text>
            </Box>
            <Feather name="chevron-right" size={18} color={C.textDim} />
          </TouchableOpacity>

          {/* Share button */}
          <TouchableOpacity
            activeOpacity={0.7}
            disabled={sharing}
            onPress={async () => {
              if (!shareCardRef.current) return;
              setSharing(true);
              try {
                const uri = await captureRef(shareCardRef, { format: 'png', quality: 0.9 });
                await Sharing.shareAsync(uri);
                triggerHaptic('light');
              } catch (e) {
                if (__DEV__) console.error('Share error:', e);
              } finally {
                setSharing(false);
              }
            }}
            style={{
              borderWidth: 1,
              borderColor: C.maroon,
              borderRadius: 6,
              padding: 16,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              backgroundColor: 'transparent',
              opacity: sharing ? 0.6 : 1,
            }}
          >
            <Feather name="share" size={16} color={C.maroon} style={{ marginRight: 8 }} />
            <Text
              style={{
                color: C.maroon,
                fontSize: 15,
                fontFamily: 'DMSans_700Bold',
              }}
            >
              Tell a Friend
            </Text>
          </TouchableOpacity>

        </StaggeredList>
      </ScrollView>

      {/* ─── Weight Log Modal ─────────────────────────────────────── */}
      <Modal
        visible={showWeightModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowWeightModal(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: C.offWhite }}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            {/* Modal header */}
            <Box
              flexDirection="row"
              justifyContent="space-between"
              alignItems="center"
              padding="m"
              style={{ borderBottomWidth: 1, borderBottomColor: C.borderLight }}
            >
              <Text variant="pageTitle">Log Weight</Text>
              <TouchableOpacity
                onPress={() => setShowWeightModal(false)}
                accessibilityLabel="Close weight log"
                accessibilityRole="button"
                style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'center' }}
              >
                <Feather name="x" size={24} color={C.text} />
              </TouchableOpacity>
            </Box>

            <Box padding="m" style={{ gap: 16 }}>
              <Text variant="muted">
                {lastWeight ? `Last logged: ${lastWeight} lbs` : 'Add your weight to start tracking'}
              </Text>

              <TextInput
                style={{
                  backgroundColor: C.inputBg,
                  borderRadius: 10,
                  padding: 16,
                  fontSize: 18,
                  fontFamily: 'DMSans_400Regular',
                  color: C.text,
                }}
                placeholder="Enter weight"
                placeholderTextColor={C.textDim}
                value={weightInput}
                onChangeText={setWeightInput}
                keyboardType="numeric"
                autoFocus
              />

              <TouchableOpacity
                onPress={logWeight}
                disabled={savingWeight || !weightInput}
                activeOpacity={0.7}
                style={{
                  backgroundColor: C.maroon,
                  borderRadius: 10,
                  paddingVertical: 16,
                  alignItems: 'center',
                  opacity: (savingWeight || !weightInput) ? 0.5 : 1,
                }}
              >
                <Text
                  style={{
                    color: '#fff',
                    fontSize: 16,
                    fontFamily: 'DMSans_700Bold',
                  }}
                >
                  {savingWeight ? 'Saving...' : 'Save Weight'}
                </Text>
              </TouchableOpacity>
            </Box>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

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
        gradeColor={dailyScore?.gradeColor ?? C.textDim}
        streak={streakData?.currentStreak ?? 0}
        score={dailyScore?.score ?? 0}
      />
    </SafeAreaView>
  );
}
