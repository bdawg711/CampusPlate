import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/src/utils/supabase';
import { getUserId } from '@/src/utils/user';

type HistoryLog = {
  id: number;
  servings: number;
  meal: string;
  name: string;
  calories: number;
  protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
};

function getLast7Days(): { date: string; label: string; dayLabel: string }[] {
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({
      date: d.toISOString().split('T')[0],
      label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      dayLabel: i === 0 ? 'Today' : i === 1 ? 'Yesterday' : d.toLocaleDateString('en-US', { weekday: 'short' }),
    });
  }
  return days;
}

export default function HistoryScreen() {
  const days = getLast7Days();
  const [selectedDate, setSelectedDate] = useState(days[0].date);
  const [logs, setLogs] = useState<HistoryLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const userId = await getUserId();
      const { data, error: e } = await supabase
        .from('meal_logs')
        .select('id, servings, meal, menu_item_id')
        .eq('user_id', userId)
        .eq('date', selectedDate)
        .order('created_at');
      if (e) throw e;

      const rawLogs = data || [];
      if (rawLogs.length > 0) {
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

        setLogs(rawLogs.map((row: any) => {
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
        }));
      } else {
        setLogs([]);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load history');
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const totals = logs.reduce(
    (acc, log) => {
      const s = log.servings;
      return {
        calories: acc.calories + log.calories * s,
        protein: acc.protein + log.protein_g * s,
        carbs: acc.carbs + log.total_carbs_g * s,
        fat: acc.fat + log.total_fat_g * s,
      };
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const grouped: Record<string, HistoryLog[]> = {};
  for (const log of logs) {
    const meal = log.meal || 'Other';
    if (!grouped[meal]) grouped[meal] = [];
    grouped[meal].push(log);
  }
  const mealOrder = ['Breakfast', 'Lunch', 'Dinner'];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>History</Text>

        {/* Date strip */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateStrip} contentContainerStyle={styles.dateStripContent}>
          {days.map((d) => (
            <TouchableOpacity
              key={d.date}
              style={[styles.dateChip, selectedDate === d.date && styles.dateChipActive]}
              onPress={() => setSelectedDate(d.date)}
            >
              <Text style={[styles.dateDayLabel, selectedDate === d.date && styles.dateChipTextActive]}>
                {d.dayLabel}
              </Text>
              <Text style={[styles.dateLabel, selectedDate === d.date && styles.dateChipTextActive]}>
                {d.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {error ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : logs.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyText}>Nothing logged for this day</Text>
          </View>
        ) : (
          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {/* Daily totals */}
            <View style={styles.totalsCard}>
              <View style={styles.totalItem}>
                <Text style={styles.totalValue}>{Math.round(totals.calories)}</Text>
                <Text style={styles.totalLabel}>Calories</Text>
              </View>
              <View style={styles.totalItem}>
                <Text style={[styles.totalValue, { color: Colors.protein }]}>{Math.round(totals.protein)}g</Text>
                <Text style={styles.totalLabel}>Protein</Text>
              </View>
              <View style={styles.totalItem}>
                <Text style={[styles.totalValue, { color: Colors.carbs }]}>{Math.round(totals.carbs)}g</Text>
                <Text style={styles.totalLabel}>Carbs</Text>
              </View>
              <View style={styles.totalItem}>
                <Text style={[styles.totalValue, { color: Colors.fat }]}>{Math.round(totals.fat)}g</Text>
                <Text style={styles.totalLabel}>Fat</Text>
              </View>
            </View>

            {/* Meal groups */}
            {mealOrder.map((meal) => {
              const items = grouped[meal];
              if (!items || items.length === 0) return null;
              return (
                <View key={meal} style={styles.mealCard}>
                  <Text style={styles.mealHeader}>{meal}</Text>
                  {items.map((log) => {
                    const cal = Math.round(log.calories * log.servings);
                    return (
                      <View key={log.id} style={styles.logItem}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.logName}>{log.name}</Text>
                          <Text style={styles.logMeta}>
                            {log.servings !== 1 ? `${log.servings}x · ` : ''}
                            {cal} cal
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              );
            })}
            <View style={{ height: 24 }} />
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1, padding: 16 },
  title: { fontSize: 24, fontWeight: 'bold', color: Colors.textPrimary, marginBottom: 8 },
  dateStrip: { maxHeight: 64, marginBottom: 12 },
  dateStripContent: { gap: 8 },
  dateChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    minWidth: 64,
  },
  dateChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  dateDayLabel: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  dateLabel: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  dateChipTextActive: { color: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: Colors.error, fontWeight: '600' },
  emptyText: { color: Colors.textSecondary, fontSize: 15 },
  scroll: { flex: 1 },
  totalsCard: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    justifyContent: 'space-around',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  totalItem: { alignItems: 'center' },
  totalValue: { fontSize: 18, fontWeight: 'bold', color: Colors.textPrimary },
  totalLabel: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  mealCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
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
  logName: { fontSize: 15, fontWeight: '500', color: Colors.textPrimary },
  logMeta: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
});
