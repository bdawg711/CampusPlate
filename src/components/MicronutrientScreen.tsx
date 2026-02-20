import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { requireUserId } from '../utils/auth';
import {
  getDailyMicronutrients,
  getPeriodMicronutrients,
  FDA_DAILY_VALUES,
  type MicronutrientData,
} from '../utils/micronutrients';

interface Props {
  onClose?: () => void;
}

type RangeKey = 'today' | '1w' | '1m' | '3m';
const RANGES: { key: RangeKey; label: string; days: number }[] = [
  { key: 'today', label: 'Today', days: 0 },
  { key: '1w', label: '1 Week', days: 7 },
  { key: '1m', label: '1 Month', days: 30 },
  { key: '3m', label: '3 Months', days: 90 },
];

// Section definitions mapping MicronutrientData keys to display
interface NutrientRow {
  key: keyof MicronutrientData;
  label: string;
  fdaKey: keyof typeof FDA_DAILY_VALUES;
}

const SECTIONS: { title: string; rows: NutrientRow[] }[] = [
  {
    title: 'FAT BREAKDOWN',
    rows: [
      { key: 'saturatedFat', label: 'Saturated Fat', fdaKey: 'saturatedFat' },
      { key: 'transFat', label: 'Trans Fat', fdaKey: 'transFat' },
    ],
  },
  {
    title: 'MINERALS',
    rows: [
      { key: 'sodium', label: 'Sodium', fdaKey: 'sodium' },
      { key: 'calcium', label: 'Calcium', fdaKey: 'calcium' },
      { key: 'iron', label: 'Iron', fdaKey: 'iron' },
      { key: 'potassium', label: 'Potassium', fdaKey: 'potassium' },
    ],
  },
  {
    title: 'VITAMINS',
    rows: [
      { key: 'vitaminD', label: 'Vitamin D', fdaKey: 'vitaminD' },
    ],
  },
  {
    title: 'FIBER & SUGARS',
    rows: [
      { key: 'fiber', label: 'Dietary Fiber', fdaKey: 'fiber' },
      { key: 'sugars', label: 'Total Sugars', fdaKey: 'sugars' },
      { key: 'addedSugars', label: 'Added Sugars', fdaKey: 'addedSugars' },
    ],
  },
  {
    title: 'OTHER',
    rows: [
      { key: 'cholesterol', label: 'Cholesterol', fdaKey: 'cholesterol' },
    ],
  },
];

function getLocalDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function subtractDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function getBarColor(pct: number, isTransFat: boolean, colors: any): string {
  if (isTransFat) return pct > 0 ? colors.red : colors.barTrack;
  if (pct >= 150) return colors.red;
  if (pct >= 100) return colors.green;
  if (pct >= 50) return colors.yellow;
  return `${colors.textDim}4D`; // ~30% opacity hex
}

