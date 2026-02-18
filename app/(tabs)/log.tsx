import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/src/utils/supabase';
import { getUserId } from '@/src/utils/user';

type MenuItem = {
  id: number;
  name: string;
  station: string;
  calories: number;
};

type DiningHall = {
  id: number;
  name: string;
  location_num: string;
};

function getCurrentMeal(): string {
  const h = new Date().getHours();
  const m = new Date().getMinutes();
  const totalMin = h * 60 + m;
  if (totalMin < 630) return 'Breakfast';
  if (totalMin < 960) return 'Lunch';
  return 'Dinner';
}

export default function QuickLogScreen() {
  const router = useRouter();
  const [halls, setHalls] = useState<DiningHall[]>([]);
  const [selectedHall, setSelectedHall] = useState<DiningHall | null>(null);
  const [selectedMeal, setSelectedMeal] = useState(getCurrentMeal);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [logging, setLogging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchHalls();
  }, []);

  useEffect(() => {
    if (selectedHall) fetchItems();
  }, [selectedHall, selectedMeal]);

  const fetchHalls = async () => {
    try {
      const { data, error: e } = await supabase.from('dining_halls').select('*').order('name');
      if (e) throw e;
      const list = (data || []) as DiningHall[];
      setHalls(list);
      const d2 = list.find((h) => h.location_num === '15');
      setSelectedHall(d2 || list[0] || null);
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  };

  const fetchItems = async () => {
    if (!selectedHall) return;
    setLoading(true);
    setError(null);
    setSelected(new Set());
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error: e } = await supabase
        .from('menu_items')
        .select('id, name, station, nutrition(calories)')
        .eq('dining_hall_id', selectedHall.id)
        .eq('date', today)
        .eq('meal', selectedMeal)
        .order('station')
        .order('name');
      if (e) throw e;
      const parsed: MenuItem[] = (data || []).map((row: any) => {
        const nutr = Array.isArray(row.nutrition) ? row.nutrition[0] : row.nutrition;
        return {
          id: row.id,
          name: row.name,
          station: row.station,
          calories: nutr?.calories || 0,
        };
      });
      setItems(parsed);
    } catch (e: any) {
      setError(e.message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const runningCalories = items
    .filter((i) => selected.has(i.id))
    .reduce((sum, i) => sum + i.calories, 0);

  const logSelected = async () => {
    if (selected.size === 0) return;
    setLogging(true);
    try {
      const userId = await getUserId();
      const today = new Date().toISOString().split('T')[0];
      const rows = Array.from(selected).map((menuItemId) => ({
        user_id: userId,
        menu_item_id: menuItemId,
        date: today,
        meal: selectedMeal,
        servings: 1.0,
      }));
      const { error: e } = await supabase.from('meal_logs').insert(rows);
      if (e) throw e;
      Alert.alert('Logged!', `Logged ${selected.size} item${selected.size > 1 ? 's' : ''} (+${runningCalories} cal)`);
      setSelected(new Set());
      router.navigate('/' as any);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to log meals');
    } finally {
      setLogging(false);
    }
  };

  const meals = ['Breakfast', 'Lunch', 'Dinner'];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Quick Log</Text>

        {/* Hall chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chipRow}>
          {halls.map((hall) => (
            <TouchableOpacity
              key={hall.id}
              style={[styles.chip, selectedHall?.id === hall.id && styles.chipActive]}
              onPress={() => setSelectedHall(hall)}
            >
              <Text style={[styles.chipText, selectedHall?.id === hall.id && styles.chipTextActive]}>
                {hall.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Meal filter */}
        <View style={styles.filterRow}>
          {meals.map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.pill, selectedMeal === m && styles.pillActive]}
              onPress={() => setSelectedMeal(m)}
            >
              <Text style={[styles.pillText, selectedMeal === m && styles.pillTextActive]}>{m}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {error ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : items.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyText}>No items available</Text>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(i) => i.id.toString()}
            contentContainerStyle={{ paddingBottom: 80 }}
            renderItem={({ item }) => {
              const isSelected = selected.has(item.id);
              return (
                <TouchableOpacity
                  style={[styles.checkItem, isSelected && styles.checkItemActive]}
                  onPress={() => toggle(item.id)}
                >
                  <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                    {isSelected && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.checkName, isSelected && { color: Colors.primary }]}>{item.name}</Text>
                    <Text style={styles.checkStation}>{item.station}</Text>
                  </View>
                  <Text style={styles.checkCal}>{item.calories} cal</Text>
                </TouchableOpacity>
              );
            }}
          />
        )}

        {/* Bottom bar */}
        {selected.size > 0 && (
          <View style={styles.bottomBar}>
            <Text style={styles.bottomText}>
              {selected.size} item{selected.size > 1 ? 's' : ''} · {runningCalories} cal
            </Text>
            <TouchableOpacity
              style={[styles.logBtn, logging && { opacity: 0.6 }]}
              onPress={logSelected}
              disabled={logging}
            >
              <Text style={styles.logBtnText}>{logging ? 'Logging...' : 'Log Selected'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1, padding: 16 },
  title: { fontSize: 24, fontWeight: 'bold', color: Colors.textPrimary, marginBottom: 8 },
  chipScroll: { maxHeight: 40, marginBottom: 10 },
  chipRow: { gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  chipTextActive: { color: '#fff' },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pillActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  pillText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  pillTextActive: { color: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: Colors.error, fontWeight: '600' },
  emptyText: { color: Colors.textSecondary, fontSize: 15 },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  checkItemActive: { borderColor: Colors.primary, backgroundColor: '#FDF2F5' },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.border,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  checkmark: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  checkName: { fontSize: 15, fontWeight: '500', color: Colors.textPrimary },
  checkStation: { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  checkCal: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary, marginLeft: 8 },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.card,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  bottomText: { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  logBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  logBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
});
