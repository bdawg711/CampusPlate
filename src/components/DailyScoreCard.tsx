import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

import { Box, Text } from '../theme/restyleTheme';
import AnimatedNumber from './AnimatedNumber';
import GradientText from './GradientText';
import MetallicShimmer from './MetallicShimmer';
import type { ScoreBreakdown } from '../utils/dailyScore';

// ─── Direct color constants ─────────────────────────────────────────────────
const C = {
  white: '#FFFFFF',
  maroon: '#861F41',
  gold: '#C5A55A',
  silverLight: '#C8C9CC',
  text: '#1A1A1A',
  textMuted: '#6B6B6F',
  textDim: '#9A9A9E',
  border: '#E8E8EA',
  success: '#2D8A4E',
  warning: '#D4A024',
  maroonLight: '#A8325A',
  error: '#C0392B',
};

interface Props {
  score: number;
  grade: string;
  gradeColor: string;
  breakdown: ScoreBreakdown;
  compact?: boolean;
}

const CATEGORIES: {
  key: keyof ScoreBreakdown;
  label: string;
}[] = [
  { key: 'calories', label: 'Calories' },
  { key: 'protein',  label: 'Protein' },
  { key: 'carbs',    label: 'Carbs' },
  { key: 'fat',      label: 'Fat' },
  { key: 'meals',    label: 'Meals' },
  { key: 'water',    label: 'Water' },
];

const TIPS: Record<string, string> = {
  calories: "Tip: Aim closer to your calorie goal — that's worth 40 points!",
  protein:  "Tip: Hit your protein target — that's 20 easy points!",
  carbs:    "Tip: Match your carb goal for 10 more points!",
  fat:      "Tip: Stay near your fat target for 10 more points!",
  meals:    "Tip: Log at least 3 meals to max out this category!",
  water:    "Tip: Try to hit your water goal — that's 10 easy points!",
};

// Grade color mapping per PRD: A=gold gradient, B=success, C=warning, D=maroonLight, F=error
function getGradeColor(grade: string): string {
  if (grade === 'A+' || grade === 'A') return C.gold; // Flat fallback for non-gradient contexts
  if (grade === 'B') return C.success;
  if (grade === 'C') return C.warning;
  if (grade === 'D') return C.maroonLight;
  return C.error; // F
}

function isAGrade(grade: string): boolean {
  return grade === 'A+' || grade === 'A';
}

export default function DailyScoreCard({ score, grade, gradeColor, breakdown, compact = false }: Props) {
  if (compact) {
    return <CompactView score={score} grade={grade} />;
  }

  // Find lowest scoring category for tip
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

  const dynamicGradeColor = getGradeColor(grade);
  const showGoldGrade = isAGrade(grade);
  const [shimmerPlayed, setShimmerPlayed] = useState(false);

  useEffect(() => {
    if (showGoldGrade && !shimmerPlayed) {
      const timer = setTimeout(() => setShimmerPlayed(true), 600);
      return () => clearTimeout(timer);
    }
  }, [showGoldGrade, shimmerPlayed]);

  return (
    <Box
      backgroundColor="card"
      borderColor="border"
      borderWidth={1}
      borderRadius="l"
      padding="l"
      style={{ overflow: 'hidden' }}
    >
      {/* Header: Grade + Score */}
      <Box flexDirection="row" alignItems="baseline" style={{ gap: 10, marginBottom: 16 }}>
        <View style={{ position: 'relative' }}>
          {showGoldGrade ? (
            <>
              <GradientText
                text={grade}
                gradientType="gold"
                fontSize={48}
                fontFamily="Outfit_700Bold"
              />
              <MetallicShimmer
                width={60}
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
                color: dynamicGradeColor,
              }}
            >
              {grade}
            </Text>
          )}
        </View>
        <AnimatedNumber
          value={score}
          suffix=" / 100"
          textVariant="body"
          color={C.textMuted}
        />
      </Box>

      {/* Breakdown bars: silverLight track, maroon fill */}
      <Box style={{ gap: 10 }}>
        {CATEGORIES.map((cat) => {
          const entry = breakdown[cat.key];
          const fillPct = Math.min((entry.points / entry.max) * 100, 100);
          return (
            <Box key={cat.key} flexDirection="row" alignItems="center" style={{ gap: 8 }}>
              <Text
                variant="muted"
                style={{ width: 60 }}
              >
                {cat.label}
              </Text>
              <Box
                flex={1}
                style={{
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: C.silverLight,
                  overflow: 'hidden',
                }}
              >
                <Box
                  style={{
                    height: 6,
                    borderRadius: 3,
                    width: `${fillPct}%` as any,
                    backgroundColor: C.maroon,
                  }}
                />
              </Box>
              <Text
                variant="muted"
                style={{
                  width: 40,
                  textAlign: 'right',
                  fontFamily: 'DMSans_500Medium',
                  color: C.text,
                }}
              >
                {entry.points}/{entry.max}
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
  const showGoldGrade = isAGrade(grade);
  const dynamicGradeColor = getGradeColor(grade);

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
        <Text variant="statLabel">TODAY'S SCORE</Text>
        {showGoldGrade ? (
          <Box style={{ marginTop: 4 }}>
            <GradientText
              text={grade}
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
              color: dynamicGradeColor,
              marginTop: 4,
            }}
          >
            {grade}
          </Text>
        )}
        <Text variant="muted" style={{ marginTop: 2 }}>{score} / 100</Text>
      </Box>
    </Animated.View>
  );
}
