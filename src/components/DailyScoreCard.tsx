import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

import { Box, Text } from '../theme/restyleTheme';
import { useTheme } from '@/src/context/ThemeContext';
import GradientText from './GradientText';
import MetallicShimmer from './MetallicShimmer';
import type { ScoreBreakdown } from '../utils/dailyScore';

// ─── Accent color constants (theme-independent) ────────────────────────────
const ACCENT = {
  maroon: '#861F41',
  gold: '#C5A55A',
  silverLight: '#C8C9CC',
  success: '#2D8A4E',
  warning: '#D4A024',
  maroonLight: '#A8325A',
  error: '#C0392B',
};

export interface ScoreDetailData {
  calories: { actual: number; goal: number };
  protein: { actual: number; goal: number };
  carbs: { actual: number; goal: number };
  fat: { actual: number; goal: number };
  mealsLogged: number;
  water: { actual: number; goal: number };
}

type Period = '1W' | '1M' | '3M' | 'All';

const PERIOD_TITLES: Record<Period, string> = {
  '1W': "THIS WEEK'S DAILY AVERAGE",
  '1M': "THIS MONTH'S DAILY AVERAGE",
  '3M': 'LAST 3 MONTHS AVERAGE',
  'All': 'ALL TIME DAILY AVERAGE',
};

interface Props {
  score: number;
  grade: string;
  gradeColor: string;
  breakdown: ScoreBreakdown;
  compact?: boolean;
  detailData?: ScoreDetailData;
  period?: Period;
}

const CATEGORIES: {
  key: keyof ScoreBreakdown;
  label: string;
  unit: string;
}[] = [
  { key: 'calories', label: 'Calories', unit: 'cal' },
  { key: 'protein',  label: 'Protein',  unit: 'g' },
  { key: 'carbs',    label: 'Carbs',    unit: 'g' },
  { key: 'fat',      label: 'Fat',      unit: 'g' },
  { key: 'meals',    label: 'Meals',    unit: '' },
  { key: 'water',    label: 'Water',    unit: 'oz' },
];

const TIPS: Record<string, string> = {
  calories: "Tip: Aim closer to your calorie goal — that's worth 40 points!",
  protein:  "Tip: Hit your protein target — that's 20 easy points!",
  carbs:    "Tip: Match your carb goal for 10 more points!",
  fat:      "Tip: Stay near your fat target for 10 more points!",
  meals:    "Tip: Log at least 3 meals to max out this category!",
  water:    "Tip: Try to hit your water goal — that's 10 easy points!",
};

// Score percentage color: maroon <50%, gold 50-79%, green 80%+
function getScoreColor(score: number): string {
  if (score >= 80) return ACCENT.success;
  if (score >= 50) return ACCENT.gold;
  return ACCENT.maroon;
}

function isHighScore(score: number): boolean {
  return score >= 80;
}

function formatNum(n: number): string {
  return n >= 1000 ? n.toLocaleString('en-US', { maximumFractionDigits: 0 }) : String(Math.round(n));
}

function getDetailText(key: string, detail: ScoreDetailData | undefined, unit: string): string | null {
  if (!detail) return null;
  if (key === 'calories') return `${formatNum(detail.calories.actual)} of ${formatNum(detail.calories.goal)} ${unit}`;
  if (key === 'protein') return `${formatNum(detail.protein.actual)} of ${formatNum(detail.protein.goal)}${unit}`;
  if (key === 'carbs') return `${formatNum(detail.carbs.actual)} of ${formatNum(detail.carbs.goal)}${unit}`;
  if (key === 'fat') return `${formatNum(detail.fat.actual)} of ${formatNum(detail.fat.goal)}${unit}`;
  if (key === 'meals') return detail.mealsLogged >= 3 ? `Goal met · ${detail.mealsLogged} logged` : `${detail.mealsLogged} of 3 logged`;
  if (key === 'water') return `${formatNum(detail.water.actual)} of ${formatNum(detail.water.goal)} ${unit}`;
  return null;
}

