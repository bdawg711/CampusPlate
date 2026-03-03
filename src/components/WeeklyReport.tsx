import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Circle as SvgCircle, Line, Polyline, Rect } from 'react-native-svg';
import { Feather } from '@expo/vector-icons';
import { Text } from '@/src/theme/restyleTheme';
import { useTheme } from '@/src/context/ThemeContext';
import { requireUserId } from '@/src/utils/auth';
import {
  getWeeklyReport,
  type WeeklyReportData,
  type DailyTotal,
} from '@/src/utils/weeklyReport';

interface WeeklyReportProps {
  visible: boolean;
  onClose: () => void;
  initialEndDate?: string;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function formatLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDisplayDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getWeekDates(endDate: string): string[] {
  const end = new Date(endDate + 'T00:00:00');
  const dates: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(d.getDate() - i);
    dates.push(formatLocalDate(d));
  }
  return dates;
}

function getDayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return DAY_LABELS[d.getDay() === 0 ? 6 : d.getDay() - 1];
}

export default function WeeklyReport({ visible, onClose, initialEndDate }: WeeklyReportProps) {
  const { colors } = useTheme();
  const C = {
    white: colors.card,
    offWhite: colors.cardAlt,
    maroon: '#861F41',
    text: colors.text,
    textMuted: colors.textMuted,
    textDim: colors.textDim,
    border: colors.border,
    borderLight: colors.borderLight,
    silver: '#A8A9AD',
    blue: '#4A7FC5',
    gold: '#C5A55A',
    success: '#2D8A4E',
    error: '#C0392B',
  };

  const screenWidth = Dimensions.get('window').width;

  const [data, setData] = useState<WeeklyReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [endDate, setEndDate] = useState(initialEndDate ?? formatLocalDate(new Date()));
  const [selectedBar, setSelectedBar] = useState<number | null>(null);

  const fetchReport = useCallback(async (dateStr: string) => {
    setLoading(true);
    setSelectedBar(null);
    try {
      const userId = await requireUserId();
      const report = await getWeeklyReport(userId, dateStr);
      setData(report);
    } catch (err) {
      if (__DEV__) console.error('Weekly report load failed:', (err as Error).message);
      Alert.alert('Error', 'Failed to load weekly report.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      const date = initialEndDate ?? formatLocalDate(new Date());
      setEndDate(date);
      fetchReport(date);
    }
  }, [visible, initialEndDate]);

  const navigateWeek = (direction: -1 | 1) => {
    const d = new Date(endDate + 'T00:00:00');
    d.setDate(d.getDate() + direction * 7);
    const newDate = formatLocalDate(d);
    setEndDate(newDate);
    fetchReport(newDate);
  };

  const weekDates = getWeekDates(endDate);
  const dailyMap: Record<string, DailyTotal> = {};
  for (const dt of data?.dailyTotals ?? []) dailyMap[dt.date] = dt;
  const waterMap: Record<string, number> = {};
  for (const w of data?.waterTotals ?? []) waterMap[w.date] = w.totalOz;

  const barData = weekDates.map((date) => ({
    date,
    label: getDayLabel(date),
    calories: dailyMap[date]?.calories ?? 0,
    protein: dailyMap[date]?.protein ?? 0,
    carbs: dailyMap[date]?.carbs ?? 0,
    fat: dailyMap[date]?.fat ?? 0,
    mealsLogged: dailyMap[date]?.mealsLogged ?? 0,
  }));

  const goalCal = data?.goals.calories ?? 2000;
  const maxCal = Math.max(...barData.map((b) => b.calories), goalCal * 1.15);

  const chartWidth = screenWidth - 80;
  const chartHeight = 150;
  const barWidth = (chartWidth - 48) / 7;
  const barGap = 8;

  function getBarColor(cal: number): string {
    if (cal === 0) return C.border;
    if (cal > goalCal * 1.05) return C.error;
    if (cal >= goalCal * 0.85) return C.success;
    return C.maroon;
  }

  const avgP = data?.averages.protein ?? 0;
  const avgC = data?.averages.carbs ?? 0;
  const avgF = data?.averages.fat ?? 0;
  const totalMacroG = avgP + avgC + avgF;
  const pRatio = totalMacroG > 0 ? avgP / totalMacroG : 0.33;
  const cRatio = totalMacroG > 0 ? avgC / totalMacroG : 0.33;
  const fRatio = totalMacroG > 0 ? avgF / totalMacroG : 0.34;

  const goalP = data?.goals.protein ?? 150;
  const goalC = data?.goals.carbs ?? 250;
  const goalF = data?.goals.fat ?? 65;
  const goalTotalG = goalP + goalC + goalF;
  const goalPRatio = goalTotalG > 0 ? goalP / goalTotalG : 0.33;
  const goalCRatio = goalTotalG > 0 ? goalC / goalTotalG : 0.33;
  const goalFRatio = goalTotalG > 0 ? goalF / goalTotalG : 0.34;

  const macroBarWidth = screenWidth - 80;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.white }}>
        {/* Modal handle */}
        <View style={{ alignItems: 'center', paddingTop: 8, paddingBottom: 4 }}>
          <View style={{ width: 36, height: 4, borderRadius: 9999, backgroundColor: C.silver }} />
        </View>

        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: C.border }}>
          <TouchableOpacity onPress={onClose} style={{ width: 64 }} activeOpacity={0.6}>
            <Text style={{ fontSize: 15, color: C.silver, fontFamily: 'DMSans_500Medium' }}>Close</Text>
          </TouchableOpacity>
          <Text style={{ flex: 1, textAlign: 'center', fontSize: 17, color: C.text, fontFamily: 'Outfit_700Bold' }}>Weekly Report</Text>
          <View style={{ width: 64 }} />
        </View>

        {loading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 }}>
            <ActivityIndicator size="large" color={C.maroon} />
          </View>
        ) : !data ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 }}>
            <Feather name="bar-chart-2" size={32} color={C.silver} />
            <Text style={{ fontSize: 14, marginTop: 4, color: C.textMuted, fontFamily: 'DMSans_400Regular' }}>
              No report data available
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 20 }} showsVerticalScrollIndicator={false}>
            {/* Week navigation */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <TouchableOpacity onPress={() => navigateWeek(-1)} style={{ padding: 8 }} activeOpacity={0.6}>
                <Feather name="chevron-left" size={24} color={C.maroon} />
              </TouchableOpacity>
              <Text style={{ fontSize: 15, color: C.text, fontFamily: 'DMSans_600SemiBold' }}>
                {formatDisplayDate(data.startDate)} – {formatDisplayDate(data.endDate)}
              </Text>
              <TouchableOpacity onPress={() => navigateWeek(1)} style={{ padding: 8 }} activeOpacity={0.6}>
                <Feather name="chevron-right" size={24} color={C.maroon} />
              </TouchableOpacity>
            </View>

            {/* 1. Summary cards (2x2) */}
            <Text style={{ fontSize: 11, fontFamily: 'DMSans_600SemiBold', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10, marginTop: 4, color: C.silver }}>DAILY AVERAGES</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              <SummaryCard label="Calories" value={`${data.averages.calories}`} unit="cal" pct={data.adherence.calories} color={C.maroon} />
              <SummaryCard label="Protein" value={`${data.averages.protein}g`} unit="" pct={data.adherence.protein} color={C.blue} />
              <SummaryCard label="Carbs" value={`${data.averages.carbs}g`} unit="" pct={data.adherence.carbs} color={C.gold} />
              <SummaryCard label="Fat" value={`${data.averages.fat}g`} unit="" pct={data.adherence.fat} color={C.silver} />
            </View>

            {/* 2. Daily bar chart */}
            <Text style={{ fontSize: 11, fontFamily: 'DMSans_600SemiBold', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10, marginTop: 20, color: C.silver }}>DAILY CALORIES</Text>
            <View style={{ borderRadius: 12, borderWidth: 1, padding: 16, borderColor: C.border, backgroundColor: C.white }}>
              <Svg width={chartWidth} height={chartHeight + 24}>
                <Line
                  x1={0} y1={chartHeight - (goalCal / maxCal) * chartHeight}
                  x2={chartWidth} y2={chartHeight - (goalCal / maxCal) * chartHeight}
                  stroke={C.textMuted} strokeWidth={1} strokeDasharray="6,4" opacity={0.5}
                />
                {barData.map((bar, i) => {
                  const barH = maxCal > 0 ? (bar.calories / maxCal) * chartHeight : 0;
                  const x = i * (barWidth + barGap);
                  const y = chartHeight - barH;
                  return (
                    <Rect key={bar.date} x={x} y={y} width={barWidth} height={Math.max(barH, 2)} rx={4}
                      fill={getBarColor(bar.calories)} opacity={selectedBar !== null && selectedBar !== i ? 0.4 : 1}
                      onPress={() => setSelectedBar(selectedBar === i ? null : i)} />
                  );
                })}
              </Svg>
              <View style={{ flexDirection: 'row', marginTop: 4, width: chartWidth }}>
                {barData.map((bar, i) => (
                  <Pressable key={bar.date} style={{ width: barWidth + barGap, alignItems: 'center' }} onPress={() => setSelectedBar(selectedBar === i ? null : i)}>
                    <Text style={{ fontSize: 11, color: selectedBar === i ? C.text : C.textMuted, fontFamily: 'DMSans_500Medium' }}>{bar.label}</Text>
                  </Pressable>
                ))}
              </View>
              {selectedBar !== null && (
                <View style={{ marginTop: 10, borderRadius: 8, borderWidth: 1, padding: 10, borderColor: C.border, backgroundColor: C.offWhite }}>
                  <Text style={{ fontSize: 13, marginBottom: 2, color: C.text, fontFamily: 'DMSans_600SemiBold' }}>
                    {barData[selectedBar].label} · {formatDisplayDate(barData[selectedBar].date)}
                  </Text>
                  <Text style={{ fontSize: 12, lineHeight: 18, color: C.textMuted, fontFamily: 'DMSans_400Regular' }}>
                    {barData[selectedBar].calories} cal · {barData[selectedBar].protein}g P · {barData[selectedBar].carbs}g C · {barData[selectedBar].fat}g F
                  </Text>
                  <Text style={{ fontSize: 12, lineHeight: 18, color: C.textMuted, fontFamily: 'DMSans_400Regular' }}>
                    {barData[selectedBar].mealsLogged} meals logged
                  </Text>
                </View>
              )}
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.maroon }} />
                  <Text style={{ fontSize: 11, color: C.textMuted, fontFamily: 'DMSans_400Regular' }}>Under</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.success }} />
                  <Text style={{ fontSize: 11, color: C.textMuted, fontFamily: 'DMSans_400Regular' }}>On target</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.error }} />
                  <Text style={{ fontSize: 11, color: C.textMuted, fontFamily: 'DMSans_400Regular' }}>Over</Text>
                </View>
                <Text style={{ fontSize: 11, color: C.textMuted, fontFamily: 'DMSans_400Regular' }}>--- Goal ({goalCal})</Text>
              </View>
            </View>

            {/* 3. Macro breakdown */}
            <Text style={{ fontSize: 11, fontFamily: 'DMSans_600SemiBold', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10, marginTop: 20, color: C.silver }}>MACRO BREAKDOWN</Text>
            <View style={{ borderRadius: 12, borderWidth: 1, padding: 16, borderColor: C.border, backgroundColor: C.white }}>
              <Text style={{ fontSize: 13, marginBottom: 6, color: C.text, fontFamily: 'DMSans_500Medium' }}>Actual</Text>
              <View style={{ flexDirection: 'row', height: 14, borderRadius: 6, overflow: 'hidden', width: macroBarWidth }}>
                <View style={{ flex: pRatio, height: 14, backgroundColor: C.blue, borderTopLeftRadius: 6, borderBottomLeftRadius: 6 }} />
                <View style={{ flex: cRatio, height: 14, backgroundColor: C.gold }} />
                <View style={{ flex: fRatio, height: 14, backgroundColor: C.silver, borderTopRightRadius: 6, borderBottomRightRadius: 6 }} />
              </View>
              <Text style={{ fontSize: 13, marginBottom: 6, marginTop: 12, color: C.text, fontFamily: 'DMSans_500Medium' }}>Goal</Text>
              <View style={{ flexDirection: 'row', height: 14, borderRadius: 6, overflow: 'hidden', width: macroBarWidth }}>
                <View style={{ flex: goalPRatio, height: 14, backgroundColor: C.blue, opacity: 0.4, borderTopLeftRadius: 6, borderBottomLeftRadius: 6 }} />
                <View style={{ flex: goalCRatio, height: 14, backgroundColor: C.gold, opacity: 0.4 }} />
                <View style={{ flex: goalFRatio, height: 14, backgroundColor: C.silver, opacity: 0.4, borderTopRightRadius: 6, borderBottomRightRadius: 6 }} />
              </View>
              <View style={{ flexDirection: 'row', gap: 14, marginTop: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.blue }} />
                  <Text style={{ fontSize: 11, color: C.textMuted, fontFamily: 'DMSans_400Regular' }}>Protein {Math.round(pRatio * 100)}%</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.gold }} />
                  <Text style={{ fontSize: 11, color: C.textMuted, fontFamily: 'DMSans_400Regular' }}>Carbs {Math.round(cRatio * 100)}%</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.silver }} />
                  <Text style={{ fontSize: 11, color: C.textMuted, fontFamily: 'DMSans_400Regular' }}>Fat {Math.round(fRatio * 100)}%</Text>
                </View>
              </View>
            </View>

            {/* 4. Hydration */}
            <Text style={{ fontSize: 11, fontFamily: 'DMSans_600SemiBold', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10, marginTop: 20, color: C.silver }}>HYDRATION</Text>
            <View style={{ borderRadius: 12, borderWidth: 1, padding: 16, borderColor: C.border, backgroundColor: C.white }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <View>
                  <Text style={{ fontSize: 22, color: C.blue, fontFamily: 'Outfit_700Bold' }}>{isNaN(data.avgWaterOz) ? 0 : data.avgWaterOz} oz</Text>
                  <Text style={{ fontSize: 12, marginTop: 2, color: C.textMuted, fontFamily: 'DMSans_400Regular' }}>avg daily · goal {data.goals.waterGoalOz} oz</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 22, color: C.success, fontFamily: 'Outfit_700Bold' }}>{data.daysWaterGoalMet}/7</Text>
                  <Text style={{ fontSize: 12, marginTop: 2, color: C.textMuted, fontFamily: 'DMSans_400Regular' }}>days goal met</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
                {weekDates.map((date) => {
                  const met = (waterMap[date] ?? 0) >= data.goals.waterGoalOz;
                  return (
                    <View key={date} style={{ alignItems: 'center' }}>
                      <View style={[
                        { width: 28, height: 28, borderRadius: 14, marginBottom: 4 },
                        met ? { backgroundColor: C.blue } : { borderWidth: 2, borderColor: C.border },
                      ]} />
                      <Text style={{ fontSize: 10, color: C.textMuted, fontFamily: 'DMSans_400Regular' }}>{getDayLabel(date)}</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* 5. Streaks */}
            <Text style={{ fontSize: 11, fontFamily: 'DMSans_600SemiBold', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10, marginTop: 20, color: C.silver }}>STREAKS & CONSISTENCY</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1, borderRadius: 12, borderWidth: 1, padding: 14, alignItems: 'center', borderColor: C.border, backgroundColor: C.white }}>
                <Feather name="zap" size={24} color={C.gold} />
                <Text style={{ fontSize: 20, marginTop: 6, color: C.text, fontFamily: 'Outfit_700Bold' }}>{data.streak}</Text>
                <Text style={{ fontSize: 11, marginTop: 2, textAlign: 'center', color: C.textMuted, fontFamily: 'DMSans_400Regular' }}>day streak</Text>
              </View>
              <View style={{ flex: 1, borderRadius: 12, borderWidth: 1, padding: 14, alignItems: 'center', borderColor: C.border, backgroundColor: C.white }}>
                <Feather name="calendar" size={24} color={C.blue} />
                <Text style={{ fontSize: 20, marginTop: 6, color: C.text, fontFamily: 'Outfit_700Bold' }}>{data.daysLogged}/7</Text>
                <Text style={{ fontSize: 11, marginTop: 2, textAlign: 'center', color: C.textMuted, fontFamily: 'DMSans_400Regular' }}>days logged</Text>
              </View>
              <View style={{ flex: 1, borderRadius: 12, borderWidth: 1, padding: 14, alignItems: 'center', borderColor: C.border, backgroundColor: C.white }}>
                <Feather name="star" size={24} color={C.gold} />
                <Text style={{ fontSize: 20, marginTop: 6, color: C.text, fontFamily: 'Outfit_700Bold' }}>{data.mostConsistentMeal}</Text>
                <Text style={{ fontSize: 11, marginTop: 2, textAlign: 'center', color: C.textMuted, fontFamily: 'DMSans_400Regular' }}>most consistent</Text>
              </View>
            </View>

            {/* 6. Weight trend */}
            {data.weightEntries.length >= 2 && (() => {
              const entries = data.weightEntries;
              const startW = entries[0].weight;
              const endW = entries[entries.length - 1].weight;
              const change = endW - startW;
              const changeStr = (change >= 0 ? '+' : '') + change.toFixed(1);

              const weights = entries.map((e) => e.weight);
              const minW = Math.min(...weights);
              const maxW = Math.max(...weights);
              const range = maxW - minW || 1;
              const padding = range * 0.15;
              const yMin = minW - padding;
              const yMax = maxW + padding;

              const wChartW = screenWidth - 80;
              const wChartH = 120;

              const points = entries.map((e, i) => {
                const x = entries.length === 1 ? wChartW / 2 : (i / (entries.length - 1)) * wChartW;
                const y = wChartH - ((e.weight - yMin) / (yMax - yMin)) * wChartH;
                return { x, y };
              });

              const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(' ');

              return (
                <>
                  <Text style={{ fontSize: 11, fontFamily: 'DMSans_600SemiBold', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10, marginTop: 20, color: C.silver }}>WEIGHT TREND</Text>
                  <View style={{ borderRadius: 12, borderWidth: 1, padding: 16, borderColor: C.border, backgroundColor: C.white }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <View>
                        <Text style={{ fontSize: 20, color: C.text, fontFamily: 'Outfit_700Bold' }}>{startW} lbs</Text>
                        <Text style={{ fontSize: 11, marginTop: 2, color: C.textMuted, fontFamily: 'DMSans_400Regular' }}>{formatDisplayDate(entries[0].date)}</Text>
                      </View>
                      <View style={{ alignItems: 'center' }}>
                        <Text style={{ fontSize: 15, color: change === 0 ? C.textMuted : change < 0 ? C.success : C.gold, fontFamily: 'DMSans_600SemiBold' }}>
                          {changeStr} lbs
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ fontSize: 20, color: C.text, fontFamily: 'Outfit_700Bold' }}>{endW} lbs</Text>
                        <Text style={{ fontSize: 11, marginTop: 2, color: C.textMuted, fontFamily: 'DMSans_400Regular' }}>{formatDisplayDate(entries[entries.length - 1].date)}</Text>
                      </View>
                    </View>
                    <Svg width={wChartW} height={wChartH} style={{ marginTop: 12 }}>
                      <Polyline points={polylinePoints} fill="none" stroke={C.maroon} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
                      {points.map((p, i) => (
                        <SvgCircle key={entries[i].date} cx={p.x} cy={p.y} r={4} fill={C.maroon} stroke={C.white} strokeWidth={2} />
                      ))}
                    </Svg>
                  </View>
                </>
              );
            })()}

            <View style={{ height: 40 }} />
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

function SummaryCard({ label, value, unit, pct, color }: {
  label: string; value: string; unit: string; pct: number; color: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ width: '48%' as any, flexGrow: 1, borderRadius: 12, borderWidth: 1, padding: 14, borderColor: colors.border, backgroundColor: colors.card }}>
      <Text style={{ fontSize: 24, color, fontFamily: 'Outfit_700Bold' }}>
        {value}{unit ? <Text style={{ fontSize: 14 }}> {unit}</Text> : null}
      </Text>
      <Text style={{ fontSize: 12, marginTop: 2, color: colors.textMuted, fontFamily: 'DMSans_400Regular' }}>{label}</Text>
      <Text style={{ fontSize: 12, marginTop: 4, fontFamily: 'DMSans_600SemiBold', color: pct >= 85 && pct <= 115 ? '#2D8A4E' : pct > 115 ? '#C0392B' : '#861F41' }}>
        {pct}% of goal
      </Text>
    </View>
  );
}
