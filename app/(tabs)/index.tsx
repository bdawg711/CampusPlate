import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';

// Restyle primitives
import { Box, Text } from '@/src/theme/restyleTheme';

// Sprint 5 components
import SpiralRings from '@/src/components/SpiralRings';
import MacroLegend from '@/src/components/MacroLegend';
import DashboardStatsRow from '@/src/components/DashboardStatsRow';
import WaterTracker from '@/src/components/WaterTracker';
import ForYouSection, { ForYouSubSection } from '@/src/components/ForYouSection';
import MealLogSection from '@/src/components/MealLogSection';
import StaggeredList from '@/src/components/StaggeredList';
import Confetti from '@/src/components/Confetti';
import GoalHitBanner from '@/src/components/GoalHitBanner';
import Skeleton from '@/src/components/Skeleton';
import ErrorState from '@/src/components/ErrorState';

// Data utilities
import { requireUserId } from '@/src/utils/auth';
import { supabase } from '@/src/utils/supabase';
import { getStreakData, StreakData } from '@/src/utils/streaks';
import { calculateDailyScore } from '@/src/utils/dailyScore';
import { logBelongsToMealGroup, getCurrentMealPeriod, getEffectiveMenuDate } from '@/src/utils/meals';
import { getTodayWater, addWater, getWaterGoal } from '@/src/utils/water';
import { getAllHallStatuses } from '@/src/utils/hours';
import { triggerHaptic } from '@/src/utils/haptics';
import {
  getFavoritesToday,
  getFitsYourMacros,
  getTopRatedHalls,
  getTrySomethingNew,
  getQuickAndLight,
  RecommendedItem,
  TopRatedHallItem,
} from '@/src/utils/recommendations';
import { FavoriteMenuItem } from '@/src/utils/favorites';
import HistoryScreen from './history';

// ─── Helpers ────────────────────────────────────────────────────────────────

function getLocalDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface NutritionData {
  calories: number;
  protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
}

interface MealLog {
  id: string;
  servings: number;
  meal: string;
  created_at?: string;
  menu_items: {
    id?: number;
    name: string;
    station?: string;
    nutrition: NutritionData | NutritionData[] | null;
  } | null;
}

interface Profile {
  name: string;
  goal_calories: number;
  goal_protein_g: number;
  goal_carbs_g: number;
  goal_fat_g: number;
}

interface OpenHall {
  id: number;
  name: string;
  currentMeal: string;
  closingTime: string;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [logs, setLogs] = useState<MealLog[]>([]);
  const [forYouFavs, setForYouFavs] = useState<FavoriteMenuItem[]>([]);
  const [forYouMacros, setForYouMacros] = useState<RecommendedItem[]>([]);
  const [forYouTopHalls, setForYouTopHalls] = useState<TopRatedHallItem[]>([]);
  const [forYouNew, setForYouNew] = useState<RecommendedItem[]>([]);
  const [forYouLight, setForYouLight] = useState<RecommendedItem[]>([]);
  const [hallNames, setHallNames] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [waterOz, setWaterOz] = useState<number>(0);
  const [waterGoal, setWaterGoal] = useState<number>(64);
  const [openHalls, setOpenHalls] = useState<OpenHall[]>([]);
  const [forYouLoading, setForYouLoading] = useState(true);
  const [streakData, setStreakData] = useState<StreakData | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // ─── Celebration state ───
  const [showConfetti, setShowConfetti] = useState(false);
  const [bannerVisible, setBannerVisible] = useState(false);
  const [bannerMessage, setBannerMessage] = useState('');
  const [bannerColor, setBannerColor] = useState<string | undefined>(undefined);
  const [bannerVariant, setBannerVariant] = useState<'goal' | 'streak' | 'water' | undefined>(undefined);

  // ─── Celebration refs ───
  const calorieGoalCelebrated = useRef(false);
  const waterGoalCelebrated = useRef(false);
  const lastCelebratedMilestone = useRef(0);
  const currentDateRef = useRef(getLocalDate());

