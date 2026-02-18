import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/src/utils/supabase';
import { getUserId } from '@/src/utils/user';

type NutritionFull = {
  calories: number | null;
  total_fat_g: number | null;
  sat_fat_g: number | null;
  trans_fat_g: number | null;
  cholesterol_mg: number | null;
  sodium_mg: number | null;
  total_carbs_g: number | null;
  dietary_fiber_g: number | null;
  sugars_g: number | null;
  added_sugars_g: number | null;
  protein_g: number | null;
  vitamin_d_mcg: number | null;
  calcium_mg: number | null;
  iron_mg: number | null;
  potassium_mg: number | null;
  ingredients: string | null;
};

type MenuItem = {
  id: number;
  name: string;
  station: string;
  meal: string;
  serving_size: string | null;
  serving_unit: string | null;
  dietary_flags: string[] | null;
  allergens: string[] | null;
  nutrition: NutritionFull | null;
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
  if (totalMin < 630) return 'Breakfast'; // before 10:30
  if (totalMin < 960) return 'Lunch'; // before 4 PM
  return 'Dinner';
}

function getDateStr(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().split('T')[0];
}

function DietaryBadge({ flag }: { flag: string }) {
  const lower = flag.toLowerCase();
  let label = flag;
  let bg = '#E8F5E9';
  let fg = '#2E7D32';
  if (lower === 'vegan' || lower === 'vgn') {
    label = 'V';
  } else if (lower === 'vegetarian' || lower === 'veg') {
    label = 'VG';
  } else if (lower === 'halal') {
    label = 'H';
    bg = '#E3F2FD';
    fg = '#1565C0';
  } else {
    label = flag.substring(0, 3).toUpperCase();
    bg = '#F3E5F5';
    fg = '#6A1B9A';
  }
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: fg }]}>{label}</Text>
    </View>
  );
}

function NutritionRow({ label, value, unit, bold }: { label: string; value: number | null; unit: string; bold?: boolean }) {
  if (value === null || value === undefined) return null;
  return (
    <View style={[styles.nutrRow, bold && styles.nutrRowBold]}>
      <Text style={[styles.nutrLabel, bold && { fontWeight: 'bold' }]}>{label}</Text>
      <Text style={[styles.nutrValue, bold && { fontWeight: 'bold' }]}>
        {value}
        {unit}
      </Text>
    </View>
  );
}

