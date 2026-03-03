import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Box, Text } from '../theme/restyleTheme';
import { useTheme } from '@/src/context/ThemeContext';
import { requireUserId } from '../utils/auth';
import {
  getDailyMicronutrients,
  getPeriodMicronutrients,
  FDA_DAILY_VALUES,
  type MicronutrientData,
} from '../utils/micronutrients';

// ─── Accent color constants (theme-independent) ────────────────────────────
const ACCENT = {
  maroon: '#861F41',
  maroonMuted: 'rgba(134,31,65,0.08)',
  silverLight: '#C8C9CC',
  success: '#2D8A4E',
  warning: '#D4A024',
  error: '#C0392B',
};

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

function getBarColor(pct: number, isTransFat: boolean): string {
  if (isTransFat) return pct > 0 ? ACCENT.error : ACCENT.silverLight;
  if (pct >= 150) return ACCENT.error;
  if (pct >= 100) return ACCENT.success;
  if (pct >= 50) return ACCENT.warning;
  return ACCENT.maroon;
}

export default function MicronutrientScreen({ onClose }: Props) {
  const { colors } = useTheme();
  const C = {
    ...ACCENT,
    white: colors.card,
    offWhite: colors.cardAlt,
    text: colors.text,
    textMuted: colors.textMuted,
    textDim: colors.textDim,
    border: colors.border,
    borderLight: colors.borderLight,
  };
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
    <Box flex={1} backgroundColor="background" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <Box flexDirection="row" alignItems="center" paddingHorizontal="l" style={{ paddingVertical: 12 }}>
        {onClose && (
          <TouchableOpacity onPress={onClose} accessibilityLabel="Go back" accessibilityRole="button" style={{ marginRight: 12, width: 44, height: 44, justifyContent: 'center', alignItems: 'center' }}>
            <Feather name="arrow-left" size={20} color={C.text} />
          </TouchableOpacity>
        )}
        <Text variant="pageTitle" style={{ fontSize: 20 }}>Nutrition Details</Text>
      </Box>

      {/* Range tabs — rectangular style */}
      <Box flexDirection="row" paddingHorizontal="l" style={{ gap: 0, marginBottom: 16 }}>
        {RANGES.map((r) => {
          const isActive = range === r.key;
          return (
            <TouchableOpacity
              key={r.key}
              onPress={() => setRange(r.key)}
              style={{
                flex: 1,
                paddingVertical: 8,
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
                {r.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </Box>

      {loading ? (
        <ActivityIndicator size="large" color={C.maroon} style={{ marginTop: 60 }} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          {/* Summary banner */}
          <Box
            style={{
              backgroundColor: C.maroonMuted,
              borderWidth: 1,
              borderColor: 'rgba(134,31,65,0.15)',
              borderRadius: 8,
              padding: 16,
              marginBottom: 16,
            }}
          >
            <Text
              style={{
                fontSize: 15,
                fontFamily: 'DMSans_600SemiBold',
                color: C.text,
              }}
            >
              Tracking 11 micronutrients
            </Text>
            <Text variant="muted" style={{ marginTop: 4 }}>
              {range === 'today' ? "Today's intake" : `Daily average over ${RANGES.find((r) => r.key === range)?.label?.toLowerCase()}`}
            </Text>
          </Box>

          {/* Sections with silverLight track + maroon fill bars */}
          {SECTIONS.map((section) => (
            <Box
              key={section.title}
              backgroundColor="card"
              borderColor="border"
              borderWidth={1}
              borderRadius="m"
              padding="m"
              marginBottom="s"
            >
              <Text variant="sectionHeader" style={{ marginBottom: 14 }}>{section.title}</Text>
              {section.rows.map((row, i) => {
                const value = data?.[row.key] ?? 0;
                const fda = FDA_DAILY_VALUES[row.fdaKey];
                const hasTarget = fda.amount > 0;
                const isTransFat = row.key === 'transFat';
                const isNoTarget = row.key === 'sugars';

                const pct = hasTarget ? (value / fda.amount) * 100 : 0;
                const pctDisplay = hasTarget ? Math.round(pct) : null;
                const barWidth = hasTarget ? Math.min(pct, 100) : (value > 0 ? 20 : 0);
                const barColor = isNoTarget ? C.textDim : getBarColor(pct, isTransFat);

                return (
                  <Box key={row.key}>
                    <Box flexDirection="row" justifyContent="space-between" alignItems="flex-start" style={{ marginBottom: 6 }}>
                      <Box flex={1}>
                        <Text variant="body">{row.label}</Text>
                        <Text variant="muted" style={{ marginTop: 2 }}>
                          {value} / {isNoTarget ? 'No Target' : `${fda.amount.toLocaleString()} ${fda.unit}`}
                        </Text>
                      </Box>
                      <Text
                        style={{
                          fontSize: 14,
                          fontFamily: 'DMSans_600SemiBold',
                          color: C.text,
                          marginLeft: 12,
                        }}
                      >
                        {pctDisplay != null ? `${pctDisplay}%` : '—'}
                      </Text>
                    </Box>
                    {/* silverLight track, maroon fill */}
                    <Box
                      style={{
                        height: 4,
                        borderRadius: 2,
                        backgroundColor: C.silverLight,
                        overflow: 'hidden',
                        marginBottom: 4,
                      }}
                    >
                      <Box
                        style={{
                          height: 4,
                          borderRadius: 2,
                          width: `${barWidth}%` as any,
                          backgroundColor: barColor,
                        }}
                      />
                    </Box>
                    {i < section.rows.length - 1 && (
                      <Box
                        style={{
                          height: 1,
                          backgroundColor: C.borderLight,
                          marginVertical: 12,
                        }}
                      />
                    )}
                  </Box>
                );
              })}
            </Box>
          ))}

          {/* Footer */}
          <Text variant="dim" style={{ textAlign: 'center', marginTop: 8, paddingHorizontal: 16 }}>
            Daily targets based on FDA recommended daily values for a 2,000 calorie diet.
          </Text>
        </ScrollView>
      )}
    </Box>
  );
}