  // Key to force SpiralRings remount on refresh (re-triggers fill animation)
  const [ringsKey, setRingsKey] = useState(0);

  // Track previous log count to detect new meal logs (for success haptic)
  const prevLogCount = useRef(0);

  // 300ms delay before showing skeletons (prevent flash on fast loads)
  useEffect(() => {
    if (!loading) { setShowSkeleton(false); return; }
    const timer = setTimeout(() => setShowSkeleton(true), 300);
    return () => clearTimeout(timer);
  }, [loading]);

  // Restore cached dashboard data + streak milestone on mount
  useEffect(() => {
    AsyncStorage.getItem('lastStreakMilestone').then((val) => {
      if (val) lastCelebratedMilestone.current = parseInt(val, 10) || 0;
    });
    // Restore cached dashboard snapshot for instant display
    AsyncStorage.getItem('dashboardCache').then((raw) => {
      if (!raw) return;
      try {
        const cached = JSON.parse(raw);
        const today = getLocalDate();
        if (cached.date !== today) return; // stale cache from different day
        if (cached.profile) setProfile(cached.profile);
        if (cached.logs) setLogs(cached.logs);
        if (cached.waterOz != null) setWaterOz(cached.waterOz);
        if (cached.waterGoal != null) setWaterGoal(cached.waterGoal);
        if (cached.streakData) setStreakData(cached.streakData);
        setLoading(false); // show cached data immediately
      } catch { /* ignore corrupt cache */ }
    });
  }, []);

  // ─── Data loading (preserved from Sprint 4) ───

  const loadOpenHalls = async (): Promise<OpenHall[]> => {
    try {
      const today = getLocalDate();
      const { count: hoursCount } = await supabase
        .from('dining_hall_hours')
        .select('id', { count: 'exact', head: true })
        .eq('date', today);

      let statusDate = new Date();
      if (!hoursCount || hoursCount === 0) {
        statusDate = new Date();
        statusDate.setDate(statusDate.getDate() - 1);
      }

      const [statuses, hallsRes] = await Promise.all([
        getAllHallStatuses(statusDate),
        supabase.from('dining_halls').select('id, name').order('name'),
      ]);

      if (hallsRes.error || !hallsRes.data) return [];

      const names: Record<number, string> = {};
      for (const h of hallsRes.data) {
        names[h.id] = h.name;
      }

      const open: OpenHall[] = [];
      for (const [idStr, status] of Object.entries(statuses)) {
        if (status.isOpen) {
          open.push({
            id: Number(idStr),
            name: names[Number(idStr)] || 'Unknown',
            currentMeal: status.currentMeal || '',
            closingTime: status.closingTime || '',
          });
        }
      }
      return open;
    } catch {
      return [];
    }
  };

  const loadForYou = async (userId: string, today: string): Promise<void> => {
    setForYouLoading(true);
    const mealPeriod = getCurrentMealPeriod();
    try {
      const [favs, macros, topHalls, newItems, lightItems, hallsRes] = await Promise.all([
        getFavoritesToday(userId, today).catch(() => [] as FavoriteMenuItem[]),
        getFitsYourMacros(userId, today, mealPeriod).catch(() => [] as RecommendedItem[]),
        getTopRatedHalls().catch(() => [] as TopRatedHallItem[]),
        getTrySomethingNew(userId, today).catch(() => [] as RecommendedItem[]),
        getQuickAndLight(today).catch(() => [] as RecommendedItem[]),
        supabase.from('dining_halls').select('id, name'),
      ]);

      const names: Record<number, string> = {};
      for (const h of hallsRes.data ?? []) {
        names[h.id] = h.name;
      }
      setHallNames(names);
      setForYouFavs(favs);
      setForYouMacros(macros);
      setForYouTopHalls(topHalls);
      setForYouNew(newItems);
      setForYouLight(lightItems);
    } catch {
      // Non-critical — For You sections just won't show
    } finally {
      setForYouLoading(false);
    }
  };

