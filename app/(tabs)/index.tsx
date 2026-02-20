import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/src/context/ThemeContext';
import { requireUserId } from '@/src/utils/auth';
import { supabase } from '@/src/utils/supabase';
import { getStreakData, StreakData } from '@/src/utils/streaks';
import { calculateDailyScore, DailyScore } from '@/src/utils/dailyScore';
import DailyScoreCard from '@/src/components/DailyScoreCard';
import Confetti from '@/src/components/Confetti';
import GoalHitBanner from '@/src/components/GoalHitBanner';
import { logBelongsToMealGroup, getCurrentMealPeriod, getEffectiveMenuDate } from '@/src/utils/meals';
import { getTodayWater, addWater, getWaterGoal } from '@/src/utils/water';
import { getAllHallStatuses, HallStatus } from '@/src/utils/hours';
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
import { Feather } from '@expo/vector-icons';
import Skeleton from '@/src/components/Skeleton';
import HistoryScreen from './history';
import { useStaggerAnimation } from '@/src/hooks/useStaggerAnimation';

function getLocalDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDate(d = new Date()) {
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

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

// ─── Animated empty-state emoji bounce ───
function BouncingEmoji({ emoji }: { emoji: string }) {
  const bounce = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, { toValue: -6, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(bounce, { toValue: 0, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [bounce]);

  return (
    <Animated.Text style={{ fontSize: 24, transform: [{ translateY: bounce }] }}>
      {emoji}
    </Animated.Text>
  );
}

export default function HomeScreen() {
  const { colors } = useTheme();
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

  // ─── Celebration refs (prevent re-triggering) ───
  const calorieGoalCelebrated = useRef(false);
  const waterGoalCelebrated = useRef(false);
  const lastCelebratedMilestone = useRef(0);
  const currentDateRef = useRef(getLocalDate());

  // Load persisted streak milestone on mount
  useEffect(() => {
    AsyncStorage.getItem('lastStreakMilestone').then((val) => {
      if (val) lastCelebratedMilestone.current = parseInt(val, 10) || 0;
    });
  }, []);

  // ─── Entry stagger animations ───
  // 0: header, 1: multi-ring, 2: legend row, 3-4: unused, 5: collections, 6: meals
  const { anims: entryAnims, play: playEntry } = useStaggerAnimation(7, { staggerMs: 80, durationMs: 350, delayMs: 0 });

  // ─── Multi-ring fill animations (4 concentric rings) ───
  const calRingAnim = useRef(new Animated.Value(0)).current;
  const proRingAnim = useRef(new Animated.Value(0)).current;
  const carbRingAnim = useRef(new Animated.Value(0)).current;
  const fatRingAnim = useRef(new Animated.Value(0)).current;

  const loadOpenHalls = async (): Promise<OpenHall[]> => {
    try {
      const today = getLocalDate();
      const { count: hoursCount } = await supabase
        .from('dining_hall_hours')
        .select('id', { count: 'exact', head: true })
        .eq('date', today);

      // If no hours for today, use yesterday's schedule with current time
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

      const hallNames: Record<number, string> = {};
      for (const h of hallsRes.data) {
        hallNames[h.id] = h.name;
      }

      const open: OpenHall[] = [];
      for (const [idStr, status] of Object.entries(statuses)) {
        if (status.isOpen) {
          open.push({
            id: Number(idStr),
            name: hallNames[Number(idStr)] || 'Unknown',
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
          setBannerMessage(`🔥 ${streakResult.currentStreak}-day streak! Amazing!`);
          setBannerColor(undefined);
          setBannerVisible(true);
          lastCelebratedMilestone.current = streakResult.currentStreak;
          AsyncStorage.setItem('lastStreakMilestone', String(streakResult.currentStreak));
        }
      }
    } catch (e) {
      console.error('Dashboard load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // ─── Animate multi-ring fills when data changes ───
  useEffect(() => {
    if (loading) return;

    const calPercent = Math.min(totalCal / goalCal, 1);
    const proPercent = Math.min(totalPro / goalPro, 1);
    const carbPercent = Math.min(totalCarb / goalCarb, 1);
    const fatPercent = Math.min(totalFat / goalFat, 1);

    Animated.parallel([
      Animated.timing(calRingAnim, { toValue: calPercent, duration: 800, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      Animated.timing(proRingAnim, { toValue: proPercent, duration: 800, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      Animated.timing(carbRingAnim, { toValue: carbPercent, duration: 800, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      Animated.timing(fatRingAnim, { toValue: fatPercent, duration: 800, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
    ]).start();

    // Play entry stagger on first load
    playEntry();
  }, [loading, logs]);

  // ─── Calorie goal celebration ───
  useEffect(() => {
    if (loading || !profile || logs.length === 0) return;
    const goal = profile.goal_calories || 2000;
    if (totalCal >= goal && !calorieGoalCelebrated.current) {
      calorieGoalCelebrated.current = true;
      setShowConfetti(true);
      setBannerMessage('Daily calorie goal reached! 🎯');
      setBannerColor(undefined);
      setBannerVisible(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [logs]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const deleteLog = async (logId: string) => {
    try {
      const userId = await requireUserId();
      const { error } = await supabase.from('meal_logs').delete().eq('id', logId).eq('user_id', userId);
      if (error) { console.error('Delete failed:', error.message); Alert.alert('Error', 'Failed to delete. Please try again.'); return; }
      setLogs((prev) => prev.filter((l) => l.id !== logId));
    } catch (e) {
      console.error('Delete error:', e);
    }
  };

  const handleAddWater = async (oz: number) => {
    try {
      const userId = await requireUserId();
      const newTotal = await addWater(userId, oz);
      setWaterOz(newTotal);
      // Water goal celebration
      if (newTotal >= waterGoal && !waterGoalCelebrated.current) {
        waterGoalCelebrated.current = true;
        setBannerMessage('Hydration goal hit! 💧');
        setBannerColor(colors.blue);
        setBannerVisible(true);
      }
    } catch (error) {
      console.error('Failed to add water:', error);
    }
  };

  // Calculate totals from logs
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

  // Daily score
  const dailyScore = calculateDailyScore(
    { calories: totalCal, protein: totalPro, carbs: totalCarb, fat: totalFat },
    { calories: goalCal, protein: goalPro, carbs: goalCarb, fat: goalFat },
    logs.length,
    waterOz,
    waterGoal
  );

  // Multi-ring SVG setup (Apple Watch style)
  const ringSize = 180;
  const ringStroke = 8;
  const ringGap = 6;
  // Radii: outer→inner: calories, protein, carbs, fat
  const calRadius = (ringSize - ringStroke) / 2; // 86
  const proRadius = calRadius - ringStroke - ringGap; // 72
  const carbRadius = proRadius - ringStroke - ringGap; // 58
  const fatRadius = carbRadius - ringStroke - ringGap; // 44

  const calCircum = 2 * Math.PI * calRadius;
  const proCircum = 2 * Math.PI * proRadius;
  const carbCircum = 2 * Math.PI * carbRadius;
  const fatCircum = 2 * Math.PI * fatRadius;

  // Animated strokeDashoffsets for each ring
  const calDashOffset = calRingAnim.interpolate({ inputRange: [0, 1], outputRange: [calCircum, 0] });
  const proDashOffset = proRingAnim.interpolate({ inputRange: [0, 1], outputRange: [proCircum, 0] });
  const carbDashOffset = carbRingAnim.interpolate({ inputRange: [0, 1], outputRange: [carbCircum, 0] });
  const fatDashOffset = fatRingAnim.interpolate({ inputRange: [0, 1], outputRange: [fatCircum, 0] });

  const getMealName = (log: MealLog): string => {
    const mi = log.menu_items as any;
    if (typeof mi === 'string') return mi;
    if (mi?.name) return mi.name;
    return 'Unknown item';
  };

  const renderMealGroup = (meal: string, label: string) => {
    const mealLogs = logs.filter((l) => logBelongsToMealGroup(l.meal, meal));
    const mealCals = mealLogs.reduce((sum, l) => sum + getNutrition(l).cal, 0);
    return (
      <View key={meal} style={{ marginBottom: 20 }}>
        <Text style={[st.mealHeader, { color: colors.textDim, fontFamily: 'DMSans_600SemiBold' }]}>
          {label} — {mealCals} cal
        </Text>
        {mealLogs.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 16 }}>
            <BouncingEmoji emoji="🍽️" />
            <Text style={[{ fontSize: 13, color: colors.textMuted, marginTop: 4, fontFamily: 'DMSans_400Regular' }]}>
              No {label.toLowerCase()} logged yet
            </Text>
          </View>
        ) : (
          mealLogs.map((log, i) => {
            const n = getNutrition(log);
            return (
              <View key={log.id}>
                <View style={st.logRow}>
                  <Text style={[st.logName, { color: colors.text, fontFamily: 'DMSans_500Medium' }]} numberOfLines={1}>
                    {getMealName(log)}
                  </Text>
                  <Text style={[st.logCal, { color: colors.textMuted, fontFamily: 'DMSans_400Regular' }]}>
                    {n.cal} cal
                  </Text>
                  <TouchableOpacity onPress={() => deleteLog(log.id)} style={st.deleteBtn}>
                    <Feather name="x" size={16} color={colors.textDim} />
                  </TouchableOpacity>
                </View>
                {i < mealLogs.length - 1 && <View style={[st.divider, { backgroundColor: colors.cardGlassBorder }]} />}
              </View>
            );
          })
        )}
      </View>
    );
  };

  const hasForYouItems = forYouFavs.length > 0 || forYouMacros.length > 0 || forYouTopHalls.length > 0 || forYouNew.length > 0 || forYouLight.length > 0;
  const hasForYou = forYouLoading || hasForYouItems;

  const renderForYouSkeletonRow = () => (
    <View style={{ marginBottom: 16 }}>
      <Skeleton width={130} height={15} borderRadius={7} style={{ marginBottom: 10 }} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 20 }}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={[st.forYouCard, { backgroundColor: colors.cardGlass, borderColor: colors.cardGlassBorder, borderWidth: 1 }]}>
            <Skeleton width={100} height={13} borderRadius={6} />
            <Skeleton width={60} height={12} borderRadius={6} style={{ marginTop: 6 }} />
            <Skeleton width={80} height={11} borderRadius={6} style={{ marginTop: 4 }} />
          </View>
        ))}
      </ScrollView>
    </View>
  );

  const renderForYouItemRow = (title: string, iconName: string, items: { id: number; name: string; calories: number; hallName: string }[], filter?: string) => {
    if (items.length === 0) return null;
    return (
      <View style={{ marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <Text style={[st.forYouSubtitle, { color: colors.text, fontFamily: 'DMSans_600SemiBold', marginBottom: 0 }]}>{title}</Text>
          {filter && (
            <TouchableOpacity
              onPress={() => router.push({ pathname: '/(tabs)/browse', params: { filter } })}
              activeOpacity={0.7}
            >
              <Text style={[{ fontSize: 13, color: colors.maroon, fontFamily: 'DMSans_600SemiBold' }]}>See All →</Text>
            </TouchableOpacity>
          )}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 20 }}>
          {items.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[st.forYouCard, { backgroundColor: colors.cardGlass, borderColor: colors.cardGlassBorder, borderWidth: 1 }]}
              onPress={() => router.push({ pathname: '/(tabs)/browse', params: filter ? { filter } : {} })}
              activeOpacity={0.7}
            >
              <View style={{ position: 'absolute', top: 10, right: 10 }}>
                <Feather name={iconName as any} size={14} color={colors.textDim} />
              </View>
              <Text style={[st.forYouName, { color: colors.text, marginTop: 0 }]} numberOfLines={1}>{item.name}</Text>
              <Text style={[st.forYouDetail, { color: colors.textMuted }]}>{item.calories} cal</Text>
              {item.hallName ? <Text style={[st.forYouHall, { color: colors.textMuted }]} numberOfLines={1}>{item.hallName}</Text> : null}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  // ─── Loading skeleton ───
  if (loading) {
    return (
      <SafeAreaView style={[st.safe, { backgroundColor: colors.background }]}>
        <View style={st.scroll}>
          {/* Greeting skeleton */}
          <View style={st.header}>
            <View>
              <Skeleton width={100} height={14} borderRadius={7} />
              <Skeleton width={160} height={28} borderRadius={8} style={{ marginTop: 6 }} />
            </View>
            <Skeleton width={44} height={28} borderRadius={12} />
          </View>
          {/* Multi-ring skeleton */}
          <View style={{ alignItems: 'center', marginBottom: 20 }}>
            <Skeleton width={180} height={180} borderRadius={90} />
          </View>
          {/* Legend row skeleton */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Skeleton width={70} height={12} borderRadius={6} />
            <Skeleton width={70} height={12} borderRadius={6} />
            <Skeleton width={70} height={12} borderRadius={6} />
            <Skeleton width={70} height={12} borderRadius={6} />
          </View>
          {/* Meals skeleton */}
          <View style={{ marginTop: 28 }}>
            <Skeleton width={120} height={12} borderRadius={6} />
            <Skeleton width={'100%' as any} height={44} borderRadius={8} style={{ marginTop: 12 }} />
            <Skeleton width={'100%' as any} height={44} borderRadius={8} style={{ marginTop: 8 }} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const AnimatedCircleComponent = Animated.createAnimatedComponent(Circle);

  return (
    <SafeAreaView style={[st.safe, { backgroundColor: colors.background }]}>
      <Confetti visible={showConfetti} onComplete={() => setShowConfetti(false)} />
      <GoalHitBanner
        visible={bannerVisible}
        message={bannerMessage}
        color={bannerColor}
        onDismiss={() => setBannerVisible(false)}
      />
      <ScrollView
        contentContainerStyle={st.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.maroon} />}
      >
        {/* Header — fade in + slide down */}
        <Animated.View style={[st.header, {
          opacity: entryAnims[0],
          transform: [{ translateY: entryAnims[0].interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }],
        }]}>
          <View>
            <Text style={[st.greetingLabel, { color: colors.textMuted, fontFamily: 'DMSans_400Regular' }]}>
              {getGreeting()}
            </Text>
            <Text style={[st.greeting, { color: colors.text, fontFamily: 'Outfit_700Bold' }]}>
              {profile?.name || 'there'}
            </Text>
          </View>
          <View style={[st.gradePill, { backgroundColor: dailyScore.gradeColor + '26' }]}>
            <Text style={[st.gradePillText, { color: dailyScore.gradeColor, fontFamily: 'DMSans_700Bold' }]}>
              {dailyScore.grade}
            </Text>
          </View>
        </Animated.View>

        {/* Multi-Ring (Apple Watch style) — fade in + scale */}
        <Animated.View style={[st.ringWrap, {
          opacity: entryAnims[1],
          transform: [{ scale: entryAnims[1].interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }],
        }]}>
          <Svg width={ringSize} height={ringSize}>
            <Defs>
              <SvgLinearGradient id="calGradient" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={colors.maroon} />
                <Stop offset="1" stopColor="#C62368" />
              </SvgLinearGradient>
            </Defs>

            {/* Calories ring (outermost) */}
            <Circle cx={ringSize / 2} cy={ringSize / 2} r={calRadius} stroke="rgba(139,30,63,0.1)" strokeWidth={ringStroke} fill="none" />
            <AnimatedCircleComponent cx={ringSize / 2} cy={ringSize / 2} r={calRadius} stroke="url(#calGradient)" strokeWidth={ringStroke} fill="none" strokeDasharray={calCircum} strokeDashoffset={calDashOffset} strokeLinecap="round" transform={`rotate(-90 ${ringSize / 2} ${ringSize / 2})`} />

            {/* Protein ring */}
            <Circle cx={ringSize / 2} cy={ringSize / 2} r={proRadius} stroke="rgba(91,127,255,0.1)" strokeWidth={ringStroke} fill="none" />
            <AnimatedCircleComponent cx={ringSize / 2} cy={ringSize / 2} r={proRadius} stroke={colors.blue} strokeWidth={ringStroke} fill="none" strokeDasharray={proCircum} strokeDashoffset={proDashOffset} strokeLinecap="round" transform={`rotate(-90 ${ringSize / 2} ${ringSize / 2})`} />

            {/* Carbs ring */}
            <Circle cx={ringSize / 2} cy={ringSize / 2} r={carbRadius} stroke="rgba(232,119,34,0.1)" strokeWidth={ringStroke} fill="none" />
            <AnimatedCircleComponent cx={ringSize / 2} cy={ringSize / 2} r={carbRadius} stroke={colors.orange} strokeWidth={ringStroke} fill="none" strokeDasharray={carbCircum} strokeDashoffset={carbDashOffset} strokeLinecap="round" transform={`rotate(-90 ${ringSize / 2} ${ringSize / 2})`} />

            {/* Fat ring (innermost) */}
            <Circle cx={ringSize / 2} cy={ringSize / 2} r={fatRadius} stroke="rgba(255,214,10,0.1)" strokeWidth={ringStroke} fill="none" />
            <AnimatedCircleComponent cx={ringSize / 2} cy={ringSize / 2} r={fatRadius} stroke={colors.yellow} strokeWidth={ringStroke} fill="none" strokeDasharray={fatCircum} strokeDashoffset={fatDashOffset} strokeLinecap="round" transform={`rotate(-90 ${ringSize / 2} ${ringSize / 2})`} />
          </Svg>
          <View style={st.ringCenter}>
            <Text style={[st.ringNumber, { color: colors.text, fontFamily: 'Outfit_800ExtraBold' }]}>
              {totalCal.toLocaleString()}
            </Text>
            <Text style={[st.ringLabel, { color: colors.textMuted, fontFamily: 'DMSans_400Regular' }]}>
              of {goalCal.toLocaleString()} cal
            </Text>
          </View>
        </Animated.View>

        {/* Legend Row — replaces macro cards */}
        <Animated.View style={[st.legendRow, {
          opacity: entryAnims[2],
          transform: [{ translateY: entryAnims[2].interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
        }]}>
          <View style={st.legendItem}>
            <View style={[st.legendDot, { backgroundColor: colors.maroon }]} />
            <Text style={[st.legendText, { color: colors.textMuted }]}>{totalCal.toLocaleString()} / {goalCal.toLocaleString()}</Text>
          </View>
          <View style={st.legendItem}>
            <View style={[st.legendDot, { backgroundColor: colors.blue }]} />
            <Text style={[st.legendText, { color: colors.textMuted }]}>{totalPro} / {goalPro}g</Text>
          </View>
          <View style={st.legendItem}>
            <View style={[st.legendDot, { backgroundColor: colors.orange }]} />
            <Text style={[st.legendText, { color: colors.textMuted }]}>{totalCarb} / {goalCarb}g</Text>
          </View>
          <View style={st.legendItem}>
            <View style={[st.legendDot, { backgroundColor: colors.yellow }]} />
            <Text style={[st.legendText, { color: colors.textMuted }]}>{totalFat} / {goalFat}g</Text>
          </View>
        </Animated.View>

        {/* Streak + Score Cards — glass style */}
        <View style={st.streakScoreRow}>
          {/* LEFT — Streak */}
          <View style={[st.streakCard, { backgroundColor: colors.cardGlass, borderColor: colors.cardGlassBorder }]}>
            <Text style={[st.streakCardHeader, { color: colors.textDim }]}>CURRENT STREAK</Text>
            <Text style={[st.streakCardNumber, { color: colors.text, fontFamily: 'Outfit_800ExtraBold' }]}>
              {streakData?.currentStreak ?? 0}
            </Text>
            <Text style={[st.streakCardLabel, { color: colors.textMuted, fontFamily: 'DMSans_400Regular' }]}>days</Text>
            <View style={[st.streakCardAccent, { backgroundColor: colors.maroon }]} />
          </View>
          {/* RIGHT — Score */}
          <DailyScoreCard
            compact
            score={dailyScore.score}
            grade={dailyScore.grade}
            gradeColor={dailyScore.gradeColor}
            breakdown={dailyScore.breakdown}
          />
        </View>

        {/* Water — compact inline card */}
        <View style={[st.waterCard, { backgroundColor: colors.cardGlass, borderColor: colors.cardGlassBorder }]}>
          <Text style={[st.waterLabel, { color: colors.text, fontFamily: 'DMSans_500Medium' }]}>Water</Text>
          <View style={[st.waterBarTrack, { backgroundColor: colors.barTrack }]}>
            <View style={[st.waterBarFill, { backgroundColor: colors.blue, width: `${Math.min((waterOz / waterGoal) * 100, 100)}%` }]} />
          </View>
          <Text style={[st.waterAmount, { color: colors.text, fontFamily: 'DMSans_500Medium' }]}>
            {waterOz} / {waterGoal} oz
          </Text>
          <TouchableOpacity
            style={[st.waterPill, { borderColor: colors.cardGlassBorder }]}
            onPress={() => handleAddWater(8)}
            activeOpacity={0.7}
          >
            <Text style={[st.waterPillText, { color: colors.textMuted, fontFamily: 'DMSans_500Medium' }]}>+8 oz</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[st.waterPill, { borderColor: colors.cardGlassBorder }]}
            onPress={() => handleAddWater(16)}
            activeOpacity={0.7}
          >
            <Text style={[st.waterPillText, { color: colors.textMuted, fontFamily: 'DMSans_500Medium' }]}>+16 oz</Text>
          </TouchableOpacity>
        </View>

        {/* Open Now — glass cards, no emojis */}
        {openHalls.length > 0 && (
          <View style={{ marginTop: 24 }}>
            <View style={st.sectionHead}>
              <Text style={[st.sectionTitle, { color: colors.text, fontFamily: 'Outfit_700Bold' }]}>Open Now</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 20 }}>
              {openHalls.map((hall) => (
                <TouchableOpacity
                  key={hall.id}
                  style={[st.openHallCard, { backgroundColor: colors.cardGlass, borderColor: colors.cardGlassBorder }]}
                  onPress={() => router.push('/(tabs)/browse')}
                  activeOpacity={0.7}
                >
                  <Text style={[{ fontSize: 14, color: colors.text, fontFamily: 'DMSans_600SemiBold' }]} numberOfLines={1}>{hall.name}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.green }} />
                    <Text style={[{ fontSize: 12, color: colors.green, fontFamily: 'DMSans_500Medium' }]}>Open</Text>
                    <Text style={[{ fontSize: 12, color: colors.textDim }]}> · </Text>
                    <Feather name="star" size={10} color={colors.yellow} />
                    <Text style={[{ fontSize: 12, color: colors.textMuted, fontFamily: 'DMSans_400Regular' }]}>4.2</Text>
                  </View>
                  <Text style={[{ fontSize: 11, color: colors.textMuted, fontFamily: 'DMSans_400Regular', marginTop: 4 }]}>
                    {hall.currentMeal} · Closes {hall.closingTime}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* For You — dynamic collections */}
        {hasForYou && (
          <Animated.View style={[{ marginTop: 24 }, {
            opacity: entryAnims[5],
            transform: [{ translateY: entryAnims[5].interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
          }]}>
            <View style={st.sectionHead}>
              <Text style={[st.sectionTitle, { color: colors.text, fontFamily: 'Outfit_700Bold' }]}>For You</Text>
            </View>

            {forYouLoading ? (
              <>
                {renderForYouSkeletonRow()}
                {renderForYouSkeletonRow()}
                {renderForYouSkeletonRow()}
              </>
            ) : !hasForYouItems ? (
              <View style={[st.forYouEmptyCard, { backgroundColor: colors.cardGlass, borderColor: colors.cardGlassBorder }]}>
                <Text style={{ fontSize: 28 }}>🍽️</Text>
                <Text style={[{ fontSize: 14, color: colors.textMuted, fontFamily: 'DMSans_500Medium', marginTop: 8, textAlign: 'center' }]}>
                  Check back after logging a few meals
                </Text>
              </View>
            ) : (
              <>
                {renderForYouItemRow('Your Favorites Today', 'heart', forYouFavs.map((f) => ({
                  id: f.id, name: f.name, calories: f.nutrition?.calories ?? 0, hallName: hallNames[f.dining_hall_id] ?? '',
                })), 'favorites')}

                {renderForYouItemRow('Fits Your Macros', 'target', forYouMacros.map((i) => ({
                  id: i.id, name: i.name, calories: i.calories, hallName: i.hall_name,
                })), 'macros')}

                {forYouTopHalls.length > 0 && (
                  <View style={{ marginBottom: 16 }}>
                    <Text style={[st.forYouSubtitle, { color: colors.text, fontFamily: 'DMSans_600SemiBold' }]}>Top Rated Halls</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 20 }}>
                      {forYouTopHalls.map((hall) => (
                        <TouchableOpacity
                          key={hall.id}
                          style={[st.forYouCard, { backgroundColor: colors.cardGlass, borderColor: colors.cardGlassBorder, borderWidth: 1 }]}
                          onPress={() => router.push('/(tabs)/browse')}
                          activeOpacity={0.7}
                        >
                          <Text style={[st.forYouName, { color: colors.text, marginTop: 0 }]} numberOfLines={1}>{hall.name}</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                            <Feather name="star" size={12} color={colors.yellow} />
                            <Text style={[st.forYouDetail, { color: colors.textMuted, marginTop: 0 }]}>{hall.avg} ({hall.count})</Text>
                          </View>
                          <View style={[st.forYouBadge, { backgroundColor: hall.status.isOpen ? colors.green + '22' : colors.border }]}>
                            <Text style={{ fontSize: 10, color: hall.status.isOpen ? colors.green : colors.textMuted, fontFamily: 'DMSans_600SemiBold' }}>
                              {hall.status.isOpen ? `Open · ${hall.status.currentMeal}` : 'Closed'}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {renderForYouItemRow('Try Something New', 'zap', forYouNew.map((i) => ({
                  id: i.id, name: i.name, calories: i.calories, hallName: i.hall_name,
                })), 'new')}

                {renderForYouItemRow('Quick & Light', 'feather', forYouLight.map((i) => ({
                  id: i.id, name: i.name, calories: i.calories, hallName: i.hall_name,
                })), 'light')}
              </>
            )}
          </Animated.View>
        )}

        {/* Today's Meals — fade in */}
        <Animated.View style={[{ marginTop: 28 }, {
          opacity: entryAnims[6],
        }]}>
          <View style={st.sectionHead}>
            <Text style={[st.sectionTitle, { color: colors.text, fontFamily: 'Outfit_700Bold' }]}>Today's Meals</Text>
            <TouchableOpacity onPress={() => setShowHistory(true)} activeOpacity={0.7}>
              <Text style={[{ fontSize: 13, color: colors.textMuted, fontFamily: 'DMSans_500Medium' }]}>History →</Text>
            </TouchableOpacity>
          </View>
          {renderMealGroup('Breakfast', 'BREAKFAST')}
          {renderMealGroup('Lunch', 'LUNCH')}
          {renderMealGroup('Dinner', 'DINNER')}
        </Animated.View>
      </ScrollView>

      {/* History Modal */}
      <Modal
        visible={showHistory}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowHistory(false)}
      >
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={st.historyModalHeader}>
            <TouchableOpacity onPress={() => setShowHistory(false)} activeOpacity={0.6}>
              <Text style={[{ fontSize: 15, color: colors.textMuted, fontFamily: 'DMSans_500Medium' }]}>Close</Text>
            </TouchableOpacity>
          </View>
          <HistoryScreen />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 100 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  greetingLabel: { fontSize: 14, marginBottom: 2 },
  greeting: { fontSize: 28 },
  gradePill: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  gradePillText: { fontSize: 14 },
  ringWrap: { alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  ringCenter: { position: 'absolute', alignItems: 'center' },
  ringNumber: { fontSize: 36 },
  ringLabel: { fontSize: 13, marginTop: 2 },
  legendRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 12, fontFamily: 'DMSans_500Medium' },
  waterCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, padding: 14, marginTop: 16 },
  waterLabel: { fontSize: 14 },
  waterBarTrack: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden', marginHorizontal: 12 },
  waterBarFill: { height: 4, borderRadius: 2 },
  waterAmount: { fontSize: 14, marginRight: 8 },
  waterPill: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6, marginLeft: 4 },
  waterPillText: { fontSize: 12 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 20 },
  forYouSubtitle: { fontSize: 15, marginBottom: 10 },
  forYouCard: { width: 140, padding: 12, borderRadius: 14, marginRight: 10 },
  forYouName: { fontSize: 13, fontFamily: 'DMSans_600SemiBold', marginTop: 8 },
  forYouDetail: { fontSize: 12, fontFamily: 'DMSans_400Regular', marginTop: 2 },
  forYouHall: { fontSize: 11, fontFamily: 'DMSans_400Regular', marginTop: 2 },
  forYouBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, marginTop: 6, alignSelf: 'flex-start' as const },
  openHallCard: { width: 140, padding: 12, borderRadius: 14, marginRight: 10, borderWidth: 1, alignItems: 'flex-start' as const },
  mealHeader: { fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 },
  logRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  logName: { flex: 1, fontSize: 15 },
  logCal: { fontSize: 14, marginRight: 8 },
  deleteBtn: { padding: 4 },
  divider: { height: 1 },
  historyModalHeader: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  streakScoreRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  streakCard: { flex: 1, borderRadius: 14, padding: 16, borderWidth: 1, overflow: 'hidden' },
  streakCardHeader: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, fontFamily: 'DMSans_500Medium' },
  streakCardNumber: { fontSize: 32, marginTop: 6 },
  streakCardLabel: { fontSize: 13, marginTop: 2 },
  streakCardAccent: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 2 },
  forYouEmptyCard: { borderRadius: 14, borderWidth: 1, padding: 24, alignItems: 'center', justifyContent: 'center' },
});
