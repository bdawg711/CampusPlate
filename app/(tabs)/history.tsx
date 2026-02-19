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
import * as Haptics from 'expo-haptics';
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

export default function HistoryScreen() {
  const { colors } = useTheme();
  const [selectedDate, setSelectedDate] = useState(getLocalDate());
  const [logs, setLogs] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const days = getDays(30);

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
      console.error('History load error:', e);
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
        <Text style={[st.mealHeader, { color: colors.text }]}>{label} — {mealCals} cal</Text>
        {mealLogs.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 12 }}>
            <Text style={{ fontSize: 24 }}>🍽️</Text>
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
                <View style={st.logRow}>
                  <View style={[st.logDot, { backgroundColor: colors.maroon }]} />
                  <Text style={[st.logName, { color: colors.text, fontFamily: 'DMSans_500Medium' }]} numberOfLines={1}>{name}</Text>
                  <Text style={[st.logCal, { color: colors.text, fontFamily: 'DMSans_600SemiBold' }]}>{n.cal}</Text>
                </View>
                {i < mealLogs.length - 1 && <View style={[st.divider, { backgroundColor: colors.border }]} />}
              </View>
            );
          })
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[st.safe, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(selectedDate).then(() => setRefreshing(false)); }} tintColor={colors.maroon} />}
      >
        <View style={st.pad}>
          <Text style={[st.title, { color: colors.text, fontFamily: 'Outfit_700Bold' }]}>History</Text>
        </View>

        {/* Day Strip */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16 }}
        >
          {days.map((d) => {
            const sel = d.date === selectedDate;
            return (
              <TouchableOpacity
                key={d.date}
                style={[st.dayPill, { backgroundColor: sel ? colors.maroon : colors.card, borderColor: sel ? colors.maroon : colors.border, borderWidth: 1 }]}
                onPress={() => selectDate(d.date)}
              >
                <Text style={[st.dayNum, { color: sel ? '#fff' : colors.text, fontFamily: 'Outfit_700Bold' }]}>{d.dayNum}</Text>
                <Text style={[st.dayName, { color: sel ? 'rgba(255,255,255,0.7)' : colors.textMuted, fontFamily: 'DMSans_400Regular' }]}>{d.dayName}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {loading ? (
          <View style={st.loadingWrap}><ActivityIndicator size="large" color={colors.maroon} /></View>
        ) : (
          <View style={st.pad}>
            {/* Daily Summary */}
            <View style={[st.summaryCard, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
              <Text style={[{ fontSize: 12, color: colors.textMuted, fontFamily: 'DMSans_400Regular', textAlign: 'center' }]}>Total Intake</Text>
              <Text style={[{ fontSize: 36, color: colors.text, fontFamily: 'Outfit_800ExtraBold', textAlign: 'center', marginVertical: 4 }]}>{totalCal}</Text>
              <Text style={[{ fontSize: 13, color: colors.textMuted, fontFamily: 'DMSans_400Regular', textAlign: 'center' }]}>
                of {profile?.goal_calories || 2000} calories
              </Text>
              <View style={st.statRow}>
                {[
                  { label: 'Protein', val: totalPro, color: colors.blue },
                  { label: 'Carbs', val: totalCarb, color: colors.orange },
                  { label: 'Fat', val: totalFat, color: colors.yellow },
                ].map((s) => (
                  <View key={s.label} style={st.statItem}>
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

const st = StyleSheet.create({
  safe: { flex: 1 },
  pad: { paddingHorizontal: 20 },
  title: { fontSize: 26, marginTop: 8, marginBottom: 16 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 40 },
  dayPill: { alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 24, marginRight: 8, minWidth: 52 },
  dayNum: { fontSize: 18, marginBottom: 2 },
  dayName: { fontSize: 10, textTransform: 'uppercase' },
  summaryCard: { borderRadius: 14, padding: 20 },
  statRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 16 },
  statItem: { alignItems: 'center' },
  mealHeader: { fontSize: 12, fontWeight: '700', letterSpacing: 1.5, opacity: 0.3, textTransform: 'uppercase', marginBottom: 12 },
  logRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  logDot: { width: 8, height: 8, borderRadius: 4, marginRight: 12 },
  logName: { flex: 1, fontSize: 14 },
  logCal: { fontSize: 14, opacity: 0.7 },
  divider: { height: 1, marginLeft: 20 },
});