  const loadData = useCallback(async () => {
    setLoadError(false);
    try {
      const userId = await requireUserId();
      const today = getLocalDate();
      const menuDate = await getEffectiveMenuDate();

      const [profileRes, logsRes, , waterCount, waterGoalRes, hallStatusMap, streakResult] = await Promise.all([
        supabase.from('profiles').select('name, goal_calories, goal_protein_g, goal_carbs_g, goal_fat_g').eq('id', userId).single(),
        supabase
          .from('meal_logs')
          .select('id, servings, meal, created_at, menu_items(id, name, station, nutrition(calories, protein_g, total_carbs_g, total_fat_g))')
          .eq('user_id', userId)
          .eq('date', today)
          .order('created_at', { ascending: true }),
        loadForYou(userId, menuDate),
        getTodayWater(userId),
        getWaterGoal(userId),
        loadOpenHalls(),
        getStreakData(userId),
      ]);

      if (profileRes.data) setProfile(profileRes.data as any);
      if (logsRes.data) setLogs(logsRes.data as any);
      setWaterOz(waterCount);
      setWaterGoal(waterGoalRes);
      if (hallStatusMap) setOpenHalls(hallStatusMap);
      if (streakResult) setStreakData(streakResult);

      // Save dashboard snapshot to AsyncStorage for instant next load
      try {
        await AsyncStorage.setItem('dashboardCache', JSON.stringify({
          date: today,
          profile: profileRes.data,
          logs: logsRes.data,
          waterOz: waterCount,
          waterGoal: waterGoalRes,
          streakData: streakResult,
        }));
      } catch { /* non-critical */ }

      // Reset celebration refs on date change
      if (today !== currentDateRef.current) {
        calorieGoalCelebrated.current = false;
        waterGoalCelebrated.current = false;
        currentDateRef.current = today;
      }

      // Streak milestone celebration
      if (streakResult) {
        const MILESTONES = [7, 14, 30, 60, 100];
        if (MILESTONES.includes(streakResult.currentStreak) && streakResult.currentStreak > lastCelebratedMilestone.current) {
          setShowConfetti(true);
          setBannerMessage(`${streakResult.currentStreak}-day streak! Amazing!`);
          setBannerVariant('streak');
          setBannerColor(undefined);
          setBannerVisible(true);
          lastCelebratedMilestone.current = streakResult.currentStreak;
          AsyncStorage.setItem('lastStreakMilestone', String(streakResult.currentStreak));
        }
      }
    } catch (e) {
      if (__DEV__) console.error('Dashboard load error:', e);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    setRingsKey((k) => k + 1);
    await loadData();
    setRefreshing(false);
  };

  const deleteLog = async (logId: string) => {
    try {
      const userId = await requireUserId();
      const { error } = await supabase.from('meal_logs').delete().eq('id', logId).eq('user_id', userId);
      if (error) { if (__DEV__) console.error('Delete failed:', error.message); Alert.alert('Error', 'Failed to delete. Please try again.'); return; }
      setLogs((prev) => prev.filter((l) => l.id !== logId));
    } catch (e) {
      if (__DEV__) console.error('Delete error:', e);
    }
  };

  const handleAddWater = async (oz: number) => {
    try {
      const userId = await requireUserId();
      const newTotal = await addWater(userId, oz);
      setWaterOz(newTotal);
      if (newTotal >= waterGoal && !waterGoalCelebrated.current) {
        waterGoalCelebrated.current = true;
        setBannerMessage('Hydration goal hit!');
        setBannerVariant('water');
        setBannerColor('#4A7FC5');
        setBannerVisible(true);
      }
    } catch (error) {
      if (__DEV__) console.error('Failed to add water:', error);
    }
  };

  // ─── Computed values ───

  const getNutrition = (log: MealLog) => {
    const raw = log.menu_items?.nutrition;
    const n = Array.isArray(raw) ? raw[0] : raw;
    const cal = n?.calories || 0;
    const pro = n?.protein_g || 0;
    const carb = n?.total_carbs_g || 0;
    const fat = n?.total_fat_g || 0;
    const s = log.servings || 1;
    return { cal: Math.round(cal * s), pro: Math.round(pro * s), carb: Math.round(carb * s), fat: Math.round(fat * s) };
  };

  const totalCal = logs.reduce((sum, l) => sum + getNutrition(l).cal, 0);
  const totalPro = logs.reduce((sum, l) => sum + getNutrition(l).pro, 0);
  const totalCarb = logs.reduce((sum, l) => sum + getNutrition(l).carb, 0);
  const totalFat = logs.reduce((sum, l) => sum + getNutrition(l).fat, 0);

  const goalCal = profile?.goal_calories || 2000;
  const goalPro = profile?.goal_protein_g || 150;
  const goalCarb = profile?.goal_carbs_g || 200;
  const goalFat = profile?.goal_fat_g || 65;

  const dailyScore = calculateDailyScore(
    { calories: totalCal, protein: totalPro, carbs: totalCarb, fat: totalFat },
    { calories: goalCal, protein: goalPro, carbs: goalCarb, fat: goalFat },
    logs.length,
    waterOz,
    waterGoal
  );

  // ─── Meal logging success animation ───
  // Fires haptic + celebration when new logs detected (returning from Browse)
  useEffect(() => {
    if (loading || logs.length === 0) return;

    if (__DEV__) console.log('[GoalCheck] logs:', logs.length, 'prev:', prevLogCount.current, 'totalCal:', totalCal, 'goal:', goalCal, 'celebrated:', calorieGoalCelebrated.current);

    // Detect new meal log (count increased)
    if (logs.length > prevLogCount.current && prevLogCount.current > 0) {
      // Haptic success on new meal logged
      triggerHaptic('success');

      // Check calorie goal for celebration
      if (totalCal >= goalCal && !calorieGoalCelebrated.current) {
        if (__DEV__) console.log('[GoalCheck] Calorie goal hit! Firing celebration.');
        calorieGoalCelebrated.current = true;
        setShowConfetti(true);
        setBannerMessage('Calorie goal crushed!');
        setBannerVariant('goal');
        setBannerColor(undefined);
        setBannerVisible(true);
        triggerHaptic('success');
      }
    } else if (prevLogCount.current === 0) {
      // First load — check calorie goal without extra haptic
      if (totalCal >= goalCal && !calorieGoalCelebrated.current) {
        if (__DEV__) console.log('[GoalCheck] First load calorie goal already hit.');
        calorieGoalCelebrated.current = true;
        setShowConfetti(true);
        setBannerMessage('Calorie goal crushed!');
        setBannerVariant('goal');
        setBannerColor(undefined);
        setBannerVisible(true);
        triggerHaptic('success');
      }
    }

    prevLogCount.current = logs.length;
  }, [logs, loading, totalCal, goalCal]);

  // ─── Build ForYou sections ───

  // Priority order: Fits Your Macros > Your Favorites > Try Something New > Quick & Light
  const forYouSections: ForYouSubSection[] = [
    {
      title: 'Fits Your Macros',
      iconName: 'target',
      items: forYouMacros.map((i) => ({
        id: i.id,
        name: i.name,
        calories: i.calories,
        hallName: i.hall_name,
      })),
      filter: 'macros',
    },
    {
      title: 'Your Favorites Today',
      iconName: 'heart',
      items: forYouFavs.map((f) => ({
        id: f.id,
        name: f.name,
        calories: f.nutrition?.calories ?? 0,
        hallName: hallNames[f.dining_hall_id] ?? '',
      })),
      filter: 'favorites',
    },
    {
      title: 'Try Something New',
      iconName: 'zap',
      items: forYouNew.map((i) => ({
        id: i.id,
        name: i.name,
        calories: i.calories,
        hallName: i.hall_name,
      })),
      filter: 'new',
    },
    {
      title: 'Quick & Light',
      iconName: 'feather',
      items: forYouLight.map((i) => ({
        id: i.id,
        name: i.name,
        calories: i.calories,
        hallName: i.hall_name,
      })),
      filter: 'light',
    },
  ];

  // ─── Loading skeleton ───

  if (loading && showSkeleton) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FAFAFA' }}>
        <Box padding="m" paddingBottom="xxl">
          <Box flexDirection="row" justifyContent="space-between" alignItems="center" marginBottom="m">
            <Box>
              <Skeleton width={100} height={14} borderRadius={7} />
              <Skeleton width={160} height={28} borderRadius={8} style={{ marginTop: 6 }} />
            </Box>
            <Skeleton width={40} height={40} borderRadius={9999} />
          </Box>
          <Box alignItems="center" marginBottom="m">
            <Skeleton width={280} height={280} borderRadius={140} />
          </Box>
          <Box flexDirection="row" justifyContent="space-between" marginBottom="s">
            <Skeleton width={70} height={12} borderRadius={6} />
            <Skeleton width={70} height={12} borderRadius={6} />
            <Skeleton width={70} height={12} borderRadius={6} />
            <Skeleton width={70} height={12} borderRadius={6} />
          </Box>
          <Box marginTop="l">
            <Skeleton width={120} height={12} borderRadius={6} />
            <Skeleton width={'100%' as any} height={44} borderRadius={8} style={{ marginTop: 12 }} />
            <Skeleton width={'100%' as any} height={44} borderRadius={8} style={{ marginTop: 8 }} />
          </Box>
        </Box>
      </SafeAreaView>
    );
  }

