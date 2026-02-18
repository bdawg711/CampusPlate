import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
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

function getDayLabel(offset: number) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString('en-US', { weekday: 'short' });
}

interface DayData {
  date: string;
  label: string;
  calories: number;
  protein: number;
  logged: boolean;
}

export default function ProgressScreen() {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [weekData, setWeekData] = useState<DayData[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [streak, setStreak] = useState(0);
  const [showWeightInput, setShowWeightInput] = useState(false);
  const [weightInput, setWeightInput] = useState('');
  const [savingWeight, setSavingWeight] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const userId = await requireUserId();

      const [profileRes] = await Promise.all([
        supabase.from('profiles').select('goal_calories, goal_protein_g, weight').eq('id', userId).single(),
      ]);
      if (profileRes.data) setProfile(profileRes.data);

      // Load 7 days
      const days: DayData[] = [];
      for (let i = 6; i >= 0; i--) {
        const date = getLocalDate(-i);
        const { data } = await supabase
          .from('meal_logs')
          .select('servings, menu_items(nutrition(calories, protein_g))')
          .eq('user_id', userId)
          .eq('date', date);

        let totalCal = 0;
        let totalPro = 0;
        (data || []).forEach((log: any) => {
          const n = Array.isArray(log.menu_items?.nutrition) ? log.menu_items.nutrition[0] : log.menu_items?.nutrition;
          if (n) {
            totalCal += Math.round((n.calories || 0) * (log.servings || 1));
            totalPro += Math.round((n.protein_g || 0) * (log.servings || 1));
          }
        });

        days.push({
          date,
          label: getDayLabel(-i),
          calories: totalCal,
          protein: totalPro,
          logged: (data || []).length > 0,
        });
      }
      setWeekData(days);

      // Calculate streak
      let s = 0;
      for (let i = days.length - 1; i >= 0; i--) {
        if (days[i].logged) s++;
        else break;
      }
      setStreak(s);
    } catch (e) {
      console.error('Progress load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const logWeight = async () => {
    const w = parseFloat(weightInput);
    if (!w || w < 50 || w > 500) return;
    setSavingWeight(true);
    try {
      const userId = await requireUserId();
      await supabase.from('profiles').update({ weight: w }).eq('id', userId);
      setProfile((p: any) => p ? { ...p, weight: w } : p);
      setShowWeightInput(false);
      setWeightInput('');
    } catch (e) {
      console.error('Weight save error:', e);
    } finally {
      setSavingWeight(false);
    }
  };

  const maxCal = Math.max(...weekData.map((d) => d.calories), 1);
  const avgCal = weekData.length > 0 ? Math.round(weekData.reduce((s, d) => s + d.calories, 0) / weekData.length) : 0;
  const avgPro = weekData.length > 0 ? Math.round(weekData.reduce((s, d) => s + d.protein, 0) / weekData.length) : 0;
  const goalCal = profile?.goal_calories || 2000;
  const adherence = weekData.filter((d) => d.logged).length > 0
    ? Math.round((weekData.filter((d) => d.logged && Math.abs(d.calories - goalCal) < goalCal * 0.2).length / weekData.filter((d) => d.logged).length) * 100)
    : 0;

  if (loading) {
    return (
      <SafeAreaView style={[st.safe, { backgroundColor: colors.background }]}>
        <View style={st.loadingWrap}><ActivityIndicator size="large" color={colors.maroon} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[st.safe, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={st.pad} showsVerticalScrollIndicator={false}>
        <Text style={[st.title, { color: colors.text, fontFamily: 'Outfit_700Bold' }]}>Progress</Text>

        {/* Streak Card */}
        <View style={[st.card, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
          <Text style={[{ fontSize: 13, color: colors.textMuted, fontFamily: 'DMSans_400Regular', textAlign: 'center' }]}>Current Streak</Text>
          <Text style={[{ fontSize: 42, color: colors.text, fontFamily: 'Outfit_800ExtraBold', textAlign: 'center', marginVertical: 8 }]}>
            {streak} <Text style={[{ fontSize: 18, color: colors.textMuted, fontFamily: 'DMSans_400Regular' }]}>days</Text>
          </Text>
          <View style={st.dotRow}>
            {weekData.map((d, i) => (
              <View key={i} style={{ alignItems: 'center' }}>
                <View style={[st.streakDot, { backgroundColor: d.logged ? colors.green : colors.textDim }]}>
                  {d.logged && <Text style={{ fontSize: 12, color: '#fff' }}>✓</Text>}
                </View>
                <Text style={[{ fontSize: 10, color: colors.textMuted, fontFamily: 'DMSans_400Regular', marginTop: 4 }]}>{d.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Weekly Calorie Chart */}
        <View style={[st.card, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, marginTop: 16 }]}>
          <Text style={[{ fontSize: 15, color: colors.text, fontFamily: 'DMSans_600SemiBold', marginBottom: 16 }]}>Weekly Calories</Text>
          <View style={st.chartWrap}>
            {weekData.map((d, i) => {
              const height = maxCal > 0 ? (d.calories / maxCal) * 120 : 0;
              const isToday = i === weekData.length - 1;
              return (
                <View key={i} style={st.barCol}>
                  <Text style={[{ fontSize: 10, color: colors.textMuted, fontFamily: 'DMSans_400Regular', marginBottom: 4 }]}>
                    {d.calories > 0 ? d.calories : ''}
                  </Text>
                  <View style={[st.bar, { height: Math.max(height, 4), backgroundColor: isToday ? colors.orange : colors.maroon }]} />
                  <Text style={[{ fontSize: 10, color: colors.textMuted, fontFamily: 'DMSans_400Regular', marginTop: 4 }]}>{d.label}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Stats Grid */}
        <View style={st.statsGrid}>
          {[
            { label: 'Avg Calories', val: avgCal.toLocaleString(), color: colors.text },
            { label: 'Avg Protein', val: `${avgPro}g`, color: colors.blue },
            { label: 'Current Weight', val: profile?.weight ? `${profile.weight} lbs` : '—', color: colors.text },
            { label: 'Goal Adherence', val: `${adherence}%`, color: colors.green },
          ].map((s) => (
            <View key={s.label} style={[st.statCard, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
              <Text style={[{ fontSize: 28, color: s.color, fontFamily: 'Outfit_800ExtraBold' }]}>{s.val}</Text>
              <Text style={[{ fontSize: 11, color: colors.textMuted, fontFamily: 'DMSans_400Regular', marginTop: 4 }]}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Log Weight */}
        <TouchableOpacity
          style={[st.card, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, marginTop: 16 }]}
          onPress={() => setShowWeightInput(!showWeightInput)}
        >
          <Text style={[{ fontSize: 15, color: colors.text, fontFamily: 'DMSans_600SemiBold' }]}>Log Weight</Text>
          <Text style={[{ fontSize: 12, color: colors.textMuted, fontFamily: 'DMSans_400Regular', marginTop: 4 }]}>
            Tap to update your current weight
          </Text>
        </TouchableOpacity>

        {showWeightInput && (
          <View style={[st.card, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, marginTop: 8 }]}>
            <TextInput
              style={[st.weightInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text, fontFamily: 'DMSans_400Regular' }]}
              placeholder="Weight in lbs"
              placeholderTextColor={colors.textDim}
              value={weightInput}
              onChangeText={setWeightInput}
              keyboardType="numeric"
            />
            <TouchableOpacity
              style={[st.saveBtn, { backgroundColor: colors.maroon, opacity: savingWeight ? 0.6 : 1 }]}
              onPress={logWeight}
              disabled={savingWeight}
            >
              <Text style={[{ color: '#fff', fontSize: 14, fontFamily: 'DMSans_700Bold' }]}>Save</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1 },
  pad: { padding: 20, paddingBottom: 40 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 26, marginBottom: 20 },
  card: { borderRadius: 14, padding: 16 },
  dotRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 16 },
  streakDot: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  chartWrap: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 160 },
  barCol: { alignItems: 'center', flex: 1 },
  bar: { width: 24, borderRadius: 6 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  statCard: { width: '48%', borderRadius: 14, padding: 16 },
  weightInput: { borderRadius: 12, padding: 14, fontSize: 16, borderWidth: 1, marginBottom: 12 },
  saveBtn: { padding: 12, borderRadius: 12, alignItems: 'center' },
});