export default function MenuScreen() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [halls, setHalls] = useState<DiningHall[]>([]);
  const [selectedHall, setSelectedHall] = useState<DiningHall | null>(null);
  const [selectedMeal, setSelectedMeal] = useState(getCurrentMeal);
  const [dayOffset, setDayOffset] = useState(0);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Detail modal
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [servings, setServings] = useState(1);
  const [logging, setLogging] = useState(false);

  useEffect(() => {
    fetchDiningHalls();
  }, []);

  useEffect(() => {
    if (selectedHall) fetchMenu();
  }, [selectedHall, selectedMeal, dayOffset]);

  const fetchDiningHalls = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('dining_halls')
        .select('*')
        .order('name');
      if (fetchError) throw fetchError;
      const hallList = (data || []) as DiningHall[];
      setHalls(hallList);
      const d2 = hallList.find((h) => h.location_num === '15');
      setSelectedHall(d2 || hallList[0] || null);
    } catch (e: any) {
      setError(e.message || "Couldn't load dining halls");
      setLoading(false);
    }
  };

  const fetchMenu = useCallback(async () => {
    if (!selectedHall) return;
    setLoading(true);
    setError(null);

    try {
      const date = getDateStr(dayOffset);
      const { data, error: fetchError } = await supabase
        .from('menu_items')
        .select('*, nutrition(*)')
        .eq('dining_hall_id', selectedHall.id)
        .eq('date', date)
        .eq('meal', selectedMeal)
        .order('station')
        .order('name');

      if (fetchError) throw fetchError;

      const parsed: MenuItem[] = (data || []).map((row: any) => {
        const nutr = Array.isArray(row.nutrition) ? row.nutrition[0] : row.nutrition;
        return { ...row, nutrition: nutr || null };
      });
      setItems(parsed);
    } catch (e: any) {
      setError(e.message || 'Failed to load menu');
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedHall, selectedMeal, dayOffset]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchMenu();
  };

  const filteredItems = search.trim()
    ? items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()))
    : items;

  const logMeal = async () => {
    if (!selectedItem) return;
    setLogging(true);
    try {
      const userId = await getUserId();
      const date = getDateStr(dayOffset);
      const { error: insertErr } = await supabase.from('meal_logs').insert({
        user_id: userId,
        menu_item_id: selectedItem.id,
        date,
        meal: selectedMeal,
        servings,
      });
      if (insertErr) throw insertErr;
      const cal = Math.round((selectedItem.nutrition?.calories || 0) * servings);
      Alert.alert('Logged!', `+${cal} cal`);
      setSelectedItem(null);
      setServings(1);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to log meal');
    } finally {
      setLogging(false);
    }
  };

  const meals = ['Breakfast', 'Lunch', 'Dinner'];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <Text style={styles.headerTitle}>{selectedHall?.name || 'Menu'}</Text>

        {/* Dining hall chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipScroll}
          contentContainerStyle={styles.chipRow}
        >
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

        {/* Date toggle */}
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterPill, dayOffset === 0 && styles.filterPillActive]}
            onPress={() => setDayOffset(0)}
          >
            <Text style={[styles.filterPillText, dayOffset === 0 && styles.filterPillTextActive]}>Today</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterPill, dayOffset === 1 && styles.filterPillActive]}
            onPress={() => setDayOffset(1)}
          >
            <Text style={[styles.filterPillText, dayOffset === 1 && styles.filterPillTextActive]}>Tomorrow</Text>
          </TouchableOpacity>
        </View>

        {/* Meal filter */}
        <View style={styles.filterRow}>
          {meals.map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.filterPill, selectedMeal === m && styles.filterPillActive]}
              onPress={() => setSelectedMeal(m)}
            >
              <Text style={[styles.filterPillText, selectedMeal === m && styles.filterPillTextActive]}>{m}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Search */}
        <TextInput
          style={styles.searchInput}
          placeholder="Search items..."
          placeholderTextColor="#999"
          value={search}
          onChangeText={setSearch}
        />

        {/* Content */}
        {error ? (
          <View style={styles.centerContent}>
            <Text style={styles.errorText}>{error}</Text>
            <Text style={styles.errorHint}>Pull down to retry</Text>
          </View>
        ) : loading ? (
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : filteredItems.length === 0 ? (
          <View style={styles.centerContent}>
            <Text style={styles.emptyText}>No menu available for this selection</Text>
          </View>
        ) : (
          <FlatList
            data={filteredItems}
            keyExtractor={(item) => item.id.toString()}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
            contentContainerStyle={{ paddingBottom: 16 }}
            renderItem={({ item }) => {
              const n = item.nutrition;
              return (
                <TouchableOpacity style={styles.itemCard} onPress={() => { setSelectedItem(item); setServings(1); }}>
                  <View style={styles.itemTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemName}>{item.name}</Text>
                      <Text style={styles.itemStation}>{item.station || 'General'}</Text>
                    </View>
                    <Text style={styles.itemCalories}>{n?.calories ?? '—'}</Text>
                    <Text style={styles.itemCalLabel}>cal</Text>
                  </View>

                  {n && (
                    <View style={styles.macroRow}>
                      <Text style={[styles.macroChip, { color: Colors.protein }]}>P: {n.protein_g ?? 0}g</Text>
                      <Text style={[styles.macroChip, { color: Colors.carbs }]}>C: {n.total_carbs_g ?? 0}g</Text>
                      <Text style={[styles.macroChip, { color: '#C5A000' }]}>F: {n.total_fat_g ?? 0}g</Text>
                    </View>
                  )}

                  {item.dietary_flags && item.dietary_flags.length > 0 && (
                    <View style={styles.badgeRow}>
                      {item.dietary_flags.map((f, i) => (
                        <DietaryBadge key={i} flag={f} />
                      ))}
                    </View>
                  )}

                  {item.allergens && item.allergens.length > 0 && (
                    <Text style={styles.allergenText}>Allergens: {item.allergens.join(', ')}</Text>
                  )}
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>

      {/* Detail Bottom Sheet Modal */}
      <Modal visible={!!selectedItem} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Handle */}
              <View style={styles.modalHandle} />

              <Text style={styles.modalTitle}>{selectedItem?.name}</Text>
              {selectedItem?.station && (
                <Text style={styles.modalStation}>{selectedItem.station}</Text>
              )}

              {selectedItem?.nutrition && (
                <View style={styles.nutritionCard}>
                  <Text style={styles.nutritionHeader}>Nutrition Facts</Text>
                  {selectedItem.serving_size && (
                    <Text style={styles.servingSizeText}>
                      Serving: {selectedItem.serving_size} {selectedItem.serving_unit || ''}
                    </Text>
                  )}
                  <View style={styles.nutrDividerThick} />
                  <NutritionRow label="Calories" value={selectedItem.nutrition.calories} unit="" bold />
                  <View style={styles.nutrDivider} />
                  <NutritionRow label="Total Fat" value={selectedItem.nutrition.total_fat_g} unit="g" bold />
                  <NutritionRow label="  Saturated Fat" value={selectedItem.nutrition.sat_fat_g} unit="g" />
                  <NutritionRow label="  Trans Fat" value={selectedItem.nutrition.trans_fat_g} unit="g" />
                  <NutritionRow label="Cholesterol" value={selectedItem.nutrition.cholesterol_mg} unit="mg" bold />
                  <NutritionRow label="Sodium" value={selectedItem.nutrition.sodium_mg} unit="mg" bold />
                  <NutritionRow label="Total Carbs" value={selectedItem.nutrition.total_carbs_g} unit="g" bold />
                  <NutritionRow label="  Dietary Fiber" value={selectedItem.nutrition.dietary_fiber_g} unit="g" />
                  <NutritionRow label="  Sugars" value={selectedItem.nutrition.sugars_g} unit="g" />
                  <NutritionRow label="  Added Sugars" value={selectedItem.nutrition.added_sugars_g} unit="g" />
                  <NutritionRow label="Protein" value={selectedItem.nutrition.protein_g} unit="g" bold />
                  <View style={styles.nutrDividerThick} />
                  <NutritionRow label="Vitamin D" value={selectedItem.nutrition.vitamin_d_mcg} unit="mcg" />
                  <NutritionRow label="Calcium" value={selectedItem.nutrition.calcium_mg} unit="mg" />
                  <NutritionRow label="Iron" value={selectedItem.nutrition.iron_mg} unit="mg" />
                  <NutritionRow label="Potassium" value={selectedItem.nutrition.potassium_mg} unit="mg" />

                  {selectedItem.nutrition.ingredients && (
                    <View style={{ marginTop: 12 }}>
                      <Text style={{ fontWeight: 'bold', fontSize: 13, color: Colors.textPrimary, marginBottom: 4 }}>
                        Ingredients
                      </Text>
                      <Text style={{ fontSize: 12, color: Colors.textSecondary, lineHeight: 18 }}>
                        {selectedItem.nutrition.ingredients}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {selectedItem?.allergens && selectedItem.allergens.length > 0 && (
                <View style={styles.allergenSection}>
                  <Text style={styles.allergenSectionTitle}>Allergens</Text>
                  <Text style={styles.allergenSectionText}>{selectedItem.allergens.join(', ')}</Text>
                </View>
              )}

              {/* Servings selector */}
              <Text style={styles.servingsLabel}>Servings</Text>
              <View style={styles.servingsRow}>
                {[0.5, 1, 1.5, 2].map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.servingsBtn, servings === s && styles.servingsBtnActive]}
                    onPress={() => setServings(s)}
                  >
                    <Text style={[styles.servingsBtnText, servings === s && styles.servingsBtnTextActive]}>
                      {s}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {selectedItem?.nutrition?.calories != null && (
                <Text style={styles.totalCalText}>
                  Total: {Math.round(selectedItem.nutrition.calories * servings)} cal
                </Text>
              )}

              <TouchableOpacity
                style={[styles.logButton, logging && { opacity: 0.6 }]}
                onPress={logMeal}
                disabled={logging}
              >
                <Text style={styles.logButtonText}>{logging ? 'Logging...' : 'Log This Meal'}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => { setSelectedItem(null); setServings(1); }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <View style={{ height: 32 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1, padding: 16 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: Colors.textPrimary, marginBottom: 8 },
  chipScroll: { maxHeight: 40, marginBottom: 10 },
  chipRow: { gap: 8, paddingRight: 8 },
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
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterPillActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterPillText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  filterPillTextActive: { color: '#fff' },
  searchInput: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
  },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: Colors.error, fontWeight: '600', fontSize: 14 },
  errorHint: { color: Colors.error, fontSize: 12, marginTop: 4 },
  emptyText: { fontSize: 15, color: Colors.textSecondary },
  itemCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  itemTop: { flexDirection: 'row', alignItems: 'center' },
  itemName: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  itemStation: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  itemCalories: { fontSize: 20, fontWeight: 'bold', color: Colors.primary, marginLeft: 8 },
  itemCalLabel: { fontSize: 12, color: Colors.textSecondary, marginLeft: 2 },
  macroRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  macroChip: { fontSize: 13, fontWeight: '600' },
  badgeRow: { flexDirection: 'row', gap: 6, marginTop: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  badgeText: { fontSize: 11, fontWeight: 'bold' },
  allergenText: { fontSize: 11, color: Colors.textSecondary, fontStyle: 'italic', marginTop: 4 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    padding: 20,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#DDD',
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.textPrimary },
  modalStation: { fontSize: 13, color: Colors.textSecondary, marginTop: 2, marginBottom: 12 },
  nutritionCard: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
  },
  nutritionHeader: { fontSize: 18, fontWeight: 'bold', color: Colors.textPrimary, marginBottom: 4 },
  servingSizeText: { fontSize: 13, color: Colors.textSecondary, marginBottom: 4 },
  nutrRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  nutrRowBold: { borderBottomWidth: 1, borderBottomColor: '#E0E0E0', paddingBottom: 4, marginBottom: 2 },
  nutrLabel: { fontSize: 13, color: Colors.textPrimary },
  nutrValue: { fontSize: 13, color: Colors.textPrimary },
  nutrDivider: { height: 1, backgroundColor: '#E0E0E0', marginVertical: 4 },
  nutrDividerThick: { height: 3, backgroundColor: Colors.textPrimary, marginVertical: 6 },
  allergenSection: { marginTop: 12 },
  allergenSectionTitle: { fontWeight: 'bold', fontSize: 14, color: Colors.textPrimary },
  allergenSectionText: { fontSize: 13, color: Colors.error, marginTop: 2 },
  servingsLabel: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary, marginTop: 16, marginBottom: 8 },
  servingsRow: { flexDirection: 'row', gap: 10 },
  servingsBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  servingsBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  servingsBtnText: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
  servingsBtnTextActive: { color: '#fff' },
  totalCalText: {
    textAlign: 'center',
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 10,
  },
  logButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  logButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  cancelButton: {
    padding: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  cancelButtonText: { color: Colors.textSecondary, fontSize: 15 },
});
