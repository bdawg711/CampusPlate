import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Circle } from 'react-native-svg';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/src/utils/supabase';
import { getUserId } from '@/src/utils/user';

type MealLog = {
  id: number;
  servings: number;
  meal: string;
  name: string;
  calories: number;
  protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
};

type Profile = {
  goal_calories: number;
  goal_protein_g: number;
  goal_carbs_g: number;
  goal_fat_g: number;
};

const DEFAULT_GOALS: Profile = {
  goal_calories: 2100,
  goal_protein_g: 158,
  goal_carbs_g: 236,
  goal_fat_g: 58,
};

function CalorieRing({ consumed, goal }: { consumed: number; goal: number }) {
  const size = 180;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(consumed / Math.max(goal, 1), 1);
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <View style={styles.ringContainer}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={Colors.border}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={Colors.primary}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </Svg>
      <View style={styles.ringTextContainer}>
        <Text style={styles.ringCalories}>{consumed.toLocaleString()}</Text>
        <Text style={styles.ringDivider}>/ {goal.toLocaleString()} cal</Text>
      </View>
    </View>
  );
}

function MacroBar({
  label,
  current,
  goal,
  color,
}: {
  label: string;
  current: number;
  goal: number;
  color: string;
}) {
  const progress = Math.min(current / Math.max(goal, 1), 1);
  return (
    <View style={styles.macroBarContainer}>
      <View style={styles.macroLabelRow}>
        <Text style={styles.macroLabel}>{label}</Text>
        <Text style={styles.macroValue}>
          {Math.round(current)}g / {goal}g
        </Text>
      </View>
      <View style={styles.macroTrack}>
        <View style={[styles.macroFill, { width: `${progress * 100}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const [logs, setLogs] = useState<MealLog[]>([]);
  const [profile, setProfile] = useState<Profile>(DEFAULT_GOALS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().split('T')[0];
  const dayName = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const userId = await getUserId();

      // Fetch meal logs and profile in parallel
      const [logsResult, profileResult] = await Promise.all([
        supabase
          .from('meal_logs')
          .select('id, servings, meal, menu_item_id')
          .eq('user_id', userId)
          .eq('date', today)
          .order('created_at'),
        supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
      ]);

      if (logsResult.error) throw logsResult.error;
      const rawLogs = logsResult.data || [];

      if (rawLogs.length > 0) {
        // Batch fetch menu items with nutrition
        const menuItemIds = [...new Set(rawLogs.map((r: any) => r.menu_item_id))];
        const { data: menuData } = await supabase
          .from('menu_items')
          .select('id, name, nutrition(calories, protein_g, total_carbs_g, total_fat_g)')
          .in('id', menuItemIds);

        const menuMap = new Map<number, any>();
        for (const mi of menuData || []) {
          const nutr = Array.isArray(mi.nutrition) ? mi.nutrition[0] : mi.nutrition;
          menuMap.set(mi.id, { name: mi.name, ...(nutr || {}) });
        }

        const parsed: MealLog[] = rawLogs.map((row: any) => {
          const info = menuMap.get(row.menu_item_id) || {};
          return {
            id: row.id,
            servings: row.servings,
            meal: row.meal,
            name: info.name || 'Unknown',
            calories: info.calories || 0,
            protein_g: info.protein_g || 0,
            total_carbs_g: info.total_carbs_g || 0,
            total_fat_g: info.total_fat_g || 0,
          };
        });
        setLogs(parsed);
      } else {
        setLogs([]);
      }

      if (profileResult.data?.goal_calories) {
        const p = profileResult.data;
        setProfile({
          goal_calories: p.goal_calories || DEFAULT_GOALS.goal_calories,
          goal_protein_g: p.goal_protein_g || Math.round((p.goal_calories * 0.3) / 4),
          goal_carbs_g: p.goal_carbs_g || Math.round((p.goal_calories * 0.45) / 4),
          goal_fat_g: p.goal_fat_g || Math.round((p.goal_calories * 0.25) / 9),
        });
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [today]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const deleteLog = async (logId: number) => {
    try {
      const { error: delError } = await supabase.from('meal_logs').delete().eq('id', logId);
      if (delError) throw delError;
      setLogs((prev) => prev.filter((l) => l.id !== logId));
    } catch (e: any) {
      alert(e.message || 'Failed to delete');
    }
  };

  const totals = logs.reduce(
    (acc, log) => {
      const s = log.servings;
      return {
        calories: acc.calories + (log.calories || 0) * s,
        protein: acc.protein + (log.protein_g || 0) * s,
        carbs: acc.carbs + (log.total_carbs_g || 0) * s,
        fat: acc.fat + (log.total_fat_g || 0) * s,
      };
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const grouped: Record<string, MealLog[]> = {};
  for (const log of logs) {
    const meal = log.meal || 'Other';
    if (!grouped[meal]) grouped[meal] = [];
    grouped[meal].push(log);
  }
  const mealOrder = ['Breakfast', 'Lunch', 'Dinner'];

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        <Text style={styles.greeting}>Hey Hokie!</Text>
        <Text style={styles.dateText}>{dayName}</Text>

        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
            <Text style={styles.errorHint}>Pull down to retry</Text>
          </View>
        )}

        <View style={styles.card}>
          <CalorieRing consumed={Math.round(totals.calories)} goal={profile.goal_calories} />
          <View style={styles.macrosSection}>
            <MacroBar label="Protein" current={totals.protein} goal={profile.goal_protein_g} color={Colors.protein} />
            <MacroBar label="Carbs" current={totals.carbs} goal={profile.goal_carbs_g} color={Colors.carbs} />
            <MacroBar label="Fat" current={totals.fat} goal={profile.goal_fat_g} color={Colors.fat} />
          </View>
        </View>

        <Text style={styles.sectionTitle}>Today's Meals</Text>

        {logs.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No meals logged yet.</Text>
            <Text style={styles.emptyHint}>Hit the menu to start!</Text>
          </View>
        ) : (
          mealOrder.map((meal) => {
            const items = grouped[meal];
            if (!items || items.length === 0) return null;
            return (
              <View key={meal} style={styles.card}>
                <Text style={styles.mealHeader}>{meal}</Text>
                {items.map((log) => {
                  const cal = Math.round((log.calories || 0) * log.servings);
                  return (
                    <View key={log.id} style={styles.logItem}>
                      <View style={styles.logInfo}>
                        <Text style={styles.logName}>{log.name}</Text>
                        <Text style={styles.logDetail}>
                          {log.servings !== 1 ? `${log.servings}x · ` : ''}
                          {cal} cal
                        </Text>
                      </View>
                      <TouchableOpacity onPress={() => deleteLog(log.id)} style={styles.deleteBtn}>
                        <Text style={styles.deleteBtnText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            );
          })
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },
  greeting: { fontSize: 28, fontWeight: 'bold', color: Colors.textPrimary },
  dateText: { fontSize: 14, color: Colors.textSecondary, marginBottom: 16 },
  errorBanner: {
    backgroundColor: '#FDECEA',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  errorText: { color: Colors.error, fontWeight: '600', fontSize: 14 },
  errorHint: { color: Colors.error, fontSize: 12, marginTop: 2 },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  ringContainer: { alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  ringTextContainer: { position: 'absolute', alignItems: 'center' },
  ringCalories: { fontSize: 32, fontWeight: 'bold', color: Colors.textPrimary },
  ringDivider: { fontSize: 13, color: Colors.textSecondary },
  macrosSection: { gap: 12 },
  macroBarContainer: {},
  macroLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  macroLabel: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  macroValue: { fontSize: 13, color: Colors.textSecondary },
  macroTrack: { height: 8, backgroundColor: '#ECECEC', borderRadius: 4, overflow: 'hidden' },
  macroFill: { height: '100%', borderRadius: 4 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginTop: 8,
    marginBottom: 8,
  },
  emptyCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  emptyText: { fontSize: 15, color: Colors.textSecondary, fontWeight: '600' },
  emptyHint: { fontSize: 13, color: Colors.textSecondary, marginTop: 4 },
  mealHeader: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  logItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  logInfo: { flex: 1 },
  logName: { fontSize: 15, color: Colors.textPrimary, fontWeight: '500' },
  logDetail: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  deleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  deleteBtnText: { color: Colors.textSecondary, fontSize: 13, fontWeight: 'bold' },
});
