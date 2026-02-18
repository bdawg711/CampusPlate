import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { useTheme } from '@/src/context/ThemeContext';
import { requireUserId } from '@/src/utils/auth';
import { supabase } from '@/src/utils/supabase';

function getLocalDate(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function autoMeal(): string {
  const h = new Date().getHours();
  const m = new Date().getMinutes();
  if (h < 10 || (h === 10 && m < 30)) return 'Breakfast';
  if (h < 16) return 'Lunch';
  return 'Dinner';
}

const STATION_EMOJIS: Record<string, string> = {
  grill: '🔥', pizza: '🍕', salad: '🥗', deli: '🥪', soup: '🍲',
  pasta: '🍝', asian: '🍜', mexican: '🌮', chicken: '🍗', bakery: '🧁',
  breakfast: '🥞', sushi: '🍣', sandwich: '🥪', burger: '🍔', bbq: '🍖',
  default: '🍴',
};

function getStationEmoji(name: string): string {
  const lower = name.toLowerCase();
  for (const [key, emoji] of Object.entries(STATION_EMOJIS)) {
    if (key !== 'default' && lower.includes(key)) return emoji;
  }
  return STATION_EMOJIS.default;
}

type ViewState = 'halls' | 'stations' | 'items' | 'detail';

export default function BrowseScreen() {
  const { colors } = useTheme();
  const [view, setView] = useState<ViewState>('halls');
  const [dayOffset, setDayOffset] = useState(0);
  const [meal, setMeal] = useState(autoMeal);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);

  // Data
  const [halls, setHalls] = useState<any[]>([]);
  const [selectedHall, setSelectedHall] = useState<any>(null);
  const [stations, setStations] = useState<{ name: string; count: number }[]>([]);
  const [selectedStation, setSelectedStation] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [servings, setServings] = useState(1);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [logging, setLogging] = useState(false);
  const [logSuccess, setLogSuccess] = useState(false);
  const [cameFromSearch, setCameFromSearch] = useState(false);

  const date = getLocalDate(dayOffset);

  const loadHalls = useCallback(async () => {
    try {
      const { data: hallData } = await supabase
        .from('dining_halls')
        .select('id, name, location_num')
        .order('name');

      if (!hallData) { setHalls([]); return; }

      const { data: itemCounts } = await supabase
        .from('menu_items')
        .select('dining_hall_id, id')
        .eq('date', date)
        .eq('meal', meal);

      const counts: Record<number, number> = {};
      (itemCounts || []).forEach((i: any) => {
        counts[i.dining_hall_id] = (counts[i.dining_hall_id] || 0) + 1;
      });

      setHalls(hallData.map((h: any) => ({ ...h, count: counts[h.id] || 0 })));
    } catch (e) {
      console.error('Load halls error:', e);
    } finally {
      setLoading(false);
    }
  }, [date, meal]);

  useFocusEffect(useCallback(() => {
    setView('halls');
    setSearch('');
    loadHalls();
  }, [loadHalls]));

  const onRefresh = async () => {
    setRefreshing(true);
    await loadHalls();
    setRefreshing(false);
  };

  // Search
  useEffect(() => {
    if (search.length < 2) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      try {
        const { data } = await supabase
          .from('menu_items')
          .select('id, name, station, dining_hall_id, dining_halls(name), nutrition(*), dietary_flags')
          .eq('date', date)
          .eq('meal', meal)
          .ilike('name', `%${search}%`)
          .limit(30);
        setSearchResults(data || []);
      } catch { setSearchResults([]); }
    }, 300);
    return () => clearTimeout(timer);
  }, [search, date, meal]);

  const openHall = async (hall: any) => {
    setSelectedHall(hall);
    setView('stations');
    try {
      const { data } = await supabase
        .from('menu_items')
        .select('station')
        .eq('dining_hall_id', hall.id)
        .eq('date', date)
        .eq('meal', meal);

      const stationMap: Record<string, number> = {};
      (data || []).forEach((i: any) => {
        const s = i.station || 'Other';
        stationMap[s] = (stationMap[s] || 0) + 1;
      });
      setStations(Object.entries(stationMap).map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name)));
    } catch (e) {
      console.error('Load stations error:', e);
    }
  };

  const openStation = async (stationName: string) => {
    setSelectedStation(stationName);
    setView('items');
    try {
      const { data } = await supabase
        .from('menu_items')
        .select('id, name, station, dietary_flags, nutrition(*)')
        .eq('dining_hall_id', selectedHall?.id)
        .eq('date', date)
        .eq('meal', meal)
        .eq('station', stationName)
        .order('name');
      setItems(data || []);
    } catch (e) {
      console.error('Load items error:', e);
    }
  };

  const openDetail = (item: any) => {
    setSelectedItem(item);
    setServings(1);
    setLogSuccess(false);
    setView('detail');
  };

  const logMeal = async () => {
    if (!selectedItem) return;
    setLogging(true);
    try {
      const userId = await requireUserId();
      await supabase.from('meal_logs').insert({
        user_id: userId,
        menu_item_id: selectedItem.id,
        date,
        meal,
        servings,
      });
      setLogSuccess(true);
      setTimeout(() => {
        setView('items');
        setLogSuccess(false);
      }, 800);
    } catch (e) {
      console.error('Log error:', e);
    } finally {
      setLogging(false);
    }
  };

  const goBack = () => {
    if (view === 'detail') {
      if (cameFromSearch) {
        setView('halls');
        setCameFromSearch(false);
      } else {
        setView('items');
      }
    }
    else if (view === 'items') setView('stations');
    else if (view === 'stations') setView('halls');
  };

  const getNutr = (item: any) => {
    const n = Array.isArray(item.nutrition) ? item.nutrition[0] : item.nutrition;
    return {
      cal: n?.calories || 0,
      pro: n?.protein_g || 0,
      carb: n?.total_carbs_g || 0,
      fat: n?.total_fat_g || 0,
      sat_fat: n?.saturated_fat_g || 0,
      trans_fat: n?.trans_fat_g || 0,
      cholesterol: n?.cholesterol_mg || 0,
      sodium: n?.sodium_mg || 0,
      fiber: n?.dietary_fiber_g || 0,
      sugars: n?.sugars_g || 0,
      added_sugars: n?.added_sugars_g || 0,
      vitamin_d: n?.vitamin_d_mcg || 0,
      calcium: n?.calcium_mg || 0,
      iron: n?.iron_mg || 0,
      potassium: n?.potassium_mg || 0,
    };
  };

  const getDietaryBadge = (flags: string[] | null) => {
    if (!flags || flags.length === 0) return null;
    if (flags.includes('vegan')) return { text: 'VG', color: colors.green };
    if (flags.includes('vegetarian')) return { text: 'V', color: colors.green };
    if (flags.includes('halal')) return { text: 'H', color: colors.blue };
    return null;
  };

  const getDotColor = (flags: string[] | null) => {
    if (!flags) return 'transparent';
    if (flags.includes('vegan') || flags.includes('vegetarian')) return colors.green;
    if (flags.includes('halal')) return colors.blue;
    return 'transparent';
  };

  const hallEmojis = ['🏛️', '🍔', '🍗', '🌮', '🎓', '🏢'];

  // ─── RENDER ────────────────────────────────────

  const renderHeader = () => (
    <View style={st.headerRow}>
      {view !== 'halls' && (
        <TouchableOpacity onPress={goBack} style={st.backBtn}>
          <Text style={[{ fontSize: 20, color: colors.text }]}>←</Text>
        </TouchableOpacity>
      )}
      <View style={{ flex: 1 }}>
        {view === 'halls' && <Text style={[st.title, { color: colors.text, fontFamily: 'Outfit_700Bold' }]}>Log a Meal</Text>}
        {view === 'stations' && (
          <>
            <Text style={[st.title, { color: colors.text, fontFamily: 'Outfit_700Bold' }]}>{selectedHall?.name}</Text>
            <Text style={[{ fontSize: 13, color: colors.textMuted, fontFamily: 'DMSans_400Regular' }]}>{meal} · {dayOffset === 0 ? 'Today' : 'Tomorrow'}</Text>
          </>
        )}
        {view === 'items' && (
          <>
            <Text style={[st.title, { color: colors.text, fontFamily: 'Outfit_700Bold' }]}>{getStationEmoji(selectedStation)} {selectedStation}</Text>
            <Text style={[{ fontSize: 13, color: colors.textMuted, fontFamily: 'DMSans_400Regular' }]}>{selectedHall?.name} · {meal}</Text>
          </>
        )}
        {view === 'detail' && <Text style={[st.title, { color: colors.text, fontFamily: 'Outfit_700Bold' }]} numberOfLines={1}>{selectedItem?.name}</Text>}
      </View>
      {view === 'halls' && (
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {[{ label: 'Today', val: 0 }, { label: 'Tomorrow', val: 1 }].map((d) => (
            <TouchableOpacity
              key={d.val}
              style={[st.chip, { backgroundColor: dayOffset === d.val ? colors.maroon : colors.card, borderColor: dayOffset === d.val ? colors.maroon : colors.border, borderWidth: 1 }]}
              onPress={() => setDayOffset(d.val)}
            >
              <Text style={[st.chipText, { color: dayOffset === d.val ? '#fff' : colors.text, fontFamily: 'DMSans_600SemiBold' }]}>{d.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );

  const renderSearchBar = () => {
    const placeholder = view === 'halls'
      ? '🔍 Search any item across all halls...'
      : `🔍 Search in ${selectedHall?.name || ''}...`;
    return (
      <TextInput
        style={[st.searchInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text, fontFamily: 'DMSans_400Regular' }]}
        placeholder={placeholder}
        placeholderTextColor={colors.textDim}
        value={search}
        onChangeText={setSearch}
      />
    );
  };

  const renderMealFilter = () => (
    <View style={[st.filterRow, { marginBottom: 16 }]}>
      {['Breakfast', 'Lunch', 'Dinner'].map((m) => (
        <TouchableOpacity
          key={m}
          style={[st.filterChip, { backgroundColor: meal === m ? colors.maroon : colors.card, borderColor: meal === m ? colors.maroon : colors.border, borderWidth: 1 }]}
          onPress={() => setMeal(m)}
        >
          <Text style={[st.filterChipText, { color: meal === m ? '#fff' : colors.text, fontFamily: 'DMSans_600SemiBold' }]}>{m}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  // Search results
  if (search.length >= 2 && view === 'halls') {
    return (
      <SafeAreaView style={[st.safe, { backgroundColor: colors.background }]}>
        <View style={st.pad}>
          {renderHeader()}
          {renderSearchBar()}
        </View>
        <ScrollView contentContainerStyle={st.pad}>
          {searchResults.length === 0 ? (
            <View style={{ alignItems: 'center', paddingTop: 40 }}>
              <Text style={{ fontSize: 32 }}>🔍</Text>
              <Text style={[{ fontSize: 14, color: colors.textMuted, marginTop: 8, fontFamily: 'DMSans_400Regular' }]}>No results for "{search}"</Text>
            </View>
          ) : (
            searchResults.map((item) => {
              const n = getNutr(item);
              const hallName = item.dining_halls?.name || '';
              return (
                <TouchableOpacity key={item.id} style={[st.foodRow, { borderBottomColor: colors.border }]} onPress={() => {
                  setSelectedItem(item);
                  setSelectedHall({ name: hallName });
                  setServings(1);
                  setLogSuccess(false);
                  setCameFromSearch(true);
                  setView('detail');
                  setSearch('');
                }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[{ fontSize: 15, color: colors.text, fontFamily: 'DMSans_600SemiBold' }]}>{item.name}</Text>
                    <Text style={[{ fontSize: 12, color: colors.textMuted, fontFamily: 'DMSans_400Regular' }]}>{hallName} · {item.station}</Text>
                  </View>
                  <Text style={[{ fontSize: 18, color: colors.text, fontFamily: 'Outfit_700Bold' }]}>{n.cal}</Text>
                  <Text style={[{ fontSize: 11, color: colors.textMuted, marginLeft: 2, fontFamily: 'DMSans_400Regular' }]}>cal</Text>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Halls view
  if (view === 'halls') {
    return (
      <SafeAreaView style={[st.safe, { backgroundColor: colors.background }]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.maroon} />}
          contentContainerStyle={st.pad}
        >
          {renderHeader()}
          {renderSearchBar()}
          {renderMealFilter()}

          {loading ? (
            <View style={{ paddingTop: 40, alignItems: 'center' }}><ActivityIndicator size="large" color={colors.maroon} /></View>
          ) : halls.length === 0 ? (
            <View style={{ alignItems: 'center', paddingTop: 40 }}>
              <Text style={{ fontSize: 32 }}>🏛️</Text>
              <Text style={[{ fontSize: 14, color: colors.textMuted, marginTop: 8, fontFamily: 'DMSans_400Regular' }]}>No halls found</Text>
            </View>
          ) : (
            halls.map((hall, i) => (
              <TouchableOpacity
                key={hall.id}
                style={[st.hallCard, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}
                onPress={() => openHall(hall)}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 36, marginRight: 14 }}>{hallEmojis[i] || '🏛️'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[{ fontSize: 18, color: colors.text, fontFamily: 'Outfit_700Bold' }]}>{hall.name}</Text>
                  <Text style={[{ fontSize: 12, color: colors.textMuted, fontFamily: 'DMSans_400Regular', marginTop: 2 }]}>{hall.count} items</Text>
                </View>
                {hall.count > 0 && (
                  <View style={[st.countBadge, { backgroundColor: colors.maroon }]}>
                    <Text style={[{ fontSize: 11, color: '#fff', fontFamily: 'DMSans_700Bold' }]}>{hall.count}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Stations view
  if (view === 'stations') {
    return (
      <SafeAreaView style={[st.safe, { backgroundColor: colors.background }]}>
        <ScrollView contentContainerStyle={st.pad} showsVerticalScrollIndicator={false}>
          {renderHeader()}
          <TextInput
            style={[st.searchInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text, fontFamily: 'DMSans_400Regular' }]}
            placeholder={`🔍 Search in ${selectedHall?.name}...`}
            placeholderTextColor={colors.textDim}
            value={search}
            onChangeText={setSearch}
          />
          {stations.length === 0 ? (
            <View style={{ alignItems: 'center', paddingTop: 40 }}>
              <Text style={{ fontSize: 32 }}>🍽️</Text>
              <Text style={[{ fontSize: 14, color: colors.textMuted, marginTop: 8, fontFamily: 'DMSans_400Regular' }]}>No stations for this meal</Text>
            </View>
          ) : (
            <View style={st.stationGrid}>
              {stations.map((s) => (
                <TouchableOpacity
                  key={s.name}
                  style={[st.stationCard, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}
                  onPress={() => openStation(s.name)}
                >
                  <Text style={{ fontSize: 28, marginBottom: 8 }}>{getStationEmoji(s.name)}</Text>
                  <Text style={[{ fontSize: 13, color: colors.text, fontFamily: 'DMSans_600SemiBold', textAlign: 'center' }]} numberOfLines={2}>{s.name}</Text>
                  <Text style={[{ fontSize: 11, color: colors.textMuted, fontFamily: 'DMSans_400Regular', marginTop: 4 }]}>{s.count} items</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Items view
  if (view === 'items') {
    return (
      <SafeAreaView style={[st.safe, { backgroundColor: colors.background }]}>
        <ScrollView contentContainerStyle={st.pad} showsVerticalScrollIndicator={false}>
          {renderHeader()}
          {items.length === 0 ? (
            <View style={{ alignItems: 'center', paddingTop: 40 }}>
              <Text style={{ fontSize: 32 }}>🍽️</Text>
              <Text style={[{ fontSize: 14, color: colors.textMuted, marginTop: 8, fontFamily: 'DMSans_400Regular' }]}>No items found</Text>
            </View>
          ) : (
            items.map((item, i) => {
              const n = getNutr(item);
              const badge = getDietaryBadge(item.dietary_flags);
              return (
                <TouchableOpacity key={item.id} onPress={() => openDetail(item)}>
                  <View style={st.itemRow}>
                    <View style={[st.itemDot, { backgroundColor: getDotColor(item.dietary_flags) }]} />
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={[{ fontSize: 15, color: colors.text, fontFamily: 'DMSans_600SemiBold' }]} numberOfLines={1}>{item.name}</Text>
                        {badge && (
                          <View style={[st.badge, { backgroundColor: badge.color + '22' }]}>
                            <Text style={[{ fontSize: 10, color: badge.color, fontFamily: 'DMSans_700Bold' }]}>{badge.text}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[{ fontSize: 12, color: colors.textMuted, fontFamily: 'DMSans_400Regular', marginTop: 2 }]}>
                        P: {n.pro}g · C: {n.carb}g · F: {n.fat}g
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[{ fontSize: 18, color: colors.text, fontFamily: 'Outfit_700Bold' }]}>{n.cal}</Text>
                      <Text style={[{ fontSize: 11, color: colors.textMuted, fontFamily: 'DMSans_400Regular' }]}>cal</Text>
                    </View>
                  </View>
                  {i < items.length - 1 && <View style={[st.divider, { backgroundColor: colors.border }]} />}
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Detail view
  if (view === 'detail' && selectedItem) {
    const n = getNutr(selectedItem);
    const badge = getDietaryBadge(selectedItem.dietary_flags);
    const adjCal = Math.round(n.cal * servings);

    const nutritionGrid = [
      { label: 'Total Fat', val: `${Math.round(n.fat * servings)}g` },
      { label: 'Sat Fat', val: `${Math.round(n.sat_fat * servings)}g` },
      { label: 'Trans Fat', val: `${Math.round(n.trans_fat * servings)}g` },
      { label: 'Cholesterol', val: `${Math.round(n.cholesterol * servings)}mg` },
      { label: 'Sodium', val: `${Math.round(n.sodium * servings)}mg` },
      { label: 'Total Carbs', val: `${Math.round(n.carb * servings)}g` },
      { label: 'Fiber', val: `${Math.round(n.fiber * servings)}g` },
      { label: 'Sugars', val: `${Math.round(n.sugars * servings)}g` },
      { label: 'Added Sugars', val: `${Math.round(n.added_sugars * servings)}g` },
      { label: 'Protein', val: `${Math.round(n.pro * servings)}g` },
      { label: 'Vitamin D', val: `${Math.round(n.vitamin_d * servings)}mcg` },
      { label: 'Calcium', val: `${Math.round(n.calcium * servings)}mg` },
      { label: 'Iron', val: `${Math.round(n.iron * servings)}mg` },
      { label: 'Potassium', val: `${Math.round(n.potassium * servings)}mg` },
    ];

    return (
      <SafeAreaView style={[st.safe, { backgroundColor: colors.background }]}>
        <ScrollView contentContainerStyle={[st.pad, { paddingBottom: 100 }]} showsVerticalScrollIndicator={false}>
          {renderHeader()}

          {/* Top card */}
          <View style={[st.detailCard, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
            <Text style={[{ fontSize: 12, color: colors.textMuted, textAlign: 'center', fontFamily: 'DMSans_400Regular' }]}>
              {selectedItem.station} · {selectedHall?.name}
            </Text>
            <Text style={[{ fontSize: 42, color: colors.text, textAlign: 'center', fontFamily: 'Outfit_800ExtraBold', marginVertical: 8 }]}>
              {adjCal}
            </Text>
            <Text style={[{ fontSize: 13, color: colors.textMuted, textAlign: 'center', fontFamily: 'DMSans_400Regular' }]}>
              calories per serving
            </Text>
            <View style={st.macroRow}>
              {[
                { label: 'Protein', val: `${Math.round(n.pro * servings)}g`, color: colors.blue },
                { label: 'Carbs', val: `${Math.round(n.carb * servings)}g`, color: colors.orange },
                { label: 'Fat', val: `${Math.round(n.fat * servings)}g`, color: colors.yellow },
              ].map((m) => (
                <View key={m.label} style={{ alignItems: 'center' }}>
                  <Text style={[{ fontSize: 20, color: m.color, fontFamily: 'Outfit_700Bold' }]}>{m.val}</Text>
                  <Text style={[{ fontSize: 11, color: colors.textMuted, fontFamily: 'DMSans_400Regular', marginTop: 2 }]}>{m.label}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Servings */}
          <View style={{ marginTop: 20 }}>
            <Text style={[{ fontSize: 14, color: colors.text, fontFamily: 'DMSans_600SemiBold', marginBottom: 10 }]}>Servings</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[0.5, 1, 1.5, 2].map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[st.servingChip, { backgroundColor: servings === s ? colors.maroon : colors.card, borderColor: servings === s ? colors.maroon : colors.border, borderWidth: 1 }]}
                  onPress={() => setServings(s)}
                >
                  <Text style={[{ fontSize: 14, color: servings === s ? '#fff' : colors.text, fontFamily: 'DMSans_600SemiBold' }]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Nutrition grid */}
          <View style={st.nutritionGrid}>
            {nutritionGrid.map((item) => (
              <View key={item.label} style={[st.nutritionCell, { backgroundColor: colors.cardAlt }]}>
                <Text style={[{ fontSize: 18, color: colors.text, fontFamily: 'Outfit_700Bold' }]}>{item.val}</Text>
                <Text style={[{ fontSize: 11, color: colors.textMuted, fontFamily: 'DMSans_400Regular', marginTop: 2 }]}>{item.label}</Text>
              </View>
            ))}
          </View>

          {/* Dietary badges */}
          {selectedItem.dietary_flags && selectedItem.dietary_flags.length > 0 && (
            <View style={[st.flagRow, { marginTop: 16 }]}>
              {selectedItem.dietary_flags.map((flag: string) => (
                <View key={flag} style={[st.flagPill, { backgroundColor: colors.green + '22' }]}>
                  <Text style={[{ fontSize: 12, color: colors.green, fontFamily: 'DMSans_600SemiBold' }]}>{flag}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Ingredients */}
          {selectedItem.ingredients && (
            <View style={[st.ingredientCard, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
              <Text style={[{ fontSize: 13, color: colors.text, fontFamily: 'DMSans_600SemiBold', marginBottom: 8 }]}>Ingredients</Text>
              <Text style={[{ fontSize: 12, color: colors.textMuted, fontFamily: 'DMSans_400Regular', lineHeight: 18 }]}>{selectedItem.ingredients}</Text>
            </View>
          )}
        </ScrollView>

        {/* Fixed footer */}
        <View style={[st.footer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
          <Text style={[{ fontSize: 13, color: colors.textMuted, textAlign: 'center', marginBottom: 10, fontFamily: 'DMSans_400Regular' }]}>
            {adjCal} cal · {servings} serving{servings !== 1 ? 's' : ''}
          </Text>
          <TouchableOpacity
            style={[st.logBtn, { backgroundColor: logSuccess ? colors.green : colors.orange, opacity: logging ? 0.6 : 1 }]}
            onPress={logMeal}
            disabled={logging || logSuccess}
          >
            {logging ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={[{ fontSize: 16, color: '#fff', fontFamily: 'DMSans_700Bold' }]}>
                {logSuccess ? 'Logged! ✓' : 'Log This Meal ✓'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return null;
}

const st = StyleSheet.create({
  safe: { flex: 1 },
  pad: { padding: 20, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  title: { fontSize: 26 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 24 },
  chipText: { fontSize: 12 },
  searchInput: { borderRadius: 12, padding: 14, fontSize: 15, borderWidth: 1, marginBottom: 16 },
  filterRow: { flexDirection: 'row', gap: 8 },
  filterChip: { flex: 1, paddingVertical: 10, borderRadius: 24, alignItems: 'center' },
  filterChipText: { fontSize: 13 },
  hallCard: { flexDirection: 'row', alignItems: 'center', padding: 20, borderRadius: 20, marginBottom: 12 },
  countBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, position: 'absolute', top: 12, right: 12 },
  stationGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  stationCard: { width: '48%', padding: 16, borderRadius: 14, alignItems: 'center' },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  itemDot: { width: 8, height: 8, borderRadius: 4, marginRight: 12 },
  badge: { marginLeft: 6, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  divider: { height: 1, marginLeft: 20 },
  detailCard: { borderRadius: 14, padding: 24, marginTop: 8 },
  macroRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 20 },
  servingChip: { flex: 1, paddingVertical: 10, borderRadius: 24, alignItems: 'center' },
  nutritionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 20 },
  nutritionCell: { width: '48%', padding: 12, borderRadius: 10 },
  flagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  flagPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 24 },
  ingredientCard: { borderRadius: 14, padding: 16, marginTop: 16 },
  footer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24, borderTopWidth: 1 },
  logBtn: { padding: 16, borderRadius: 14, alignItems: 'center' },
  foodRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1 },
});