export default function MicronutrientScreen({ onClose }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [range, setRange] = useState<RangeKey>('today');
  const [data, setData] = useState<MicronutrientData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [range]);

  async function loadData() {
    setLoading(true);
    try {
      const userId = await requireUserId();
      const today = getLocalDate();

      if (range === 'today') {
        const result = await getDailyMicronutrients(userId, today);
        setData(result);
      } else {
        const days = RANGES.find((r) => r.key === range)?.days ?? 7;
        const start = subtractDays(today, days);
        const result = await getPeriodMicronutrients(userId, start, today);
        setData(result);
      }
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        {onClose && (
          <TouchableOpacity onPress={onClose} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color={colors.text} />
          </TouchableOpacity>
        )}
        <Text style={[styles.title, { color: colors.text }]}>Nutrition Details</Text>
      </View>

      {/* Range tabs */}
      <View style={styles.tabRow}>
        {RANGES.map((r) => (
          <TouchableOpacity key={r.key} onPress={() => setRange(r.key)} style={styles.tab}>
            <Text
              style={[
                styles.tabText,
                { color: range === r.key ? colors.text : colors.textMuted },
              ]}
            >
              {r.label}
            </Text>
            {range === r.key && <View style={[styles.tabIndicator, { backgroundColor: colors.text }]} />}
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.maroon} style={styles.loader} />
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Summary banner */}
          <View style={styles.banner}>
            <Text style={[styles.bannerText, { color: colors.text }]}>
              Tracking 11 micronutrients
            </Text>
            <Text style={[styles.bannerSub, { color: colors.textMuted }]}>
              {range === 'today' ? "Today's intake" : `Daily average over ${RANGES.find((r) => r.key === range)?.label?.toLowerCase()}`}
            </Text>
          </View>

          {/* Sections */}
          {SECTIONS.map((section) => (
            <View key={section.title} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.textDim }]}>{section.title}</Text>
              {section.rows.map((row, i) => {
                const value = data?.[row.key] ?? 0;
                const fda = FDA_DAILY_VALUES[row.fdaKey];
                const hasTarget = fda.amount > 0;
                const isTransFat = row.key === 'transFat';
                const isNoTarget = row.key === 'sugars';

                const pct = hasTarget ? (value / fda.amount) * 100 : 0;
                const pctDisplay = hasTarget ? Math.round(pct) : null;
                const barWidth = hasTarget ? Math.min(pct, 100) : (value > 0 ? 20 : 0);
                const barColor = isNoTarget
                  ? `${colors.textDim}4D`
                  : getBarColor(pct, isTransFat, colors);

                return (
                  <View key={row.key}>
                    <View style={styles.nutrientRow}>
                      <View style={styles.nutrientLeft}>
                        <Text style={[styles.nutrientName, { color: colors.text }]}>{row.label}</Text>
                        <Text style={[styles.nutrientValue, { color: colors.textMuted }]}>
                          {value} / {isNoTarget ? 'No Target' : `${fda.amount.toLocaleString()} ${fda.unit}`}
                        </Text>
                      </View>
                      <Text style={[styles.nutrientPct, { color: colors.text }]}>
                        {pctDisplay != null ? `${pctDisplay}%` : '—'}
                      </Text>
                    </View>
                    <View style={[styles.progressTrack, { backgroundColor: colors.barTrack }]}>
                      <View
                        style={[
                          styles.progressFill,
                          { width: `${barWidth}%`, backgroundColor: barColor },
                        ]}
                      />
                    </View>
                    {i < section.rows.length - 1 && (
                      <View style={[styles.divider, { backgroundColor: colors.border }]} />
                    )}
                  </View>
                );
              })}
            </View>
          ))}

          {/* Footer */}
          <Text style={[styles.footer, { color: colors.textDim }]}>
            Daily targets based on FDA recommended daily values for a 2,000 calorie diet.
          </Text>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backBtn: {
    marginRight: 12,
  },
  title: {
    fontSize: 20,
    fontFamily: 'Outfit_700Bold',
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 20,
    marginBottom: 16,
  },
  tab: {
    paddingBottom: 8,
  },
  tabText: {
    fontSize: 14,
    fontFamily: 'DMSans_500Medium',
  },
  tabIndicator: {
    height: 2,
    borderRadius: 1,
    marginTop: 4,
  },
  loader: {
    marginTop: 60,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  banner: {
    backgroundColor: 'rgba(139,30,63,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(139,30,63,0.15)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  bannerText: {
    fontSize: 15,
    fontFamily: 'DMSans_600SemiBold',
  },
  bannerSub: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    marginTop: 4,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'DMSans_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 14,
  },
  nutrientRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  nutrientLeft: {
    flex: 1,
  },
  nutrientName: {
    fontSize: 15,
    fontFamily: 'DMSans_500Medium',
  },
  nutrientValue: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    marginTop: 2,
  },
  nutrientPct: {
    fontSize: 14,
    fontFamily: 'DMSans_600SemiBold',
    marginLeft: 12,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  footer: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 16,
  },
});