  // Still loading but within 300ms window — show nothing (prevents skeleton flash)
  if (loading) {
    return <SafeAreaView style={{ flex: 1, backgroundColor: '#FAFAFA' }} />;
  }

  // Error state — show retry card
  if (loadError && !profile) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FAFAFA' }}>
        <Box flex={1} justifyContent="center">
          <ErrorState
            message="Couldn't load your dashboard. Check your connection and try again."
            onRetry={loadData}
          />
        </Box>
      </SafeAreaView>
    );
  }

  // ─── Main render ───

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FAFAFA' }}>
      <Confetti visible={showConfetti} onComplete={() => setShowConfetti(false)} />
      <GoalHitBanner
        visible={bannerVisible}
        message={bannerMessage}
        variant={bannerVariant}
        color={bannerColor}
        onDismiss={() => setBannerVisible(false)}
      />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#861F41" />
        }
      >
        {/* 1. Greeting + Avatar row — compact, single line feel */}
        <Box flexDirection="row" justifyContent="space-between" alignItems="center" marginBottom="s">
          <Box>
            <Text variant="muted">{getGreeting()}</Text>
            <Text variant="pageTitle">{profile?.name || 'there'}</Text>
          </Box>
          <Box
            width={40}
            height={40}
            borderRadius="full"
            alignItems="center"
            justifyContent="center"
            style={{ backgroundColor: '#861F41' }}
          >
            <Text variant="body" style={{ color: '#FFFFFF', fontFamily: 'DMSans_700Bold', fontSize: 16 }}>
              {profile?.name?.charAt(0)?.toUpperCase() || '?'}
            </Text>
          </Box>
        </Box>

        {/* 2. SpiralRings hero (has its own animation — NOT in StaggeredList) */}
        <Box alignItems="center" style={{ paddingTop: 16 }} marginBottom="s">
          <SpiralRings
            key={ringsKey}
            size={300}
            calories={{ current: totalCal, goal: goalCal }}
            protein={{ current: totalPro, goal: goalPro }}
            carbs={{ current: totalCarb, goal: goalCarb }}
            fat={{ current: totalFat, goal: goalFat }}
          />
        </Box>

        {/* StaggeredList wraps MacroLegend downward */}
        <StaggeredList staggerDelay={50} initialDelay={200}>
          {/* 3. MacroLegend — 40px space below creates visual chapter break */}
          <Box style={{ marginBottom: 40 }}>
            <MacroLegend
              calories={{ current: totalCal, goal: goalCal }}
              protein={{ current: totalPro, goal: goalPro }}
              carbs={{ current: totalCarb, goal: goalCarb }}
              fat={{ current: totalFat, goal: goalFat }}
            />
          </Box>

          {/* 4. DashboardStatsRow — 24px gap below */}
          <Box style={{ marginBottom: 24 }}>
            <DashboardStatsRow
              streak={streakData?.currentStreak ?? 0}
              score={dailyScore.score}
              grade={dailyScore.grade}
              breakdown={dailyScore.breakdown}
            />
          </Box>

          {/* 5. WaterTracker — 40px gap + divider below before For You */}
          <Box style={{ marginBottom: 40 }}>
            <WaterTracker
              waterOz={waterOz}
              waterGoal={waterGoal}
              onAddWater={handleAddWater}
            />
          </Box>

          {/* Divider between WaterTracker and For You */}
          <Box style={{ height: 1, backgroundColor: '#E5E5E5', marginHorizontal: -4, marginBottom: 24 }} />

          {/* 6. ForYouSection — 40px gap + divider below before Today's Meals */}
          <Box style={{ marginBottom: 40 }}>
            {forYouLoading ? (
              <Box>
                <Text variant="cardTitle" marginBottom="m">For You</Text>
                {[0, 1, 2].map((rowIdx) => (
                  <Box key={rowIdx} marginBottom="m">
                    <Skeleton width={130} height={15} borderRadius={7} style={{ marginBottom: 10 }} />
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {[0, 1, 2].map((i) => (
                        <Box
                          key={i}
                          width={140}
                          padding="m"
                          borderRadius="m"
                          backgroundColor="card"
                          borderColor="border"
                          borderWidth={1}
                          marginRight="s"
                        >
                          <Skeleton width={100} height={13} borderRadius={6} />
                          <Skeleton width={60} height={12} borderRadius={6} style={{ marginTop: 6 }} />
                          <Skeleton width={80} height={11} borderRadius={6} style={{ marginTop: 4 }} />
                        </Box>
                      ))}
                    </ScrollView>
                  </Box>
                ))}
              </Box>
            ) : (
              <ForYouSection
                sections={forYouSections}
                onSeeAll={(filter) => router.push({ pathname: '/(tabs)/browse', params: { filter } })}
                onItemPress={() => router.push('/(tabs)/browse')}
              />
            )}
          </Box>

          {/* Divider between For You and Today's Meals */}
          <Box style={{ height: 1, backgroundColor: '#E5E5E5', marginHorizontal: -4, marginBottom: 24 }} />

          {/* 7. MealLogSection */}
          <Box marginBottom="xxl">
            <MealLogSection
              logs={logs}
              onHistoryPress={() => setShowHistory(true)}
              onDeleteLog={deleteLog}
              logBelongsToMealGroup={logBelongsToMealGroup}
              onBrowseMeal={(meal) => router.push({ pathname: '/(tabs)/browse', params: { meal } })}
            />
          </Box>
        </StaggeredList>
      </ScrollView>

      {/* History Modal */}
      <Modal
        visible={showHistory}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowHistory(false)}
      >
        <Box flex={1} backgroundColor="background">
          {/* Modal header */}
          <Box
            flexDirection="row"
            justifyContent="space-between"
            alignItems="center"
            paddingHorizontal="m"
            style={{ paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#E8E8EA' }}
          >
            <Text variant="pageTitle">History</Text>
            <TouchableOpacity
              onPress={() => setShowHistory(false)}
              accessibilityLabel="Close history"
              accessibilityRole="button"
              style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'center' }}
            >
              <Feather name="x" size={24} color="#1A1A1A" />
            </TouchableOpacity>
          </Box>
          <HistoryScreen />
        </Box>
      </Modal>
    </SafeAreaView>
  );
}
