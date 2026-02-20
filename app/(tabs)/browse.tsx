import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Alert,
  Dimensions,
  Easing,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import ReanimatedAnimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing as REasing,
} from 'react-native-reanimated';

// Restyle primitives
import { Box, Text } from '@/src/theme/restyleTheme';
import AnimatedCard from '@/src/components/AnimatedCard';
import Skeleton from '@/src/components/Skeleton';
import MicronutrientScreen from '@/src/components/MicronutrientScreen';

// Data utilities
import { requireUserId } from '@/src/utils/auth';
import { supabase } from '@/src/utils/supabase';
import { getMealQueryValues, getCurrentMealPeriod, getEffectiveMenuDate } from '@/src/utils/meals';
import { toggleFavorite, getFavorites } from '@/src/utils/favorites';
import { getHallAverages, HallAverage, rateHall, getUserRating, getHallReviews, HallReview } from '@/src/utils/ratings';
import { getAllHallStatuses, HallStatus } from '@/src/utils/hours';
import { getFavoritesToday, getFitsYourMacros, getTrySomethingNew, getQuickAndLight } from '@/src/utils/recommendations';
import { triggerHaptic } from '@/src/utils/haptics';

const SCREEN_WIDTH = Dimensions.get('window').width;

// ─── Colors (direct refs for non-Restyle elements) ─────────────────────────
const C = {
  white: '#FFFFFF',
  offWhite: '#FAFAFA',
  maroon: '#861F41',
  maroonDark: '#6B1835',
  maroonMuted: 'rgba(134,31,65,0.08)',
  gold: '#C5A55A',
  goldMuted: 'rgba(197,165,90,0.12)',
  silver: '#A8A9AD',
  silverLight: '#C8C9CC',
  text: '#1A1A1A',
  textMuted: '#6B6B6F',
  textDim: '#9A9A9E',
  border: '#E8E8EA',
  borderLight: '#F0F0F2',
  inputBg: '#F5F5F7',
  success: '#34C759',
  successTint: 'rgba(52,199,89,0.10)',
  warning: '#C5A55A',
  error: '#FF453A',
  errorTint: 'rgba(255,69,58,0.10)',
  blue: '#4A7FC5',
};

function getLocalDate() {
  const d = new Date();
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

function getStationEmoji(stationName: string): string | null {
  const lower = stationName.toLowerCase();
  for (const [keywords, emoji] of STATION_EMOJI_RULES) {
    if (keywords.some((kw) => lower.includes(kw))) return emoji;
  }
  return null; // Task 4.2: no fallback emoji — return null for unknown stations
}

// ─── Press-scale log button ─────────────────────────────────────────────────
const AnimatedPressable = ReanimatedAnimated.createAnimatedComponent(Pressable);

function PressScaleButton({ onPress, disabled, children, style }: {
  onPress: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  style?: any;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      onPress={() => { if (!disabled) { triggerHaptic('medium'); onPress(); } }}
      onPressIn={() => { scale.value = withTiming(0.97, { duration: 100, easing: REasing.out(REasing.quad) }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 150 }); }}
      style={[animStyle, style]}
      disabled={disabled}
    >
      {children}
    </AnimatedPressable>
  );
}

type ViewState = 'halls' | 'stations' | 'items' | 'detail';

