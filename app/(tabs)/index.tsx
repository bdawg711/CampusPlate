import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Alert,
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
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '@/src/context/ThemeContext';
import { requireUserId } from '@/src/utils/auth';
import { supabase } from '@/src/utils/supabase';
import { logBelongsToMealGroup, getCurrentMealPeriod, getEffectiveMenuDate } from '@/src/utils/meals';
import { getTodayWater, addWater, removeWater, getWaterGoal } from '@/src/utils/water';
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
import WaterTracker from '@/src/components/WaterTracker';
import Skeleton from '@/src/components/Skeleton';
import AIChat from '@/src/components/AIChat';
import type { MealItem } from '@/src/utils/ai';
import { useStaggerAnimation } from '@/src/hooks/useStaggerAnimation';

function getLocalDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDate(d = new Date()) {
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
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
  const [waterLoading, setWaterLoading] = useState<boolean>(true);
  const [openHalls, setOpenHalls] = useState<OpenHall[]>([]);
  const [forYouLoading, setForYouLoading] = useState(true);

  const [showAIChat, setShowAIChat] = useState(false);

  // ─── Entry stagger animations ───
  // 0: greeting, 1: calorie ring, 2-4: macro cards, 5: collections, 6: meals
  const { anims: entryAnims, play: playEntry } = useStaggerAnimation(7, { staggerMs: 80, durationMs: 350, delayMs: 0 });

  // ─── Calorie ring fill animation ───
  const ringAnim = useRef(new Animated.Value(0)).current;
  const prevCalPercent = useRef(0);

  // ─── Macro bar animations (animate scaleX) ───
  const macroProAnim = useRef(new Animated.Value(0)).current;
  const macroCarbAnim = useRef(new Animated.Value(0)).current;
  const macroFatAnim = useRef(new Animated.Value(0)).current;
  const macroAnims = [macroProAnim, macroCarbAnim, macroFatAnim];

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

      const [profileRes, logsRes, , waterCount, waterGoalRes, hallStatusMap] = await Promise.all([
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
      ]);

      if (profileRes.data) setProfile(profileRes.data as any);
      if (logsRes.data) setLogs(logsRes.data as any);
      setWaterOz(waterCount);
      setWaterGoal(waterGoalRes);
      if (hallStatusMap) setOpenHalls(hallStatusMap);
    } catch (e) {
      console.error('Dashboard load error:', e);
    } finally {
      setLoading(false);
      setWaterLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // ─── "Log this" from AI meal suggestions ───
  const handleLogAIItem = useCallback(async (item: MealItem) => {
    try {
      const userId = await requireUserId();
      const date = await getEffectiveMenuDate();
      const { error } = await supabase.from('meal_logs').insert({
        user_id: userId,
        menu_item_id: item.id,
        date,
        meal: item.meal || getCurrentMealPeriod(),
        servings: 1,
      });
      if (error) {
        console.error('AI log meal failed:', error.message);
        Alert.alert('Error', 'Failed to log meal. Please try again.');
        return;
      }
      Alert.alert('Logged!', `${item.name} (${item.calories} cal) added to your log.`);
      loadData();
    } catch (e: any) {
      console.error('AI log error:', e?.message);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    }
  }, [loadData]);

  // ─── Animate ring + macros when data changes ───
  useEffect(() => {
    if (loading) return;

    const goalCal = profile?.goal_calories || 2000;
    const goalPro = profile?.goal_protein_g || 150;
    const goalCarb = profile?.goal_carbs_g || 200;
    const goalFat = profile?.goal_fat_g || 65;

    const newCalPercent = Math.min(totalCal / goalCal, 1);
    const proPercent = Math.min(totalPro / goalPro, 1);
    const carbPercent = Math.min(totalCarb / goalCarb, 1);
    const fatPercent = Math.min(totalFat / goalFat, 1);

    // Animate ring from old to new
    Animated.timing(ringAnim, {
      toValue: newCalPercent,
      duration: prevCalPercent.current === 0 ? 800 : 600,
      easing: prevCalPercent.current === 0 ? Easing.out(Easing.cubic) : Easing.inOut(Easing.cubic),
      useNativeDriver: false, // strokeDashoffset is not natively animatable
    }).start();
    prevCalPercent.current = newCalPercent;

    // Animate macro bars
    const macroDuration = prevCalPercent.current === 0 ? 600 : 600;
    Animated.parallel([
      Animated.timing(macroProAnim, { toValue: proPercent, duration: macroDuration, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(macroCarbAnim, { toValue: carbPercent, duration: macroDuration, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(macroFatAnim, { toValue: fatPercent, duration: macroDuration, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();

    // Play entry stagger on first load
    playEntry();
  }, [loading, logs]);

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
    } catch (error) {
      console.error('Failed to add water:', error);
    }
  };

  const handleRemoveWater = async (oz: number) => {
    try {
      const userId = await requireUserId();
      const newTotal = await removeWater(userId, oz);
      setWaterOz(newTotal);
    } catch (error) {
      console.error('Failed to remove water:', error);
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

  // SVG ring
  const ringSize = 170;
  const strokeWidth = 12;
  const radius = (ringSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Animated strokeDashoffset
  const animatedStrokeDashoffset = ringAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

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
        <Text style={[st.mealHeader, { color: colors.text }]}>
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
                  <View style={[st.logDot, { backgroundColor: colors.maroon }]} />
                  <Text style={[st.logName, { color: colors.text, fontFamily: 'DMSans_500Medium' }]} numberOfLines={1}>
                    {getMealName(log)}
                  </Text>
                  <Text style={[st.logCal, { color: colors.text, fontFamily: 'DMSans_600SemiBold' }]}>
                    {n.cal}
                  </Text>
                  <TouchableOpacity onPress={() => deleteLog(log.id)} style={st.deleteBtn}>
                    <Text style={[{ fontSize: 16, color: colors.textDim }]}>✕</Text>
                  </TouchableOpacity>
                </View>
                {i < mealLogs.length - 1 && <View style={[st.divider, { backgroundColor: colors.border }]} />}
              </View>
            );
          })
        )}
      </View>
    );
  };

  const hasForYou = forYouLoading || forYouFavs.length > 0 || forYouMacros.length > 0 || forYouTopHalls.length > 0 || forYouNew.length > 0 || forYouLight.length > 0;

  const renderForYouSkeletonRow = () => (
    <View style={{ marginBottom: 16 }}>
      <Skeleton width={130} height={15} borderRadius={7} style={{ marginBottom: 10 }} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 20 }}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={[st.forYouCard, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
            <Skeleton width={28} height={28} borderRadius={14} />
            <Skeleton width={100} height={13} borderRadius={6} style={{ marginTop: 8 }} />
            <Skeleton width={60} height={12} borderRadius={6} style={{ marginTop: 6 }} />
            <Skeleton width={80} height={11} borderRadius={6} style={{ marginTop: 4 }} />
          </View>
        ))}
      </ScrollView>
    </View>
  );

  const renderForYouItemRow = (title: string, emoji: string, items: { id: number; name: string; calories: number; hallName: string }[], filter?: string) => {
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
              style={[st.forYouCard, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}
              onPress={() => router.push({ pathname: '/(tabs)/browse', params: filter ? { filter } : {} })}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 24 }}>{emoji}</Text>
              <Text style={[st.forYouName, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
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
              <Skeleton width={120} height={14} borderRadius={7} />
              <Skeleton width={200} height={26} borderRadius={8} style={{ marginTop: 8 }} />
            </View>
            <Skeleton width={42} height={42} borderRadius={21} />
          </View>
          {/* Ring skeleton */}
          <View style={{ alignItems: 'center', marginBottom: 24 }}>
            <Skeleton width={170} height={170} borderRadius={85} />
          </View>
          {/* Macro cards skeleton */}
          <View style={st.macroRow}>
            <Skeleton width={'100%' as any} height={90} borderRadius={14} style={{ flex: 1 }} />
            <Skeleton width={'100%' as any} height={90} borderRadius={14} style={{ flex: 1 }} />
            <Skeleton width={'100%' as any} height={90} borderRadius={14} style={{ flex: 1 }} />
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

  const macroData = [
    { label: 'Protein', val: totalPro, goal: goalPro, color: colors.blue },
    { label: 'Carbs', val: totalCarb, goal: goalCarb, color: colors.orange },
    { label: 'Fat', val: totalFat, goal: goalFat, color: colors.yellow },
  ];

  // Use an AnimatedCircle wrapper to animate strokeDashoffset
  const AnimatedCircleComponent = Animated.createAnimatedComponent(Circle);

  return (
    <SafeAreaView style={[st.safe, { backgroundColor: colors.background }]}>
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
            <Text style={[st.dateText, { color: colors.textMuted, fontFamily: 'DMSans_400Regular' }]}>
              {formatDate()}
            </Text>
            <Text style={[st.greeting, { color: colors.text, fontFamily: 'Outfit_700Bold' }]}>
              Hey {profile?.name || 'there'} 👋
            </Text>
          </View>
          <View style={[st.avatar, { backgroundColor: colors.maroon }]}>
            <Text style={[st.avatarText, { fontFamily: 'Outfit_700Bold' }]}>
              {(profile?.name || 'U')[0].toUpperCase()}
            </Text>
          </View>
        </Animated.View>

        {/* Calorie Ring — fade in + scale */}
        <Animated.View style={[st.ringWrap, {
          opacity: entryAnims[1],
          transform: [{ scale: entryAnims[1].interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }],
        }]}>
          <Svg width={ringSize} height={ringSize}>
            <Circle
              cx={ringSize / 2}
              cy={ringSize / 2}
              r={radius}
              stroke="rgba(139,30,63,0.12)"
              strokeWidth={strokeWidth}
              fill="none"
            />
            <AnimatedCircleComponent
              cx={ringSize / 2}
              cy={ringSize / 2}
              r={radius}
              stroke={colors.maroon}
              strokeWidth={strokeWidth}
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={animatedStrokeDashoffset}
              strokeLinecap="round"
              transform={`rotate(-90 ${ringSize / 2} ${ringSize / 2})`}
            />
          </Svg>
          <View style={st.ringCenter}>
            <Text style={[st.ringNumber, { color: colors.text, fontFamily: 'Outfit_700Bold' }]}>
              {totalCal}
            </Text>
            <Text style={[st.ringLabel, { color: colors.textMuted, fontFamily: 'DMSans_400Regular' }]}>
              of {goalCal} cal
            </Text>
          </View>
        </Animated.View>

        {/* Macro Cards — fade in + slide up, staggered */}
        <View style={st.macroRow}>
          {macroData.map((m, i) => (
            <Animated.View key={m.label} style={[
              st.macroCard,
              { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 },
              {
                opacity: entryAnims[2 + i],
                transform: [{ translateY: entryAnims[2 + i].interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
              },
            ]}>
              <Text style={[st.macroVal, { color: m.color, fontFamily: 'Outfit_700Bold' }]}>{m.val}g</Text>
              <Text style={[st.macroLabel, { color: colors.textMuted, fontFamily: 'DMSans_400Regular' }]}>{m.label}</Text>
              <View style={[st.macroTrack, { backgroundColor: colors.border }]}>
                <Animated.View
                  style={[
                    st.macroFill,
                    {
                      backgroundColor: m.color,
                      width: '100%',
                      transform: [{ scaleX: macroAnims[i] }],
                      transformOrigin: 'left',
                    },
                  ]}
                />
              </View>
            </Animated.View>
          ))}
        </View>

        {/* Water Tracker */}
        <View style={{ marginTop: 16 }}>
          <WaterTracker
            consumed={waterOz}
            goal={waterGoal}
            onAddWater={handleAddWater}
            onRemoveWater={handleRemoveWater}
            loading={waterLoading}
          />
        </View>

        {/* Open Now */}
        {openHalls.length > 0 && (
          <View style={{ marginTop: 24 }}>
            <View style={st.sectionHead}>
              <Text style={[st.sectionTitle, { color: colors.text, fontFamily: 'Outfit_700Bold' }]}>Open Now</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 20 }}>
              {openHalls.map((hall) => (
                <TouchableOpacity
                  key={hall.id}
                  style={[st.openHallCard, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}
                  onPress={() => router.push('/(tabs)/browse')}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 28 }}>🏛️</Text>
                  <Text style={[{ fontSize: 14, color: colors.text, fontFamily: 'DMSans_700Bold', marginTop: 8 }]} numberOfLines={1}>{hall.name}</Text>
                  <View style={[st.openBadge, { backgroundColor: colors.green + '22' }]}>
                    <Text style={[{ fontSize: 11, color: colors.green, fontFamily: 'DMSans_700Bold' }]}>{hall.currentMeal}</Text>
                  </View>
                  <Text style={[{ fontSize: 11, color: colors.textMuted, fontFamily: 'DMSans_400Regular', marginTop: 4 }]}>
                    Closes {hall.closingTime}
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
            ) : (
              <>
                {renderForYouItemRow('Your Favorites Today', '❤️', forYouFavs.map((f) => ({
                  id: f.id, name: f.name, calories: f.nutrition?.calories ?? 0, hallName: hallNames[f.dining_hall_id] ?? '',
                })), 'favorites')}

                {renderForYouItemRow('Fits Your Macros', '🎯', forYouMacros.map((i) => ({
                  id: i.id, name: i.name, calories: i.calories, hallName: i.hall_name,
                })), 'macros')}

                {forYouTopHalls.length > 0 && (
                  <View style={{ marginBottom: 16 }}>
                    <Text style={[st.forYouSubtitle, { color: colors.text, fontFamily: 'DMSans_600SemiBold' }]}>Top Rated Halls</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 20 }}>
                      {forYouTopHalls.map((hall) => (
                        <TouchableOpacity
                          key={hall.id}
                          style={[st.forYouCard, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}
                          onPress={() => router.push('/(tabs)/browse')}
                          activeOpacity={0.7}
                        >
                          <Text style={{ fontSize: 24 }}>🏛️</Text>
                          <Text style={[st.forYouName, { color: colors.text }]} numberOfLines={1}>{hall.name}</Text>
                          <Text style={[st.forYouDetail, { color: colors.textMuted }]}>⭐ {hall.avg} ({hall.count})</Text>
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

                {renderForYouItemRow('Try Something New', '✨', forYouNew.map((i) => ({
                  id: i.id, name: i.name, calories: i.calories, hallName: i.hall_name,
                })), 'new')}

                {renderForYouItemRow('Quick & Light', '🥗', forYouLight.map((i) => ({
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
          {renderMealGroup('Breakfast', 'BREAKFAST')}
          {renderMealGroup('Lunch', 'LUNCH')}
          {renderMealGroup('Dinner', 'DINNER')}
        </Animated.View>
      </ScrollView>

      {/* AI Floating Action Button */}
      <TouchableOpacity
        style={[st.aiFab, { backgroundColor: colors.maroon }]}
        onPress={() => setShowAIChat(true)}
        activeOpacity={0.85}
      >
        <Text style={st.aiFabEmoji}>✨</Text>
      </TouchableOpacity>

      {/* AI Chat Modal */}
      <AIChat visible={showAIChat} onClose={() => setShowAIChat(false)} onLogItem={handleLogAIItem} />
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  dateText: { fontSize: 13, marginBottom: 4 },
  greeting: { fontSize: 26 },
  avatar: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontSize: 18 },
  ringWrap: { alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  ringCenter: { position: 'absolute', alignItems: 'center' },
  ringNumber: { fontSize: 34 },
  ringLabel: { fontSize: 13, marginTop: 2 },
  macroRow: { flexDirection: 'row', gap: 10 },
  macroCard: { flex: 1, borderRadius: 14, padding: 14, alignItems: 'center' },
  macroVal: { fontSize: 22, marginBottom: 2 },
  macroLabel: { fontSize: 11, marginBottom: 8 },
  macroTrack: { width: '100%', height: 4, borderRadius: 2, overflow: 'hidden' },
  macroFill: { height: 4, borderRadius: 2 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 20 },
  forYouSubtitle: { fontSize: 15, marginBottom: 10 },
  forYouCard: { width: 140, padding: 14, borderRadius: 14, marginRight: 10 },
  forYouName: { fontSize: 13, fontFamily: 'DMSans_600SemiBold', marginTop: 8 },
  forYouDetail: { fontSize: 12, fontFamily: 'DMSans_400Regular', marginTop: 2 },
  forYouHall: { fontSize: 11, fontFamily: 'DMSans_400Regular', marginTop: 2 },
  forYouBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, marginTop: 6, alignSelf: 'flex-start' as const },
  openHallCard: { minWidth: 140, padding: 16, borderRadius: 16, marginRight: 10, alignItems: 'flex-start' },
  openBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, marginTop: 6 },
  mealHeader: { fontSize: 12, fontWeight: '700', letterSpacing: 1.5, opacity: 0.3, textTransform: 'uppercase', marginBottom: 12 },
  logRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  logDot: { width: 8, height: 8, borderRadius: 4, marginRight: 12 },
  logName: { flex: 1, fontSize: 14 },
  logCal: { fontSize: 14, opacity: 0.7, marginRight: 8 },
  deleteBtn: { padding: 4 },
  divider: { height: 1, marginLeft: 20 },
  aiFab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#8B1E3F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  aiFabEmoji: { fontSize: 24 },
});
