import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
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
import { logBelongsToMealGroup } from '@/src/utils/meals';
import { getTodayWater, addWater, removeWater, getWaterGoal } from '@/src/utils/water';
import WaterTracker from '@/src/components/WaterTracker';
import Skeleton from '@/src/components/Skeleton';
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

interface CollectionItem {
  emoji: string;
  name: string;
  count: number;
  filter: string;
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
  const [collections, setCollections] = useState<CollectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [waterOz, setWaterOz] = useState<number>(0);
  const [waterGoal, setWaterGoal] = useState<number>(64);
  const [waterLoading, setWaterLoading] = useState<boolean>(true);

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

  const loadData = useCallback(async () => {
    try {
      const userId = await requireUserId();
      const today = getLocalDate();

      const [profileRes, logsRes, collectionsRes, waterCount, waterGoalRes] = await Promise.all([
        supabase.from('profiles').select('name, goal_calories, goal_protein_g, goal_carbs_g, goal_fat_g').eq('id', userId).single(),
        supabase
          .from('meal_logs')
          .select('id, servings, meal, created_at, menu_items(id, name, station, nutrition(calories, protein_g, total_carbs_g, total_fat_g))')
          .eq('user_id', userId)
          .eq('date', today)
          .order('created_at', { ascending: true }),
        loadCollections(today),
        getTodayWater(userId),
        getWaterGoal(userId),
      ]);

      if (profileRes.data) setProfile(profileRes.data as any);
      if (logsRes.data) setLogs(logsRes.data as any);
      if (collectionsRes) setCollections(collectionsRes);
      setWaterOz(waterCount);
      setWaterGoal(waterGoalRes);
    } catch (e) {
      console.error('Dashboard load error:', e);
    } finally {
      setLoading(false);
      setWaterLoading(false);
    }
  }, []);

  const loadCollections = async (today: string): Promise<CollectionItem[]> => {
    try {
      const { data } = await supabase
        .from('menu_items')
        .select('id, name, station, nutrition(calories, protein_g, total_carbs_g, total_fat_g), dietary_flags')
        .eq('date', today);

      if (!data) return [];
      const items = data as any[];
      const highProtein = items.filter((i) => i.nutrition?.[0]?.protein_g > 25 || i.nutrition?.protein_g > 25).length;
      const lowCal = items.filter((i) => {
        const cal = i.nutrition?.[0]?.calories ?? i.nutrition?.calories ?? 999;
        return cal < 400;
      }).length;
      const vegan = items.filter((i) => i.dietary_flags?.includes('vegan')).length;
      const vegetarian = items.filter((i) => i.dietary_flags?.includes('vegetarian')).length;
      const lowCarb = items.filter((i) => {
        const carbs = i.nutrition?.[0]?.total_carbs_g ?? i.nutrition?.total_carbs_g ?? 999;
        return carbs < 20;
      }).length;
      const quickFuel = items.filter((i) => /grab|express|dx/i.test(i.station || '')).length;

      return [
        { emoji: '💪', name: 'High Protein', count: highProtein, filter: 'high_protein' },
        { emoji: '🥗', name: 'Under 400 Cal', count: lowCal, filter: 'low_cal' },
        { emoji: '🌱', name: 'Vegan', count: vegan, filter: 'vegan' },
        { emoji: '🥬', name: 'Vegetarian', count: vegetarian, filter: 'vegetarian' },
        { emoji: '🥩', name: 'Low Carb', count: lowCarb, filter: 'low_carb' },
        { emoji: '⚡', name: 'Quick Fuel', count: quickFuel, filter: 'quick_fuel' },
      ].filter((c) => c.count > 0);
    } catch {
      return [];
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

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
      await supabase.from('meal_logs').delete().eq('id', logId);
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

        {/* For You Collections — fade in + slide up */}
        {collections.length > 0 && (
          <Animated.View style={[{ marginTop: 24 }, {
            opacity: entryAnims[5],
            transform: [{ translateY: entryAnims[5].interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
          }]}>
            <View style={st.sectionHead}>
              <Text style={[st.sectionTitle, { color: colors.text, fontFamily: 'Outfit_700Bold' }]}>For You</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 20 }}>
              {collections.map((c) => (
                <View key={c.filter} style={[st.collectionCard, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
                  <Text style={{ fontSize: 28 }}>{c.emoji}</Text>
                  <Text style={[{ fontSize: 13, color: colors.text, fontFamily: 'DMSans_700Bold', marginTop: 8 }]}>{c.name}</Text>
                  <Text style={[{ fontSize: 11, color: colors.textMuted, fontFamily: 'DMSans_400Regular', marginTop: 2 }]}>{c.count} items today</Text>
                </View>
              ))}
            </ScrollView>
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
  collectionCard: { minWidth: 140, padding: 16, borderRadius: 16, marginRight: 10 },
  mealHeader: { fontSize: 12, fontWeight: '700', letterSpacing: 1.5, opacity: 0.3, textTransform: 'uppercase', marginBottom: 12 },
  logRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  logDot: { width: 8, height: 8, borderRadius: 4, marginRight: 12 },
  logName: { flex: 1, fontSize: 14 },
  logCal: { fontSize: 14, opacity: 0.7, marginRight: 8 },
  deleteBtn: { padding: 4 },
  divider: { height: 1, marginLeft: 20 },
});
