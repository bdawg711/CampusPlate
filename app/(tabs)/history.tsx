import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/src/context/ThemeContext';
import { requireUserId } from '@/src/utils/auth';
import { supabase } from '@/src/utils/supabase';
import { logBelongsToMealGroup } from '@/src/utils/meals';

function getLocalDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getDays(count: number) {
  const days: { date: string; dayNum: number; dayName: string; label: string }[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({
      date: getLocalDate(d),
      dayNum: d.getDate(),
      dayName: d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
      label: i === 0 ? 'Today' : i === 1 ? 'Yesterday' : d.toLocaleDateString('en-US', { weekday: 'short' }),
    });
  }
  return days;
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const PILL_WIDTH = 52;
const PILL_MARGIN = 8;
const STRIP_PADDING = 20;

export default function HistoryScreen() {
  const { colors } = useTheme();
  const [selectedDate, setSelectedDate] = useState(getLocalDate());
  const [logs, setLogs] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const dateStripRef = useRef<ScrollView>(null);
  const days = getDays(30);

  // Auto-scroll date strip to center the selected date
  useEffect(() => {
    const selectedIndex = days.findIndex((d) => d.date === selectedDate);
    if (selectedIndex >= 0 && dateStripRef.current) {
      const itemFullWidth = PILL_WIDTH + PILL_MARGIN;
      const offset = Math.max(
        0,
        (selectedIndex * itemFullWidth) - (SCREEN_WIDTH / 2) + (PILL_WIDTH / 2) + STRIP_PADDING
      );
      setTimeout(() => {
        dateStripRef.current?.scrollTo({ x: offset, animated: true });
      }, 100);
    }
  }, [selectedDate]);

  const loadData = useCallback(async (date: string) => {
    try {
      const userId = await requireUserId();
      const [profileRes, logsRes] = await Promise.all([
        supabase.from('profiles').select('goal_calories, goal_protein_g, goal_carbs_g, goal_fat_g').eq('id', userId).single(),
        supabase
          .from('meal_logs')
          .select('id, servings, meal, created_at, menu_items(id, name, station, nutrition(calories, protein_g, total_carbs_g, total_fat_g))')
          .eq('user_id', userId)
          .eq('date', date)
          .order('created_at', { ascending: true }),
      ]);
      if (profileRes.data) setProfile(profileRes.data);
      setLogs(logsRes.data || []);
    } catch (e) {
      if (__DEV__) console.error('History load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadData(selectedDate); }, [selectedDate, loadData]));

  const selectDate = (date: string) => {
    Haptics.selectionAsync();
    setSelectedDate(date);
    setLoading(true);
    loadData(date);
  };

  const getNutrition = (log: any) => {
    const raw = log.menu_items?.nutrition;
    const n = Array.isArray(raw) ? raw[0] : raw;
    const cal = n?.calories || 0;
    const pro = n?.protein_g || 0;
    const carb = n?.total_carbs_g || 0;
    const fat = n?.total_fat_g || 0;
    const s = log.servings || 1;
    return { cal: Math.round(cal * s), pro: Math.round(pro * s), carb: Math.round(carb * s), fat: Math.round(fat * s) };
  };

  const totalCal = logs.reduce((sum: number, l: any) => sum + getNutrition(l).cal, 0);
  const totalPro = logs.reduce((sum: number, l: any) => sum + getNutrition(l).pro, 0);
  const totalCarb = logs.reduce((sum: number, l: any) => sum + getNutrition(l).carb, 0);
  const totalFat = logs.reduce((sum: number, l: any) => sum + getNutrition(l).fat, 0);

  const renderMealGroup = (meal: string, label: string) => {
    const mealLogs = logs.filter((l: any) => logBelongsToMealGroup(l.meal, meal));
    const mealCals = mealLogs.reduce((sum: number, l: any) => sum + getNutrition(l).cal, 0);
    return (
      <View key={meal} style={{ marginBottom: 20 }}>
        <Text style={{ fontSize: 12, fontFamily: 'DMSans_700Bold', letterSpacing: 1.5, opacity: 0.3, textTransform: 'uppercase', marginBottom: 12, color: colors.text }}>{label} — {mealCals} cal</Text>
        {mealLogs.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 12 }}>
            <Feather name="clipboard" size={32} color="#A8A9AD" />
            <Text style={[{ fontSize: 13, color: colors.textMuted, marginTop: 4, fontFamily: 'DMSans_400Regular' }]}>
              No {label.toLowerCase()} logged
            </Text>
          </View>
        ) : (
          mealLogs.map((log: any, i: number) => {
            const n = getNutrition(log);
            const name = log.menu_items?.name || 'Unknown item';
            return (
              <View key={log.id}>
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, marginRight: 12, backgroundColor: colors.maroon }} />
                  <Text style={{ flex: 1, fontSize: 14, color: colors.text, fontFamily: 'DMSans_500Medium' }} numberOfLines={1}>{name}</Text>
                  <Text style={{ fontSize: 14, opacity: 0.7, color: colors.text, fontFamily: 'DMSans_600SemiBold' }}>{n.cal}</Text>
                </View>
                {i < mealLogs.length - 1 && <View style={{ height: 1, marginLeft: 20, backgroundColor: colors.cardGlassBorder }} />}
              </View>
            );
          })
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(selectedDate).then(() => setRefreshing(false)); }} tintColor={colors.maroon} />}
      >
        <View style={{ paddingHorizontal: 20 }}>
          <Text style={{ fontSize: 26, marginTop: 8, marginBottom: 16, color: colors.text, fontFamily: 'Outfit_700Bold' }}>History</Text>
        </View>

        {/* Day Strip */}
        <ScrollView
          ref={dateStripRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16 }}
        >
          {days.map((d) => {
            const sel = d.date === selectedDate;
            return (
              <TouchableOpacity
                key={d.date}
                style={{ alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 24, marginRight: 8, minWidth: 52, backgroundColor: sel ? colors.maroon : colors.cardGlass, borderColor: sel ? colors.maroon : colors.cardGlassBorder, borderWidth: 1 }}
                onPress={() => selectDate(d.date)}
              >
                <Text style={{ fontSize: 18, marginBottom: 2, color: sel ? '#fff' : colors.text, fontFamily: 'Outfit_700Bold' }}>{d.dayNum}</Text>
                <Text style={{ fontSize: 10, textTransform: 'uppercase', color: sel ? 'rgba(255,255,255,0.7)' : colors.textMuted, fontFamily: 'DMSans_400Regular' }}>{d.dayName}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {loading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 40 }}><ActivityIndicator size="large" color={colors.maroon} /></View>
        ) : (
          <View style={{ paddingHorizontal: 20 }}>
            {/* Daily Summary */}
            <View style={{ borderRadius: 14, padding: 20, backgroundColor: colors.cardGlass, borderColor: colors.cardGlassBorder, borderWidth: 1 }}>
              <Text style={[{ fontSize: 12, color: colors.textMuted, fontFamily: 'DMSans_400Regular', textAlign: 'center' }]}>Total Intake</Text>
              <Text style={[{ fontSize: 36, color: colors.text, fontFamily: 'Outfit_800ExtraBold', textAlign: 'center', marginVertical: 4 }]}>{totalCal}</Text>
              <Text style={[{ fontSize: 13, color: colors.textMuted, fontFamily: 'DMSans_400Regular', textAlign: 'center' }]}>
                of {profile?.goal_calories || 2000} calories
              </Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: 16 }}>
                {[
                  { label: 'Protein', val: totalPro, color: colors.blue },
                  { label: 'Carbs', val: totalCarb, color: colors.orange },
                  { label: 'Fat', val: totalFat, color: colors.yellow },
                ].map((s) => (
                  <View key={s.label} style={{ alignItems: 'center' }}>
                    <Text style={[{ fontSize: 18, color: s.color, fontFamily: 'Outfit_700Bold' }]}>{s.val}g</Text>
                    <Text style={[{ fontSize: 11, color: colors.textMuted, fontFamily: 'DMSans_400Regular' }]}>{s.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Meals */}
            <View style={{ marginTop: 24 }}>
              {renderMealGroup('Breakfast', 'BREAKFAST')}
              {renderMealGroup('Lunch', 'LUNCH')}
              {renderMealGroup('Dinner', 'DINNER')}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

