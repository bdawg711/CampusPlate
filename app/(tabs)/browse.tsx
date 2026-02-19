import React, { useCallback, useRef, useState } from 'react';
import {
  Animated,
  Alert,
  Dimensions,
  Easing,
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
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/src/context/ThemeContext';
import { requireUserId } from '@/src/utils/auth';
import { supabase } from '@/src/utils/supabase';
import { getMealQueryValues, getCurrentMealPeriod } from '@/src/utils/meals';
import { toggleFavorite, getFavorites } from '@/src/utils/favorites';
import { getHallAverages, HallAverage } from '@/src/utils/ratings';
import Skeleton from '@/src/components/Skeleton';

const SCREEN_WIDTH = Dimensions.get('window').width;

function getLocalDate(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function autoMeal(): string {
  return getCurrentMealPeriod();
}

const STATION_EMOJI_RULES: [string[], string][] = [
  [['grill', 'burger', 'chop'], '🔥'],
  [['salad', 'eden'], '🥗'],
  [['pizza', 'mangia'], '🍕'],
  [['deli', 'sandwich'], '🥪'],
  [['pasta', 'noodle'], '🍝'],
  [['sushi', 'origami', 'asian'], '🍣'],
  [['mexican', 'salsa', 'qdoba', 'taco'], '🌮'],
  [['bakery', 'patisserie', 'sweets', 'dessert'], '🧁'],
  [['soup'], '🍜'],
  [['chicken', 'chick-fil'], '🍗'],
  [['coffee', 'dunkin', 'juice', 'smoothie', 'jamba'], '☕'],
  [['bbq', 'smoke'], '🍖'],
  [['breakfast', 'waffle', 'pancake', 'egg'], '🍳'],
  [['byo', 'bowl'], '🥣'],
  [['market', 'grab', 'express', 'dx'], '🏪'],
  [['corner'], '🍴'],
];

function getStationEmoji(stationName: string): string {
  const lower = stationName.toLowerCase();
  for (const [keywords, emoji] of STATION_EMOJI_RULES) {
    if (keywords.some((kw) => lower.includes(kw))) return emoji;
  }
  return '🍽️';
}

type ViewState = 'halls' | 'stations' | 'items' | 'detail';

// ─── Pressable card with spring scale effect ───
function PressableCard({ children, onPress, style, haptic = 'light' }: {
  children: React.ReactNode;
  onPress: () => void;
  style?: any;
  haptic?: 'light' | 'medium' | 'none';
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () => {
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  };

  const onPressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  };

  const handlePress = () => {
    if (haptic === 'light') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    else if (haptic === 'medium') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  return (
    <TouchableOpacity activeOpacity={1} onPress={handlePress} onPressIn={onPressIn} onPressOut={onPressOut}>
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
}

export default function BrowseScreen() {
  const { colors } = useTheme();
  const [view, setView] = useState<ViewState>('halls');
  const [dayOffset, setDayOffset] = useState(0);
  const [meal, setMeal] = useState(autoMeal);

  // Hall-level search — filters dining hall names only
  const [hallSearch, setHallSearch] = useState('');

  // Item-level search — filters items within the selected hall
  const [itemSearch, setItemSearch] = useState('');

  // Data
  const [halls, setHalls] = useState<any[]>([]);
  const [selectedHall, setSelectedHall] = useState<any>(null);
  const [allHallItems, setAllHallItems] = useState<any[]>([]);
  const [hallItemsLoading, setHallItemsLoading] = useState(false);
  const [selectedStation, setSelectedStation] = useState('');
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [servings, setServings] = useState(1);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [logging, setLogging] = useState(false);
  const [logSuccess, setLogSuccess] = useState(false);

  // Favorites
  const [favRecNums, setFavRecNums] = useState<Set<string>>(new Set());

  // Hall ratings
  const [hallRatings, setHallRatings] = useState<Record<number, HallAverage>>({});

  // ─── View transition animation ───
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // ─── Toast animation ───
  const toastAnim = useRef(new Animated.Value(-60)).current;
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const [toastCal, setToastCal] = useState(0);
  const [showToast, setShowToast] = useState(false);

  const animateTransition = (direction: 'forward' | 'back', callback: () => void) => {
    const exitX = direction === 'forward' ? -SCREEN_WIDTH * 0.3 : SCREEN_WIDTH * 0.3;
    const enterX = direction === 'forward' ? SCREEN_WIDTH * 0.3 : -SCREEN_WIDTH * 0.3;

    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 100, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: exitX, duration: 100, useNativeDriver: true }),
    ]).start(() => {
      callback();
      slideAnim.setValue(enterX);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 150, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    });
  };

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
        .in('meal', getMealQueryValues(meal));

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

  const loadFavorites = useCallback(async () => {
    try {
      const userId = await requireUserId();
      const favs = await getFavorites(userId);
      setFavRecNums(new Set(favs.map((f) => f.rec_num)));
    } catch {
      // Non-critical — heart icons just won't show filled state
    }
  }, []);

  const loadRatings = useCallback(async () => {
    try {
      const averages = await getHallAverages();
      setHallRatings(averages);
    } catch {
      // Non-critical — ratings just won't show
    }
  }, []);

  useFocusEffect(useCallback(() => {
    setView('halls');
    setHallSearch('');
    setItemSearch('');
    slideAnim.setValue(0);
    fadeAnim.setValue(1);
    loadHalls();
    loadFavorites();
    loadRatings();
  }, [loadHalls, loadFavorites, loadRatings]));

  const onRefresh = async () => {
    setRefreshing(true);
    await loadHalls();
    setRefreshing(false);
  };

  // ─── Open hall: loads ALL items for the hall at once ───
  const openHall = async (hall: any) => {
    animateTransition('forward', () => {
      setSelectedHall(hall);
      setItemSearch('');
      setAllHallItems([]);
      setView('stations');
    });
    setHallItemsLoading(true);
    try {
      const { data } = await supabase
        .from('menu_items')
        .select('id, name, rec_num, station, dietary_flags, nutrition(*)')
        .eq('dining_hall_id', hall.id)
        .eq('date', date)
        .in('meal', getMealQueryValues(meal))
        .order('name');
      setAllHallItems(data || []);
    } catch (e) {
      console.error('Load hall items error:', e);
    } finally {
      setHallItemsLoading(false);
    }
  };

  // ─── Open station: items already loaded in allHallItems ───
  const openStation = (stationName: string) => {
    animateTransition('forward', () => {
      setSelectedStation(stationName);
      setView('items');
    });
  };

  const openDetail = (item: any) => {
    animateTransition('forward', () => {
      setSelectedItem(item);
      setServings(1);
      setLogSuccess(false);
      setView('detail');
    });
  };

  const showLogToast = (calories: number) => {
    setToastCal(calories);
    setShowToast(true);
    toastAnim.setValue(-60);
    toastOpacity.setValue(0);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    Animated.parallel([
      Animated.spring(toastAnim, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 6 }),
      Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();

    setTimeout(() => {
      Animated.parallel([
        Animated.timing(toastAnim, { toValue: -60, duration: 300, useNativeDriver: true }),
        Animated.timing(toastOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start(() => setShowToast(false));
    }, 2000);
  };

  const logMeal = async () => {
    if (!selectedItem) return;
    setLogging(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const userId = await requireUserId();
      const { error } = await supabase.from('meal_logs').insert({
        user_id: userId,
        menu_item_id: selectedItem.id,
        date,
        meal,
        servings,
      });
      if (error) { console.error('Log meal failed:', error.message); Alert.alert('Error', 'Failed to save. Please try again.'); return; }
      setLogSuccess(true);
      const n = getNutr(selectedItem);
      showLogToast(Math.round(n.cal * servings));
      setTimeout(() => {
        animateTransition('back', () => {
          setView('items');
          setLogSuccess(false);
        });
      }, 800);
    } catch (e) {
      console.error('Log error:', e);
    } finally {
      setLogging(false);
    }
  };

  const goBack = () => {
    animateTransition('back', () => {
      if (view === 'detail') {
        setView('items');
      } else if (view === 'items') {
        setView('stations');
      } else if (view === 'stations') {
        setItemSearch('');
        setView('halls');
      }
    });
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

  // ─── Derived: stations from allHallItems ───
  const derivedStations: { name: string; count: number }[] = (() => {
    const map: Record<string, number> = {};
    allHallItems.forEach((item) => {
      const s = item.station || 'Other';
      map[s] = (map[s] || 0) + 1;
    });
    return Object.entries(map)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  })();

  // ─── Derived: items for selected station, filtered by itemSearch ───
  const stationItems = allHallItems.filter((item) => item.station === selectedStation);

  const filteredStationItems = itemSearch
    ? stationItems.filter((item) => item.name.toLowerCase().includes(itemSearch.toLowerCase()))
    : stationItems;

  // ─── Derived: when searching across all stations ───
  const filteredAllItems = itemSearch
    ? allHallItems.filter((item) => item.name.toLowerCase().includes(itemSearch.toLowerCase()))
    : [];

  // Group filtered items by station for display
  const filteredByStation: { station: string; items: any[] }[] = (() => {
    const map: Record<string, any[]> = {};
    filteredAllItems.forEach((item) => {
      const s = item.station || 'Other';
      if (!map[s]) map[s] = [];
      map[s].push(item);
    });
    return Object.entries(map)
      .map(([station, items]) => ({ station, items }))
      .sort((a, b) => a.station.localeCompare(b.station));
  })();

  // ─── Filtered halls for hall-level search ───
  const filteredHalls = hallSearch
    ? halls.filter((h) => h.name.toLowerCase().includes(hallSearch.toLowerCase()))
    : halls;

  // ─── Toast overlay ───
  const renderToast = () => {
    if (!showToast) return null;
    return (
      <Animated.View style={[st.toast, {
        backgroundColor: colors.green,
        transform: [{ translateY: toastAnim }],
        opacity: toastOpacity,
      }]}>
        <Text style={st.toastText}>Logged! +{toastCal} cal</Text>
      </Animated.View>
    );
  };

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

  const renderMealFilter = () => (
    <View style={[st.filterRow, { marginBottom: 16 }]}>
      {['Breakfast', 'Lunch', 'Dinner'].map((m) => (
        <TouchableOpacity
          key={m}
          style={[st.filterChip, { backgroundColor: meal === m ? colors.maroon : colors.card, borderColor: meal === m ? colors.maroon : colors.border, borderWidth: 1 }]}
          onPress={() => {
            Haptics.selectionAsync();
            setMeal(m);
          }}
        >
          <Text style={[st.filterChipText, { color: meal === m ? '#fff' : colors.text, fontFamily: 'DMSans_600SemiBold' }]}>{m}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const wrapAnimated = (content: React.ReactNode) => (
    <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ translateX: slideAnim }] }}>
      {content}
    </Animated.View>
  );

  const handleToggleFavorite = async (item: any) => {
    if (!item.rec_num) return;
    const recNum = item.rec_num as string;
    // Optimistic update
    setFavRecNums((prev) => {
      const next = new Set(prev);
      if (next.has(recNum)) next.delete(recNum);
      else next.add(recNum);
      return next;
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const userId = await requireUserId();
      await toggleFavorite(userId, recNum, item.name);
    } catch {
      // Revert on failure
      setFavRecNums((prev) => {
        const next = new Set(prev);
        if (next.has(recNum)) next.delete(recNum);
        else next.add(recNum);
        return next;
      });
    }
  };

  const renderItemRow = (item: any, i: number, total: number) => {
    const n = getNutr(item);
    const badge = getDietaryBadge(item.dietary_flags);
    const isFav = !!item.rec_num && favRecNums.has(item.rec_num);
    return (
      <TouchableOpacity key={item.id} onPress={() => openDetail(item)}>
        <View style={st.itemRow}>
          <View style={[st.itemDot, { backgroundColor: getDotColor(item.dietary_flags) }]} />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[{ fontSize: 15, color: colors.text, fontFamily: 'DMSans_600SemiBold', flexShrink: 1 }]} numberOfLines={1}>{item.name}</Text>
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
          <TouchableOpacity
            onPress={() => handleToggleFavorite(item)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{ paddingHorizontal: 8 }}
          >
            <Text style={{ fontSize: 18 }}>{isFav ? '❤️' : '🤍'}</Text>
          </TouchableOpacity>
          <View style={{ alignItems: 'flex-end', minWidth: 40 }}>
            <Text style={[{ fontSize: 18, color: colors.text, fontFamily: 'Outfit_700Bold' }]}>{n.cal}</Text>
            <Text style={[{ fontSize: 11, color: colors.textMuted, fontFamily: 'DMSans_400Regular' }]}>cal</Text>
          </View>
        </View>
        {i < total - 1 && <View style={[st.divider, { backgroundColor: colors.border }]} />}
      </TouchableOpacity>
    );
  };

  // ── Halls view ──
  if (view === 'halls') {
    return (
      <SafeAreaView style={[st.safe, { backgroundColor: colors.background }]}>
        {renderToast()}
        {wrapAnimated(
          <ScrollView
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.maroon} />}
            contentContainerStyle={st.pad}
            keyboardShouldPersistTaps="handled"
          >
            {renderHeader()}

            {/* Hall-level search bar — filters hall names only */}
            <View style={[st.searchWrap, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
              <TextInput
                style={[st.searchInput, { color: colors.text, fontFamily: 'DMSans_400Regular' }]}
                placeholder="Search dining halls..."
                placeholderTextColor={colors.textDim}
                value={hallSearch}
                onChangeText={setHallSearch}
                returnKeyType="search"
              />
              {hallSearch.length > 0 && (
                <TouchableOpacity onPress={() => setHallSearch('')} style={st.clearBtn}>
                  <Text style={[{ fontSize: 14, color: colors.textMuted }]}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            {renderMealFilter()}

            {loading ? (
              <View style={{ gap: 12 }}>
                <Skeleton width={'100%'} height={80} borderRadius={20} />
                <Skeleton width={'100%'} height={80} borderRadius={20} />
                <Skeleton width={'100%'} height={80} borderRadius={20} />
                <Skeleton width={'100%'} height={80} borderRadius={20} />
              </View>
            ) : filteredHalls.length === 0 ? (
              <View style={{ alignItems: 'center', paddingTop: 40 }}>
                <Text style={{ fontSize: 32 }}>🏛️</Text>
                <Text style={[{ fontSize: 14, color: colors.textMuted, marginTop: 8, fontFamily: 'DMSans_400Regular' }]}>
                  {hallSearch ? `No dining halls match "${hallSearch}"` : 'No halls found'}
                </Text>
              </View>
            ) : (
              filteredHalls.map((hall, i) => {
                const rating = hallRatings[hall.id];
                return (
                  <PressableCard
                    key={hall.id}
                    onPress={() => openHall(hall)}
                    style={[st.hallCard, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}
                  >
                    <Text style={{ fontSize: 36, marginRight: 14 }}>{hallEmojis[i] || '🏛️'}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[{ fontSize: 18, color: colors.text, fontFamily: 'Outfit_700Bold' }]}>{hall.name}</Text>
                      <Text style={[{ fontSize: 12, color: colors.textMuted, fontFamily: 'DMSans_400Regular', marginTop: 2 }]}>{hall.count} items</Text>
                      {rating ? (
                        <Text style={[{ fontSize: 12, color: colors.textMuted, fontFamily: 'DMSans_400Regular', marginTop: 2 }]}>
                          ⭐ {rating.avg.toFixed(1)} · {rating.count} {rating.count === 1 ? 'rating' : 'ratings'}
                        </Text>
                      ) : (
                        <Text style={[{ fontSize: 11, color: colors.textMuted, fontFamily: 'DMSans_400Regular', marginTop: 2, opacity: 0.6 }]}>
                          No ratings yet
                        </Text>
                      )}
                    </View>
                    {hall.count > 0 && (
                      <View style={[st.countBadge, { backgroundColor: colors.maroon }]}>
                        <Text style={[{ fontSize: 11, color: '#fff', fontFamily: 'DMSans_700Bold' }]}>{hall.count}</Text>
                      </View>
                    )}
                  </PressableCard>
                );
              })
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    );
  }

  // ── Stations view ──
  if (view === 'stations') {
    return (
      <SafeAreaView style={[st.safe, { backgroundColor: colors.background }]}>
        {renderToast()}
        {wrapAnimated(
          <ScrollView contentContainerStyle={st.pad} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {renderHeader()}

            {/* Item-level search bar — always rendered at stable position */}
            <View style={[st.searchWrap, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
              <TextInput
                style={[st.searchInput, { color: colors.text, fontFamily: 'DMSans_400Regular' }]}
                placeholder="Search items..."
                placeholderTextColor={colors.textDim}
                value={itemSearch}
                onChangeText={setItemSearch}
                returnKeyType="search"
              />
              {itemSearch.length > 0 && (
                <TouchableOpacity onPress={() => setItemSearch('')} style={st.clearBtn}>
                  <Text style={[{ fontSize: 14, color: colors.textMuted }]}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Search active: show filtered items grouped by station */}
            {itemSearch.length > 0 ? (
              hallItemsLoading ? (
                <View style={{ gap: 12 }}>
                  <Skeleton width={'100%'} height={60} borderRadius={14} />
                  <Skeleton width={'100%'} height={60} borderRadius={14} />
                </View>
              ) : filteredByStation.length === 0 ? (
                <View style={{ alignItems: 'center', paddingTop: 40 }}>
                  <Text style={{ fontSize: 32 }}>🔍</Text>
                  <Text style={[{ fontSize: 14, color: colors.textMuted, marginTop: 8, fontFamily: 'DMSans_400Regular' }]}>
                    No items found for "{itemSearch}"
                  </Text>
                </View>
              ) : (
                filteredByStation.map(({ station, items }) => (
                  <View key={station}>
                    <Text style={[st.stationGroupHeader, { color: colors.textMuted, fontFamily: 'DMSans_600SemiBold' }]}>
                      {getStationEmoji(station)} {station}
                    </Text>
                    <View style={[st.groupCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      {items.map((item, i) => renderItemRow(item, i, items.length))}
                    </View>
                  </View>
                ))
              )
            ) : (
              /* Normal: show station cards */
              hallItemsLoading ? (
                <View style={st.stationGrid}>
                  <Skeleton width={(SCREEN_WIDTH - 40 - 10) / 2} height={100} borderRadius={14} />
                  <Skeleton width={(SCREEN_WIDTH - 40 - 10) / 2} height={100} borderRadius={14} />
                  <Skeleton width={(SCREEN_WIDTH - 40 - 10) / 2} height={100} borderRadius={14} />
                  <Skeleton width={(SCREEN_WIDTH - 40 - 10) / 2} height={100} borderRadius={14} />
                </View>
              ) : derivedStations.length === 0 ? (
                <View style={{ alignItems: 'center', paddingTop: 40 }}>
                  <Text style={{ fontSize: 32 }}>🍽️</Text>
                  <Text style={[{ fontSize: 14, color: colors.textMuted, marginTop: 8, fontFamily: 'DMSans_400Regular' }]}>No stations for this meal</Text>
                </View>
              ) : (
                <View style={st.stationGrid}>
                  {derivedStations.map((s) => (
                    <PressableCard
                      key={s.name}
                      onPress={() => openStation(s.name)}
                      style={[st.stationCard, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}
                    >
                      <Text style={{ fontSize: 26 }}>{getStationEmoji(s.name)}</Text>
                      <Text style={[{ fontSize: 12, color: colors.text, fontFamily: 'DMSans_600SemiBold', textAlign: 'center' }]} numberOfLines={2}>{s.name}</Text>
                      <Text style={[st.stationItemCount, { color: colors.textMuted }]}>{s.count} items</Text>
                    </PressableCard>
                  ))}
                </View>
              )
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    );
  }

  // ── Items view ──
  if (view === 'items') {
    return (
      <SafeAreaView style={[st.safe, { backgroundColor: colors.background }]}>
        {renderToast()}
        {wrapAnimated(
          <ScrollView contentContainerStyle={st.pad} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {renderHeader()}

            {/* Item search bar — always rendered at stable position */}
            <View style={[st.searchWrap, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
              <TextInput
                style={[st.searchInput, { color: colors.text, fontFamily: 'DMSans_400Regular' }]}
                placeholder="Search items..."
                placeholderTextColor={colors.textDim}
                value={itemSearch}
                onChangeText={setItemSearch}
                returnKeyType="search"
              />
              {itemSearch.length > 0 && (
                <TouchableOpacity onPress={() => setItemSearch('')} style={st.clearBtn}>
                  <Text style={[{ fontSize: 14, color: colors.textMuted }]}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            {filteredStationItems.length === 0 ? (
              <View style={{ alignItems: 'center', paddingTop: 40 }}>
                <Text style={{ fontSize: 32 }}>🍽️</Text>
                <Text style={[{ fontSize: 14, color: colors.textMuted, marginTop: 8, fontFamily: 'DMSans_400Regular' }]}>
                  {itemSearch ? `No items found for "${itemSearch}"` : 'No items found'}
                </Text>
              </View>
            ) : (
              filteredStationItems.map((item, i) => renderItemRow(item, i, filteredStationItems.length))
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    );
  }

  // ── Detail view ──
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
        {renderToast()}
        {wrapAnimated(
          <>
            <ScrollView contentContainerStyle={[st.pad, { paddingBottom: 100 }]} showsVerticalScrollIndicator={false}>
              {renderHeader()}

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

              <View style={{ marginTop: 20 }}>
                <Text style={[{ fontSize: 14, color: colors.text, fontFamily: 'DMSans_600SemiBold', marginBottom: 10 }]}>Servings</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {[0.5, 1, 1.5, 2].map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[st.servingChip, { backgroundColor: servings === s ? colors.maroon : colors.card, borderColor: servings === s ? colors.maroon : colors.border, borderWidth: 1 }]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setServings(s);
                      }}
                    >
                      <Text style={[{ fontSize: 14, color: servings === s ? '#fff' : colors.text, fontFamily: 'DMSans_600SemiBold' }]}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={st.nutritionGrid}>
                {nutritionGrid.map((item) => (
                  <View key={item.label} style={[st.nutritionCell, { backgroundColor: colors.cardAlt }]}>
                    <Text style={[{ fontSize: 18, color: colors.text, fontFamily: 'Outfit_700Bold' }]}>{item.val}</Text>
                    <Text style={[{ fontSize: 11, color: colors.textMuted, fontFamily: 'DMSans_400Regular', marginTop: 2 }]}>{item.label}</Text>
                  </View>
                ))}
              </View>

              {selectedItem.dietary_flags && selectedItem.dietary_flags.length > 0 && (
                <View style={[st.flagRow, { marginTop: 16 }]}>
                  {selectedItem.dietary_flags.map((flag: string) => (
                    <View key={flag} style={[st.flagPill, { backgroundColor: colors.green + '22' }]}>
                      <Text style={[{ fontSize: 12, color: colors.green, fontFamily: 'DMSans_600SemiBold' }]}>{flag}</Text>
                    </View>
                  ))}
                </View>
              )}

              {selectedItem.ingredients && (
                <View style={[st.ingredientCard, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
                  <Text style={[{ fontSize: 13, color: colors.text, fontFamily: 'DMSans_600SemiBold', marginBottom: 8 }]}>Ingredients</Text>
                  <Text style={[{ fontSize: 12, color: colors.textMuted, fontFamily: 'DMSans_400Regular', lineHeight: 18 }]}>{selectedItem.ingredients}</Text>
                </View>
              )}
            </ScrollView>

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
                  <Text style={[{ fontSize: 16, color: '#fff', fontFamily: 'DMSans_700Bold' }]}>Logging...</Text>
                ) : (
                  <Text style={[{ fontSize: 16, color: '#fff', fontFamily: 'DMSans_700Bold' }]}>
                    {logSuccess ? 'Logged! ✓' : 'Log This Meal ✓'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
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
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 13 },
  clearBtn: { paddingLeft: 8, paddingVertical: 8 },
  filterRow: { flexDirection: 'row', gap: 8 },
  filterChip: { flex: 1, paddingVertical: 10, borderRadius: 24, alignItems: 'center' },
  filterChipText: { fontSize: 13 },
  hallCard: { flexDirection: 'row', alignItems: 'center', padding: 20, borderRadius: 20, marginBottom: 12 },
  countBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, position: 'absolute', top: 12, right: 12 },
  stationGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  stationCard: { width: (SCREEN_WIDTH - 40 - 10) / 2, height: 100, padding: 10, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  stationItemCount: { fontSize: 11, fontFamily: 'DMSans_400Regular', position: 'absolute', bottom: 8 },
  stationGroupHeader: { fontSize: 13, marginBottom: 8, marginTop: 16 },
  groupCard: { borderRadius: 14, borderWidth: 1, overflow: 'hidden', marginBottom: 8 },
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
  toast: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
    zIndex: 100,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  toastText: {
    color: '#fff',
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
  },
});