export default function DailyScoreCard({ score, grade, gradeColor, breakdown, compact = false, detailData, period = '1W' }: Props) {
  const { colors } = useTheme();
  const C = {
    ...ACCENT,
    text: colors.text,
    textMuted: colors.textMuted,
    textDim: colors.textDim,
    border: colors.border,
  };

  if (compact) {
    return <CompactView score={score} grade={grade} />;
  }

  // Find lowest scoring category for tip + gold highlight
  let lowestKey = 'calories';
  let lowestPct = 1;
  for (const cat of CATEGORIES) {
    const entry = breakdown[cat.key];
    const pct = entry.points / entry.max;
    if (pct < lowestPct) {
      lowestPct = pct;
      lowestKey = cat.key;
    }
  }

  const dynamicScoreColor = getScoreColor(score);
  const showGold = isHighScore(score);
  const [shimmerPlayed, setShimmerPlayed] = useState(false);

  useEffect(() => {
    if (showGold && !shimmerPlayed) {
      const timer = setTimeout(() => setShimmerPlayed(true), 600);
      return () => clearTimeout(timer);
    }
  }, [showGold, shimmerPlayed]);

  // Point color coding
  function getPtsColor(points: number, max: number): string {
    if (max === 0) return C.textDim;
    const ratio = points / max;
    if (ratio >= 0.8) return ACCENT.success;
    if (ratio >= 0.5) return ACCENT.warning;
    return ACCENT.error;
  }

  const AVG_COLS = detailData ? [
    { label: 'Avg Calories', value: formatNum(detailData.calories.actual), unit: 'cal', goal: formatNum(detailData.calories.goal) },
    { label: 'Avg Protein', value: formatNum(detailData.protein.actual), unit: 'g', goal: formatNum(detailData.protein.goal) },
    { label: 'Avg Carbs', value: formatNum(detailData.carbs.actual), unit: 'g', goal: formatNum(detailData.carbs.goal) },
    { label: 'Avg Fat', value: formatNum(detailData.fat.actual), unit: 'g', goal: formatNum(detailData.fat.goal) },
  ] : [];

  return (
    <Box
      backgroundColor="card"
      borderColor="border"
      borderWidth={1}
      borderRadius="l"
      padding="l"
      style={{ overflow: 'hidden' }}
    >
      {/* Block title */}
      <Text
        style={{
          fontSize: 12,
          fontFamily: 'DMSans_700Bold',
          letterSpacing: 1.5,
          color: C.textMuted,
          opacity: 0.3,
          textTransform: 'uppercase',
          marginBottom: 16,
        }}
      >
        {PERIOD_TITLES[period]}
      </Text>

      {/* Top row: 4-column weekly average grid */}
      {detailData && (
        <Box flexDirection="row" style={{ marginBottom: 16 }}>
          {AVG_COLS.map((item, i) => (
            <Box key={i} style={{ flex: 1, alignItems: 'center' }}>
              <Box flexDirection="row" alignItems="baseline">
                <Text style={{ fontSize: 18, fontFamily: 'Outfit_700Bold', color: C.text }}>
                  {item.value}
                </Text>
                <Text style={{ fontSize: 11, fontFamily: 'DMSans_500Medium', color: C.textMuted, marginLeft: 2 }}>
                  {item.unit}
                </Text>
              </Box>
              <Text style={{ fontSize: 10, fontFamily: 'DMSans_400Regular', color: C.textDim, marginTop: 2 }}>
                of {item.goal}
              </Text>
            </Box>
          ))}
        </Box>
      )}

      {/* Divider */}
      <Box style={{ height: 1, backgroundColor: C.border, marginBottom: 16 }} />

      {/* Large % score */}
      <Box alignItems="center" style={{ marginBottom: 16 }}>
        <View style={{ position: 'relative' }}>
          {showGold ? (
            <>
              <GradientText
                text={`${score}%`}
                gradientType="gold"
                fontSize={48}
                fontFamily="Outfit_700Bold"
              />
              <MetallicShimmer
                width={80}
                height={56}
                borderRadius={4}
                play={shimmerPlayed}
              />
            </>
          ) : (
            <Text
              style={{
                fontSize: 48,
                fontFamily: 'Outfit_700Bold',
                color: dynamicScoreColor,
              }}
            >
              {score}%
            </Text>
          )}
        </View>
        <Text variant="body" style={{ color: C.textMuted }}>
          of daily goal
        </Text>
      </Box>

      {/* Breakdown rows */}
      <Box style={{ gap: 10 }}>
        {CATEGORIES.map((cat) => {
          const entry = breakdown[cat.key];
          const detail = getDetailText(cat.key, detailData, cat.unit);
          const ptsColor = getPtsColor(entry.points, entry.max);

          return (
            <Box key={cat.key} flexDirection="row" alignItems="center">
              {/* Label */}
              <Text
                style={{
                  fontSize: 13,
                  fontFamily: 'DMSans_500Medium',
                  color: C.text,
                  width: 65,
                }}
              >
                {cat.label}
              </Text>
              {/* Actual of goal */}
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: 'DMSans_400Regular',
                  color: C.textMuted,
                  flex: 1,
                }}
                numberOfLines={1}
              >
                {detail ?? '\u2014'}
              </Text>
              {/* Pts earned — color coded */}
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: 'DMSans_600SemiBold',
                  color: ptsColor,
                }}
              >
                {entry.points}/{entry.max} pts
              </Text>
            </Box>
          );
        })}
      </Box>

      {/* Tip text */}
      <Text
        variant="dim"
        style={{ fontStyle: 'italic', marginTop: 16 }}
      >
        {TIPS[lowestKey]}
      </Text>
    </Box>
  );
}

function CompactView({ score, grade }: { score: number; grade: string }) {
  const scale = useSharedValue(0);
  const showGold = isHighScore(score);
  const dynamicScoreColor = getScoreColor(score);

  useEffect(() => {
    scale.value = withSpring(1, { damping: 12, stiffness: 120 });
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animStyle}>
      <Box
        backgroundColor="card"
        borderColor="border"
        borderWidth={1}
        borderRadius="m"
        padding="m"
        flex={1}
      >
        <Text variant="statLabel">DAILY GOAL</Text>
        {showGold ? (
          <Box style={{ marginTop: 4 }}>
            <GradientText
              text={`${score}%`}
              gradientType="gold"
              fontSize={32}
              fontFamily="Outfit_700Bold"
            />
          </Box>
        ) : (
          <Text
            style={{
              fontSize: 32,
              fontFamily: 'Outfit_700Bold',
              color: dynamicScoreColor,
              marginTop: 4,
            }}
          >
            {score}%
          </Text>
        )}
        <Text variant="muted" style={{ marginTop: 2 }}>daily goal</Text>
      </Box>
    </Animated.View>
  );
}