export default function BrowseScreen() {
  const params = useLocalSearchParams<{ filter?: string; meal?: string }>();
  const [view, setView] = useState<ViewState>('halls');
  const [meal, setMeal] = useState(params.meal && ['Breakfast', 'Lunch', 'Dinner'].includes(params.meal) ? params.meal : autoMeal);

  const [hallSearch, setHallSearch] = useState('');
  const [itemSearch, setItemSearch] = useState('');

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

  const [favRecNums, setFavRecNums] = useState<Set<string>>(new Set());
  const [hallRatings, setHallRatings] = useState<Record<number, HallAverage>>({});

  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [ratingStars, setRatingStars] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [ratingLoading, setRatingLoading] = useState(false);

  const [hallStatuses, setHallStatuses] = useState<Record<number, HallStatus>>({});
  const [hallReviews, setHallReviews] = useState<HallReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);

  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [filterItems, setFilterItems] = useState<any[]>([]);
  const [filterLoading, setFilterLoading] = useState(false);

  const [showMicros, setShowMicros] = useState(false);

  const [usingFallback, setUsingFallback] = useState(false);
  const [effectiveDate, setEffectiveDate] = useState(getLocalDate());

  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const toastAnim = useRef(new Animated.Value(-60)).current;
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const [toastMessage, setToastMessage] = useState('');
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

  const today = getLocalDate();
  const date = today;

  // ─── Data Loading (unchanged) ─────────────────────────────────────────────

  const loadHalls = useCallback(async () => {
    try {
      const menuDate = await getEffectiveMenuDate();
      const fallback = menuDate !== today;
      const { data: hallData } = await supabase
        .from('dining_halls')
        .select('id, name, location_num')
        .order('name');
      if (!hallData) { setHalls([]); return; }
      const { data: itemCounts } = await supabase
        .from('menu_items')
        .select('dining_hall_id, id')
        .eq('date', menuDate)
        .in('meal', getMealQueryValues(meal));
      const counts: Record<number, number> = {};
      (itemCounts || []).forEach((i: any) => {
        counts[i.dining_hall_id] = (counts[i.dining_hall_id] || 0) + 1;
      });
      setHalls(hallData.map((h: any) => ({ ...h, count: counts[h.id] || 0 })));
      setUsingFallback(fallback);
      setEffectiveDate(menuDate);
    } catch (e) {
      console.error('Load halls error:', e);
    } finally {
      setLoading(false);
    }
  }, [today, meal]);

  const loadFavorites = useCallback(async () => {
    try {
      const userId = await requireUserId();
      const favs = await getFavorites(userId);
      setFavRecNums(new Set(favs.map((f) => f.rec_num)));
    } catch {}
  }, []);

  const loadRatings = useCallback(async () => {
    try {
      const averages = await getHallAverages();
      setHallRatings(averages);
    } catch {}
  }, []);

  const openRatingModal = async () => {
    if (!selectedHall) return;
    setRatingStars(0);
    setReviewText('');
    setRatingModalVisible(true);
    setRatingLoading(true);
    try {
      const userId = await requireUserId();
      const d = new Date();
      const td = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const existing = await getUserRating(userId, selectedHall.id, td);
      if (existing) {
        setRatingStars(existing.rating);
        setReviewText(existing.review_text ?? '');
      }
    } catch {} finally {
      setRatingLoading(false);
    }
  };

  const submitRating = async () => {
    if (!selectedHall || ratingStars === 0) return;
    setRatingSubmitting(true);
    try {
      const userId = await requireUserId();
      const d = new Date();
      const td = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      await rateHall(userId, selectedHall.id, ratingStars, reviewText.trim() || undefined, td);
      setRatingModalVisible(false);
      showToastMessage('Rating submitted!');
      loadRatings();
      if (selectedHall) loadHallReviews(selectedHall.id);
    } catch {
      Alert.alert('Error', 'Failed to submit rating. Please try again.');
    } finally {
      setRatingSubmitting(false);
    }
  };

  const loadHallStatuses = useCallback(async () => {
    try {
      const statuses = await getAllHallStatuses(new Date());
      setHallStatuses(statuses);
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => {
    setView('halls');
    setHallSearch('');
    setItemSearch('');
    slideAnim.setValue(0);
    fadeAnim.setValue(1);
    if (params.meal && ['Breakfast', 'Lunch', 'Dinner'].includes(params.meal)) {
      setMeal(params.meal);
    }
    if (params.filter) {
      setActiveFilter(params.filter);
      loadFilteredItems(params.filter);
    } else {
      setActiveFilter(null);
      loadHalls();
    }
    loadFavorites();
    loadRatings();
    loadHallStatuses();
  }, [params.filter, params.meal, loadHalls, loadFavorites, loadRatings, loadHallStatuses]));

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadHalls(), loadRatings(), loadHallStatuses()]);
    setRefreshing(false);
  };

  const loadHallReviews = async (hallId: number) => {
    setReviewsLoading(true);
    try {
      const reviews = await getHallReviews(hallId);
      setHallReviews(reviews.slice(0, 10));
    } catch {
      setHallReviews([]);
    } finally {
      setReviewsLoading(false);
    }
  };

  const getFilterTitle = (filter: string) => {
    switch (filter) {
      case 'favorites': return 'Your Favorites Today';
      case 'macros': return 'Fits Your Macros';
      case 'new': return 'Try Something New';
      case 'light': return 'Quick & Light';
      default: return 'Filtered Items';
    }
  };

  const loadFilteredItems = async (filterType: string) => {
    setFilterLoading(true);
    try {
      const userId = await requireUserId();
      const menuDate = await getEffectiveMenuDate();
      const mealPeriod = getCurrentMealPeriod();
      let items: any[] = [];
      switch (filterType) {
        case 'favorites': {
          const [favItems, hallsRes] = await Promise.all([
            getFavoritesToday(userId, menuDate),
            supabase.from('dining_halls').select('id, name'),
          ]);
          const hallMap: Record<number, string> = {};
          for (const h of hallsRes.data ?? []) hallMap[h.id] = h.name;
          items = favItems.map((f) => ({
            name: f.name,
            calories: f.nutrition?.calories ?? 0,
            protein_g: f.nutrition?.protein_g ?? 0,
            total_carbs_g: f.nutrition?.total_carbs_g ?? 0,
            total_fat_g: f.nutrition?.total_fat_g ?? 0,
            hall_name: hallMap[f.dining_hall_id] ?? '',
            rec_num: f.rec_num,
          }));
          break;
        }
        case 'macros':
          items = await getFitsYourMacros(userId, menuDate, mealPeriod);
          break;
        case 'new':
          items = await getTrySomethingNew(userId, menuDate);
          break;
        case 'light':
          items = await getQuickAndLight(menuDate);
          break;
      }
      setFilterItems(items);
    } catch (err) {
      console.error('Load filtered items error:', err);
      setFilterItems([]);
    } finally {
      setFilterLoading(false);
    }
  };

  const clearFilter = () => {
    setActiveFilter(null);
    setFilterItems([]);
    setLoading(true);
    loadHalls();
    loadFavorites();
    loadRatings();
    loadHallStatuses();
  };

  const openHall = async (hall: any) => {
    animateTransition('forward', () => {
      setSelectedHall(hall);
      setItemSearch('');
      setAllHallItems([]);
      setHallReviews([]);
      setView('stations');
    });
    setHallItemsLoading(true);
    loadHallReviews(hall.id);
    try {
      const { data } = await supabase
        .from('menu_items')
        .select('id, name, rec_num, station, dietary_flags, nutrition(*)')
        .eq('dining_hall_id', hall.id)
        .eq('date', effectiveDate)
        .in('meal', getMealQueryValues(meal))
        .order('name');
      setAllHallItems(data || []);
    } catch (e) {
      console.error('Load hall items error:', e);
    } finally {
      setHallItemsLoading(false);
    }
  };

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

  const showToastMessage = (msg: string) => {
    setToastMessage(msg);
    setShowToast(true);
    toastAnim.setValue(-60);
    toastOpacity.setValue(0);
    triggerHaptic('success');
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
    triggerHaptic('medium');
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
      showToastMessage(`Logged! +${Math.round(n.cal * servings)} cal`);
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
      if (view === 'detail') setView('items');
      else if (view === 'items') setView('stations');
      else if (view === 'stations') { setItemSearch(''); setView('halls'); }
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
    if (flags.includes('vegan')) return { text: 'VG', bg: C.goldMuted, color: C.gold };
    if (flags.includes('vegetarian')) return { text: 'V', bg: C.maroonMuted, color: C.maroon };
    if (flags.includes('halal')) return { text: 'H', bg: C.maroonMuted, color: C.maroon };
    return null;
  };

  const getDotColor = (flags: string[] | null) => {
    if (!flags) return 'transparent';
    if (flags.includes('vegan') || flags.includes('vegetarian')) return C.success;
    if (flags.includes('halal')) return C.blue;
    return 'transparent';
  };

  // ─── Derived data ─────────────────────────────────────────────────────────

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

  const stationItems = allHallItems.filter((item) => item.station === selectedStation);
  const filteredStationItems = itemSearch
    ? stationItems.filter((item) => item.name.toLowerCase().includes(itemSearch.toLowerCase()))
    : stationItems;

  const filteredAllItems = itemSearch
    ? allHallItems.filter((item) => item.name.toLowerCase().includes(itemSearch.toLowerCase()))
    : [];

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

  const filteredHalls = (() => {
    const list = hallSearch
      ? halls.filter((h) => h.name.toLowerCase().includes(hallSearch.toLowerCase()))
      : halls;
    return [...list].sort((a, b) => {
      const aOpen = hallStatuses[a.id]?.isOpen ? 1 : 0;
      const bOpen = hallStatuses[b.id]?.isOpen ? 1 : 0;
      return bOpen - aOpen;
    });
  })();

  const handleToggleFavorite = async (item: any) => {
    if (!item.rec_num) return;
    const recNum = item.rec_num as string;
    setFavRecNums((prev) => {
      const next = new Set(prev);
      if (next.has(recNum)) next.delete(recNum);
      else next.add(recNum);
      return next;
    });
    triggerHaptic('light');
    try {
      const userId = await requireUserId();
      await toggleFavorite(userId, recNum, item.name);
    } catch {
      setFavRecNums((prev) => {
        const next = new Set(prev);
        if (next.has(recNum)) next.delete(recNum);
        else next.add(recNum);
        return next;
      });
    }
  };

  // ─── Shared render helpers ────────────────────────────────────────────────

  const wrapAnimated = (content: React.ReactNode) => (
    <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ translateX: slideAnim }] }}>
      {content}
    </Animated.View>
  );

  const renderToast = () => {
    if (!showToast) return null;
    return (
      <Animated.View style={{
        position: 'absolute', top: 60, left: 20, right: 20,
        paddingVertical: 14, paddingHorizontal: 20, borderRadius: 8,
        zIndex: 100, alignItems: 'center',
        backgroundColor: C.success,
        transform: [{ translateY: toastAnim }],
        opacity: toastOpacity,
      }}>
        <Text variant="body" style={{ color: C.white, fontFamily: 'DMSans_700Bold' }}>{toastMessage}</Text>
      </Animated.View>
    );
  };

  const renderSearchBar = (value: string, onChangeText: (t: string) => void, placeholder: string) => (
    <Box
      flexDirection="row"
      alignItems="center"
      borderRadius="s"
      marginBottom="m"
      style={{ backgroundColor: C.inputBg, paddingHorizontal: 14 }}
    >
      <Feather name="search" size={18} color={C.silver} style={{ marginRight: 10 }} />
      <TextInput
        style={{ flex: 1, fontSize: 15, paddingVertical: 13, color: C.text, fontFamily: 'DMSans_400Regular' }}
        placeholder={placeholder}
        placeholderTextColor={C.textDim}
        value={value}
        onChangeText={onChangeText}
        returnKeyType="search"
      />
      {value.length > 0 && (
        <TouchableOpacity onPress={() => onChangeText('')} style={{ paddingLeft: 8, paddingVertical: 8 }}>
          <Feather name="x" size={14} color={C.textMuted} />
        </TouchableOpacity>
      )}
    </Box>
  );

  const renderHeader = () => (
    <Box flexDirection="row" alignItems="center" marginBottom="m">
      {view !== 'halls' && (
        <TouchableOpacity onPress={goBack} style={{ width: 36, height: 36, justifyContent: 'center', alignItems: 'center', marginRight: 8 }}>
          <Feather name="arrow-left" size={20} color={C.text} />
        </TouchableOpacity>
      )}
      <Box flex={1}>
        {view === 'halls' && <Text variant="pageTitle">Log a Meal</Text>}
        {view === 'stations' && (
          <>
            <Text variant="pageTitle">{selectedHall?.name}</Text>
            <Text variant="muted">{meal} · Today</Text>
          </>
        )}
        {view === 'items' && (
          <>
            <Text variant="pageTitle">
              {getStationEmoji(selectedStation) ? `${getStationEmoji(selectedStation)} ` : ''}{selectedStation}
            </Text>
            <Text variant="muted">{selectedHall?.name} · {meal}</Text>
          </>
        )}
        {view === 'detail' && (
          <Text variant="pageTitle" numberOfLines={1}>{selectedItem?.name}</Text>
        )}
      </Box>
    </Box>
  );

  // ─── Task 4.1: Rectangular meal filter tabs ───────────────────────────────

  const renderMealFilter = () => (
    <Box flexDirection="row" marginBottom="m" style={{ gap: 0 }}>
      {['Breakfast', 'Lunch', 'Dinner'].map((m) => {
        const isActive = meal === m;
        return (
          <TouchableOpacity
            key={m}
            onPress={() => { triggerHaptic('light'); setMeal(m); }}
            style={{
              flex: 1,
              paddingVertical: 10,
              alignItems: 'center',
              backgroundColor: isActive ? C.maroon : 'transparent',
              borderRadius: isActive ? 6 : 0,
              borderBottomWidth: isActive ? 0 : 2,
              borderBottomColor: isActive ? 'transparent' : C.borderLight,
            }}
          >
            <Text
              variant="body"
              style={{
                fontFamily: 'DMSans_600SemiBold',
                fontSize: 13,
                color: isActive ? C.white : C.textMuted,
              }}
            >
              {m}
            </Text>
          </TouchableOpacity>
        );
      })}
    </Box>
  );

  // ─── Task 4.3: Item row with new tokens ───────────────────────────────────

  const renderItemRow = (item: any, i: number, total: number) => {
    const n = getNutr(item);
    const badge = getDietaryBadge(item.dietary_flags);
    const isFav = !!item.rec_num && favRecNums.has(item.rec_num);
    return (
      <TouchableOpacity key={item.id} onPress={() => openDetail(item)}>
        <Box flexDirection="row" alignItems="center" style={{ paddingVertical: 14 }}>
          {/* Green availability dot */}
          <Box
            style={{
              width: 8, height: 8, borderRadius: 4, marginRight: 12,
              backgroundColor: getDotColor(item.dietary_flags),
            }}
          />
          <Box flex={1}>
            <Box flexDirection="row" alignItems="center">
              <Text
                variant="body"
                style={{ fontFamily: 'DMSans_600SemiBold', flexShrink: 1 }}
                numberOfLines={1}
              >
                {item.name}
              </Text>
              {badge && (
                <Box
                  style={{
                    marginLeft: 6, paddingHorizontal: 6, paddingVertical: 2,
                    borderRadius: 4, backgroundColor: badge.bg,
                  }}
                >
                  <Text style={{ fontSize: 10, color: badge.color, fontFamily: 'DMSans_700Bold' }}>{badge.text}</Text>
                </Box>
              )}
            </Box>
            <Text variant="dim" style={{ marginTop: 2 }}>
              P: {n.pro}g · C: {n.carb}g · F: {n.fat}g
            </Text>
          </Box>
          {/* Heart: silver unfavorited, maroon favorited */}
          <TouchableOpacity
            onPress={() => handleToggleFavorite(item)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{ paddingHorizontal: 8 }}
          >
            <Feather name="heart" size={18} color={isFav ? C.maroon : C.silver} />
          </TouchableOpacity>
          {/* Calorie: statValue maroon */}
          <Box style={{ alignItems: 'flex-end', minWidth: 40 }}>
            <Text style={{ fontSize: 22, color: C.maroon, fontFamily: 'DMSans_700Bold' }}>{n.cal}</Text>
            <Text variant="dim">cal</Text>
          </Box>
        </Box>
        {/* borderLight divider */}
        {i < total - 1 && <Box style={{ height: 1, marginLeft: 20, backgroundColor: C.borderLight }} />}
      </TouchableOpacity>
    );
  };

  // ─── Rating modal ─────────────────────────────────────────────────────────

  const renderRatingModal = () => (
    <Modal
      visible={ratingModalVisible}
      transparent
      animationType="fade"
      onRequestClose={() => setRatingModalVisible(false)}
    >
      <Box flex={1} justifyContent="center" alignItems="center" style={{ backgroundColor: 'rgba(0,0,0,0.5)', padding: 20 }}>
        <Box
          borderRadius="xl"
          padding="l"
          style={{ backgroundColor: C.white, width: '100%' }}
        >
          {/* Modal handle */}
          <Box alignSelf="center" style={{ width: 36, height: 4, borderRadius: 9999, backgroundColor: C.silver, marginBottom: 16 }} />

          <Text variant="pageTitle" style={{ fontSize: 20, textAlign: 'center', marginBottom: 4 }}>
            Rate {selectedHall?.name}
          </Text>
          <Text variant="muted" style={{ textAlign: 'center', marginBottom: 20 }}>Tap a star to rate</Text>

          {ratingLoading ? (
            <ActivityIndicator color={C.maroon} style={{ marginVertical: 20 }} />
          ) : (
            <>
              <Box flexDirection="row" justifyContent="center" style={{ gap: 12, marginBottom: 20 }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity key={star} onPress={() => { setRatingStars(star); triggerHaptic('light'); }}>
                    <Feather name="star" size={36} color={star <= ratingStars ? C.gold : C.textDim} />
                  </TouchableOpacity>
                ))}
              </Box>
              <TextInput
                style={{
                  borderRadius: 6, borderWidth: 1, padding: 14, fontSize: 14,
                  minHeight: 80, textAlignVertical: 'top',
                  color: C.text, backgroundColor: C.inputBg, borderColor: C.border,
                  fontFamily: 'DMSans_400Regular',
                }}
                placeholder="Write a short review (optional)"
                placeholderTextColor={C.textDim}
                value={reviewText}
                onChangeText={(t) => setReviewText(t.slice(0, 200))}
                maxLength={200}
                multiline
                numberOfLines={3}
              />
              <Text variant="dim" style={{ textAlign: 'right', marginTop: 4, marginBottom: 16 }}>
                {reviewText.length}/200
              </Text>
              <PressScaleButton
                onPress={submitRating}
                disabled={ratingStars === 0 || ratingSubmitting}
                style={{
                  height: 52, borderRadius: 6, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: ratingStars > 0 ? C.maroon : C.border,
                  opacity: ratingSubmitting ? 0.6 : 1,
                }}
              >
                <Text variant="body" style={{ color: C.white, fontFamily: 'DMSans_700Bold', fontSize: 16 }}>
                  {ratingSubmitting ? 'Submitting...' : 'Submit Rating'}
                </Text>
              </PressScaleButton>
              <TouchableOpacity style={{ marginTop: 12, alignItems: 'center' }} onPress={() => setRatingModalVisible(false)}>
                <Text variant="muted" style={{ fontFamily: 'DMSans_600SemiBold', fontSize: 14 }}>Cancel</Text>
              </TouchableOpacity>
            </>
          )}
        </Box>
      </Box>
    </Modal>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER — HALLS VIEW (Task 4.1)
  // ═══════════════════════════════════════════════════════════════════════════

  if (view === 'halls') {
    // Filtered view (from "See All" navigation)
    if (activeFilter) {
      return (
        <SafeAreaView style={{ flex: 1, backgroundColor: C.offWhite }}>
          {renderToast()}
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
            <Box flexDirection="row" alignItems="center" marginBottom="m">
              <TouchableOpacity onPress={clearFilter} style={{ width: 36, height: 36, justifyContent: 'center', alignItems: 'center', marginRight: 8 }}>
                <Feather name="arrow-left" size={20} color={C.text} />
              </TouchableOpacity>
              <Box flex={1}>
                <Text variant="pageTitle">{getFilterTitle(activeFilter)}</Text>
              </Box>
            </Box>

            <TouchableOpacity
              onPress={clearFilter}
              style={{
                alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 8,
                borderRadius: 6, marginBottom: 16,
                backgroundColor: C.white, borderWidth: 1, borderColor: C.border,
              }}
            >
              <Box flexDirection="row" alignItems="center" style={{ gap: 4 }}>
                <Feather name="x" size={13} color={C.maroon} />
                <Text variant="body" style={{ fontSize: 13, color: C.maroon, fontFamily: 'DMSans_600SemiBold' }}>Clear Filter</Text>
              </Box>
            </TouchableOpacity>

            {filterLoading ? (
              <Box style={{ gap: 12 }}>
                <Skeleton width={'100%'} height={60} borderRadius={8} />
                <Skeleton width={'100%'} height={60} borderRadius={8} />
                <Skeleton width={'100%'} height={60} borderRadius={8} />
              </Box>
            ) : filterItems.length === 0 ? (
              <Box alignItems="center" style={{ paddingTop: 40 }}>
                <Feather name="search" size={32} color={C.silver} />
                <Text variant="muted" style={{ marginTop: 8, textAlign: 'center' }}>No items found for this filter</Text>
              </Box>
            ) : (
              <Box
                borderRadius="m"
                style={{ borderWidth: 1, borderColor: C.border, backgroundColor: C.white, overflow: 'hidden' }}
              >
                {filterItems.map((item, i) => {
                  const isFav = !!item.rec_num && favRecNums.has(item.rec_num);
                  return (
                    <Box key={i}>
                      <Box flexDirection="row" alignItems="center" style={{ paddingVertical: 14, paddingHorizontal: 16 }}>
                        <Box flex={1}>
                          <Text variant="body" style={{ fontFamily: 'DMSans_600SemiBold' }} numberOfLines={1}>{item.name}</Text>
                          <Text variant="dim" style={{ marginTop: 2 }}>
                            {item.hall_name ? `${item.hall_name} · ` : ''}P: {item.protein_g}g · C: {item.total_carbs_g}g · F: {item.total_fat_g}g
                          </Text>
                        </Box>
                        {item.rec_num ? (
                          <TouchableOpacity
                            onPress={() => handleToggleFavorite({ rec_num: item.rec_num, name: item.name })}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            style={{ paddingHorizontal: 8 }}
                          >
                            <Feather name="heart" size={18} color={isFav ? C.maroon : C.silver} />
                          </TouchableOpacity>
                        ) : null}
                        <Box style={{ alignItems: 'flex-end', minWidth: 40 }}>
                          <Text style={{ fontSize: 22, color: C.maroon, fontFamily: 'DMSans_700Bold' }}>{item.calories}</Text>
                          <Text variant="dim">cal</Text>
                        </Box>
                      </Box>
                      {i < filterItems.length - 1 && <Box style={{ height: 1, marginLeft: 20, backgroundColor: C.borderLight }} />}
                    </Box>
                  );
                })}
              </Box>
            )}
          </ScrollView>
        </SafeAreaView>
      );
    }

    // ── Main halls list ──
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.offWhite }}>
        {renderToast()}
        {wrapAnimated(
          <ScrollView
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.maroon} />}
            contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
            keyboardShouldPersistTaps="handled"
          >
            {renderHeader()}
            {renderSearchBar(hallSearch, setHallSearch, 'Search halls or food items...')}
            {renderMealFilter()}

            {usingFallback && (
              <Box
                borderRadius="m"
                style={{
                  borderWidth: 1, paddingVertical: 10, paddingHorizontal: 16, marginBottom: 16,
                  backgroundColor: 'rgba(212,160,36,0.08)', borderColor: 'rgba(212,160,36,0.3)',
                }}
              >
                <Text variant="muted" style={{ color: C.warning, fontFamily: 'DMSans_600SemiBold', textAlign: 'center', fontSize: 13 }}>
                  Showing yesterday's menu — today's updates at 7 AM
                </Text>
              </Box>
            )}

            {loading ? (
              <Box style={{ gap: 12 }}>
                <Skeleton width={'100%'} height={80} borderRadius={8} />
                <Skeleton width={'100%'} height={80} borderRadius={8} />
                <Skeleton width={'100%'} height={80} borderRadius={8} />
                <Skeleton width={'100%'} height={80} borderRadius={8} />
              </Box>
            ) : filteredHalls.length === 0 ? (
              <Box alignItems="center" style={{ paddingTop: 40 }}>
                <Feather name="home" size={32} color={C.silver} />
                <Text variant="muted" style={{ marginTop: 8 }}>
                  {hallSearch ? `No dining halls match "${hallSearch}"` : 'No halls found'}
                </Text>
              </Box>
            ) : (
              filteredHalls.map((hall) => {
                const rating = hallRatings[hall.id];
                const status = hallStatuses[hall.id];
                return (
                  <AnimatedCard
                    key={hall.id}
                    onPress={() => openHall(hall)}
                    haptic
                    padding="m"
                    marginBottom="s"
                    flexDirection="row"
                    alignItems="center"
                  >
                    <Box flex={1}>
                      <Text variant="cardTitle">{hall.name}</Text>
                      <Box flexDirection="row" alignItems="center" style={{ gap: 6, marginTop: 6 }}>
                        {rating ? (
                          <>
                            <Feather name="star" size={12} color={C.gold} />
                            <Text variant="body" style={{ fontFamily: 'DMSans_600SemiBold', fontSize: 14 }}>{rating.avg.toFixed(1)}</Text>
                            <Text variant="muted" style={{ fontSize: 14 }}>·</Text>
                          </>
                        ) : null}
                        <Text variant="muted" style={{ fontSize: 14 }}>{hall.count} items</Text>
                      </Box>
                      {status?.isOpen ? (
                        <Box style={{
                          paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4,
                          backgroundColor: C.successTint, marginTop: 8, alignSelf: 'flex-start',
                        }}>
                          <Text style={{ fontSize: 11, color: C.success, fontFamily: 'DMSans_700Bold' }}>
                            Open{status.currentMeal ? ` until ${status.currentMeal}` : ''}
                          </Text>
                        </Box>
                      ) : status ? (
                        <Box style={{
                          paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4,
                          backgroundColor: C.errorTint, marginTop: 8, alignSelf: 'flex-start',
                        }}>
                          <Text style={{ fontSize: 11, color: C.error, fontFamily: 'DMSans_700Bold' }}>
                            Closed{status.nextOpen ? ` · Opens ${status.nextOpen}` : ''}
                          </Text>
                        </Box>
                      ) : null}
                    </Box>
                    <Feather name="chevron-right" size={18} color={C.silver} />
                  </AnimatedCard>
                );
              })
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER — STATIONS VIEW (Task 4.2)
  // ═══════════════════════════════════════════════════════════════════════════

  if (view === 'stations') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.offWhite }}>
        {renderToast()}
        {renderRatingModal()}
        {wrapAnimated(
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {renderHeader()}

            {/* Rate this hall */}
            <TouchableOpacity
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start',
                paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6,
                borderWidth: 1, borderColor: C.silver, marginBottom: 16,
              }}
              onPress={openRatingModal}
            >
              <Feather name="star" size={16} color={C.gold} />
              <Text variant="body" style={{ fontSize: 13, fontFamily: 'DMSans_600SemiBold' }}>Rate This Hall</Text>
            </TouchableOpacity>

            {renderSearchBar(itemSearch, setItemSearch, 'Search items...')}

            {/* Search active: filtered items grouped by station */}
            {itemSearch.length > 0 ? (
              hallItemsLoading ? (
                <Box style={{ gap: 12 }}>
                  <Skeleton width={'100%'} height={60} borderRadius={8} />
                  <Skeleton width={'100%'} height={60} borderRadius={8} />
                </Box>
              ) : filteredByStation.length === 0 ? (
                <Box alignItems="center" style={{ paddingTop: 40 }}>
                  <Feather name="search" size={32} color={C.silver} />
                  <Text variant="muted" style={{ marginTop: 8, textAlign: 'center' }}>No results for "{itemSearch}"</Text>
                  <Text variant="dim" style={{ marginTop: 4, textAlign: 'center' }}>Try a different search or browse stations below</Text>
                </Box>
              ) : (
                filteredByStation.map(({ station, items }) => (
                  <Box key={station}>
                    <Text variant="sectionHeader" style={{ marginBottom: 8, marginTop: 16 }}>
                      {getStationEmoji(station) ? `${getStationEmoji(station)} ` : ''}{station}
                    </Text>
                    <Box borderRadius="m" style={{ borderWidth: 1, borderColor: C.border, backgroundColor: C.white, overflow: 'hidden', paddingHorizontal: 16 }}>
                      {items.map((item, i) => renderItemRow(item, i, items.length))}
                    </Box>
                  </Box>
                ))
              )
            ) : (
              /* Normal: 2-column station grid */
              hallItemsLoading ? (
                <Box flexDirection="row" flexWrap="wrap" style={{ gap: 10, marginTop: 8 }}>
                  <Skeleton width={(SCREEN_WIDTH - 40 - 10) / 2} height={100} borderRadius={8} />
                  <Skeleton width={(SCREEN_WIDTH - 40 - 10) / 2} height={100} borderRadius={8} />
                  <Skeleton width={(SCREEN_WIDTH - 40 - 10) / 2} height={100} borderRadius={8} />
                  <Skeleton width={(SCREEN_WIDTH - 40 - 10) / 2} height={100} borderRadius={8} />
                </Box>
              ) : derivedStations.length === 0 ? (
                <Box alignItems="center" style={{ paddingTop: 40 }}>
                  <Feather name="coffee" size={32} color={C.silver} />
                  <Text variant="muted" style={{ marginTop: 8 }}>No stations for this meal</Text>
                </Box>
              ) : (
                <Box flexDirection="row" flexWrap="wrap" style={{ gap: 10, marginTop: 8 }}>
                  {derivedStations.map((s) => {
                    const emoji = getStationEmoji(s.name);
                    return (
                      <AnimatedCard
                        key={s.name}
                        onPress={() => openStation(s.name)}
                        haptic
                        alignItems="center"
                        justifyContent="center"
                        padding="s"
                        style={{
                          width: (SCREEN_WIDTH - 40 - 10) / 2,
                          height: 100,
                        }}
                      >
                        {emoji ? (
                          <Text style={{ fontSize: 26 }}>{emoji}</Text>
                        ) : (
                          <Feather name="grid" size={22} color={C.silver} />
                        )}
                        <Text
                          variant="body"
                          style={{ fontFamily: 'DMSans_600SemiBold', fontSize: 12, textAlign: 'center', marginTop: 4 }}
                          numberOfLines={2}
                        >
                          {s.name}
                        </Text>
                        <Text variant="dim" style={{ position: 'absolute', bottom: 8 }}>{s.count} items</Text>
                      </AnimatedCard>
                    );
                  })}
                </Box>
              )
            )}

            {/* Recent Reviews — hidden during search */}
            {itemSearch.length === 0 && (
              <Box style={{ marginTop: 28 }}>
                <Text variant="cardTitle" style={{ fontSize: 18, fontFamily: 'Outfit_700Bold', marginBottom: 12 }}>Recent Reviews</Text>
                {reviewsLoading ? (
                  <Box style={{ gap: 10 }}>
                    <Skeleton width={'100%'} height={80} borderRadius={8} />
                    <Skeleton width={'100%'} height={80} borderRadius={8} />
                  </Box>
                ) : hallReviews.length === 0 ? (
                  <Box alignItems="center" style={{ paddingVertical: 24 }}>
                    <Feather name="message-circle" size={28} color={C.silver} />
                    <Text variant="muted" style={{ marginTop: 6 }}>No reviews yet — be the first!</Text>
                  </Box>
                ) : (
                  hallReviews.map((review, i) => {
                    const [yr, mo, dy] = review.date.split('-').map(Number);
                    const dateStr = new Date(yr, mo - 1, dy).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    return (
                      <Box
                        key={i}
                        borderRadius="m"
                        padding="m"
                        marginBottom="s"
                        style={{ backgroundColor: C.white, borderWidth: 1, borderColor: C.border }}
                      >
                        <Box flexDirection="row" justifyContent="space-between" alignItems="center" style={{ marginBottom: 6 }}>
                          <Box flexDirection="row" alignItems="center" style={{ gap: 4 }}>
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Feather key={s} name="star" size={14} color={s <= review.rating ? C.gold : C.textDim} />
                            ))}
                            <Text variant="body" style={{ fontFamily: 'DMSans_600SemiBold', fontSize: 13, marginLeft: 4 }}>
                              {review.user_name?.split(' ')[0] || 'Anonymous'}
                            </Text>
                          </Box>
                          <Text variant="dim">{dateStr}</Text>
                        </Box>
                        {review.review_text ? (
                          <Text variant="muted" style={{ lineHeight: 18 }}>{review.review_text}</Text>
                        ) : null}
                      </Box>
                    );
                  })
                )}
              </Box>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER — ITEMS VIEW (Task 4.3)
  // ═══════════════════════════════════════════════════════════════════════════

  if (view === 'items') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.offWhite }}>
        {renderToast()}
        {wrapAnimated(
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {renderHeader()}
            {renderSearchBar(itemSearch, setItemSearch, 'Search items...')}

            {filteredStationItems.length === 0 ? (
              <Box alignItems="center" style={{ paddingTop: 40 }}>
                <Feather name={itemSearch ? 'search' : 'inbox'} size={32} color={C.silver} />
                <Text variant="muted" style={{ marginTop: 8, textAlign: 'center' }}>
                  {itemSearch ? `No results for "${itemSearch}"` : 'No items found'}
                </Text>
                {itemSearch ? (
                  <Text variant="dim" style={{ marginTop: 4, textAlign: 'center' }}>Try a different search or browse halls below</Text>
                ) : null}
              </Box>
            ) : (
              <Box
                borderRadius="m"
                padding="m"
                style={{ backgroundColor: C.white, borderWidth: 1, borderColor: C.border }}
              >
                {filteredStationItems.map((item, i) => renderItemRow(item, i, filteredStationItems.length))}
              </Box>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER — DETAIL VIEW (Task 4.4)
  // ═══════════════════════════════════════════════════════════════════════════

  if (view === 'detail' && selectedItem) {
    const n = getNutr(selectedItem);
    const badge = getDietaryBadge(selectedItem.dietary_flags);
    const adjCal = Math.round(n.cal * servings);

    const getIndicatorDot = (label: string, rawValue: number): string | null => {
      if (label === 'Sodium' && rawValue > 600) return C.warning;
      if (label === 'Fiber' && rawValue > 5) return C.success;
      if (label === 'Protein' && rawValue > 20) return C.blue;
      if (label === 'Added Sugars' && rawValue > 10) return C.error;
      return null;
    };

    // Task 4.4: Macro bars with correct colors
    const macroBarData = [
      { label: 'Protein', val: Math.round(n.pro * servings), unit: 'g', color: C.blue },
      { label: 'Carbs', val: Math.round(n.carb * servings), unit: 'g', color: C.gold },
      { label: 'Fat', val: Math.round(n.fat * servings), unit: 'g', color: C.silver },
    ];

    const maxMacro = Math.max(...macroBarData.map((m) => m.val), 1);

    const nutritionGrid = [
      { label: 'Total Fat', val: `${Math.round(n.fat * servings)}g`, raw: n.fat * servings },
      { label: 'Sat Fat', val: `${Math.round(n.sat_fat * servings)}g`, raw: n.sat_fat * servings },
      { label: 'Trans Fat', val: `${Math.round(n.trans_fat * servings)}g`, raw: n.trans_fat * servings },
      { label: 'Cholesterol', val: `${Math.round(n.cholesterol * servings)}mg`, raw: n.cholesterol * servings },
      { label: 'Sodium', val: `${Math.round(n.sodium * servings)}mg`, raw: n.sodium * servings },
      { label: 'Total Carbs', val: `${Math.round(n.carb * servings)}g`, raw: n.carb * servings },
      { label: 'Fiber', val: `${Math.round(n.fiber * servings)}g`, raw: n.fiber * servings },
      { label: 'Sugars', val: `${Math.round(n.sugars * servings)}g`, raw: n.sugars * servings },
      { label: 'Added Sugars', val: `${Math.round(n.added_sugars * servings)}g`, raw: n.added_sugars * servings },
      { label: 'Protein', val: `${Math.round(n.pro * servings)}g`, raw: n.pro * servings },
      { label: 'Vitamin D', val: `${Math.round(n.vitamin_d * servings)}mcg`, raw: n.vitamin_d * servings },
      { label: 'Calcium', val: `${Math.round(n.calcium * servings)}mg`, raw: n.calcium * servings },
      { label: 'Iron', val: `${Math.round(n.iron * servings)}mg`, raw: n.iron * servings },
      { label: 'Potassium', val: `${Math.round(n.potassium * servings)}mg`, raw: n.potassium * servings },
    ];

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.offWhite }}>
        {renderToast()}
        {wrapAnimated(
          <>
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
              {renderHeader()}

              {/* Hero card */}
              <Box
                borderRadius="m"
                padding="l"
                style={{ backgroundColor: C.white, borderWidth: 1, borderColor: C.border, marginTop: 8 }}
              >
                <Text variant="pageTitle" style={{ fontSize: 24, textAlign: 'center' }}>{selectedItem.name}</Text>
                <Text variant="muted" style={{ textAlign: 'center', marginTop: 4 }}>
                  {selectedItem.station} · {selectedHall?.name}
                </Text>

                {/* Calorie hero: maroon */}
                <Text style={{ fontSize: 36, color: C.maroon, textAlign: 'center', fontFamily: 'Outfit_700Bold', marginTop: 12 }}>
                  {adjCal}
                </Text>
                <Text variant="muted" style={{ textAlign: 'center', marginTop: 2 }}>calories per serving</Text>

                {/* Task 4.4: Macro bars */}
                <Box style={{ marginTop: 20, gap: 12 }}>
                  {macroBarData.map((m) => (
                    <Box key={m.label} flexDirection="row" alignItems="center" style={{ gap: 10 }}>
                      <Text variant="dim" style={{ width: 50, textAlign: 'right' }}>{m.label}</Text>
                      <Box flex={1} style={{ height: 8, borderRadius: 4, backgroundColor: C.borderLight }}>
                        <Box
                          style={{
                            height: 8, borderRadius: 4,
                            backgroundColor: m.color,
                            width: `${Math.min((m.val / maxMacro) * 100, 100)}%`,
                          }}
                        />
                      </Box>
                      <Text variant="body" style={{ fontFamily: 'DMSans_700Bold', fontSize: 14, width: 40 }}>
                        {m.val}{m.unit}
                      </Text>
                    </Box>
                  ))}
                </Box>
              </Box>

              {/* Servings */}
              <Box style={{ marginTop: 20 }}>
                <Text variant="body" style={{ fontFamily: 'DMSans_600SemiBold', marginBottom: 10 }}>Servings</Text>
                <Box flexDirection="row" style={{ gap: 8 }}>
                  {[0.5, 1, 1.5, 2].map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={{
                        flex: 1, paddingVertical: 10, borderRadius: 6, alignItems: 'center',
                        backgroundColor: servings === s ? C.maroon : C.white,
                        borderWidth: 1, borderColor: servings === s ? C.maroon : C.border,
                      }}
                      onPress={() => { triggerHaptic('light'); setServings(s); }}
                    >
                      <Text variant="body" style={{
                        fontFamily: 'DMSans_600SemiBold', fontSize: 14,
                        color: servings === s ? C.white : C.text,
                      }}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </Box>
              </Box>

              {/* Micronutrient grid: flat silver labels, values right-aligned */}
              <Box style={{ marginTop: 20 }}>
                <Text variant="sectionHeader" style={{ marginBottom: 12 }}>NUTRITION DETAILS</Text>
                {nutritionGrid.map((item, i) => {
                  const dotColor = getIndicatorDot(item.label, item.raw);
                  return (
                    <Box
                      key={item.label}
                      flexDirection="row"
                      alignItems="center"
                      justifyContent="space-between"
                      style={{
                        paddingVertical: 10,
                        borderBottomWidth: i < nutritionGrid.length - 1 ? 1 : 0,
                        borderBottomColor: C.borderLight,
                      }}
                    >
                      <Box flexDirection="row" alignItems="center" style={{ gap: 6 }}>
                        <Text variant="body" style={{ color: C.silver, fontSize: 14 }}>{item.label}</Text>
                        {dotColor && <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: dotColor }} />}
                      </Box>
                      <Text variant="body" style={{ fontFamily: 'DMSans_700Bold', fontSize: 14 }}>{item.val}</Text>
                    </Box>
                  );
                })}
              </Box>

              <TouchableOpacity
                onPress={() => setShowMicros(true)}
                style={{ marginTop: 12, paddingVertical: 8 }}
                activeOpacity={0.7}
              >
                <Text variant="body" style={{ color: C.maroon, fontFamily: 'DMSans_600SemiBold', fontSize: 14 }}>
                  View All Nutrients →
                </Text>
              </TouchableOpacity>

              {selectedItem.dietary_flags && selectedItem.dietary_flags.length > 0 && (
                <Box flexDirection="row" flexWrap="wrap" style={{ gap: 8, marginTop: 16 }}>
                  {selectedItem.dietary_flags.map((flag: string) => (
                    <Box key={flag} style={{
                      paddingHorizontal: 12, paddingVertical: 6,
                      borderRadius: 4, backgroundColor: C.maroonMuted,
                    }}>
                      <Text style={{ fontSize: 12, color: C.maroon, fontFamily: 'DMSans_600SemiBold' }}>{flag}</Text>
                    </Box>
                  ))}
                </Box>
              )}

              {selectedItem.ingredients && (
                <Box
                  borderRadius="m"
                  padding="m"
                  style={{ backgroundColor: C.white, borderWidth: 1, borderColor: C.border, marginTop: 16 }}
                >
                  <Text variant="body" style={{ fontFamily: 'DMSans_600SemiBold', marginBottom: 8, fontSize: 13 }}>Ingredients</Text>
                  <Text variant="muted" style={{ lineHeight: 18, fontSize: 12 }}>{selectedItem.ingredients}</Text>
                </Box>
              )}
            </ScrollView>

            {/* Task 4.4: Full-width maroon log button with press-scale + haptic */}
            <Box style={{
              paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24,
              borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.offWhite,
            }}>
              <Text variant="muted" style={{ textAlign: 'center', marginBottom: 10 }}>
                {adjCal} cal · {servings} serving{servings !== 1 ? 's' : ''}
              </Text>
              <PressScaleButton
                onPress={logMeal}
                disabled={logging || logSuccess}
                style={{
                  height: 52, borderRadius: 6, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: logSuccess ? C.success : C.maroon,
                  opacity: logging ? 0.6 : 1,
                }}
              >
                <Text variant="body" style={{ color: C.white, fontFamily: 'DMSans_700Bold', fontSize: 16 }}>
                  {logging ? 'Logging...' : logSuccess ? 'Logged!' : 'Log This Item'}
                </Text>
              </PressScaleButton>
            </Box>
          </>
        )}
        <Modal
          visible={showMicros}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowMicros(false)}
        >
          <MicronutrientScreen onClose={() => setShowMicros(false)} />
        </Modal>
      </SafeAreaView>
    );
  }

  return null;
}
