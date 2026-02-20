import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';
import type { ScoreBreakdown } from '../utils/dailyScore';

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
  colorKey: 'maroon' | 'blue' | 'orange' | 'yellow' | 'green';
}[] = [
  { key: 'calories', label: 'Calories', colorKey: 'maroon' },
  { key: 'protein',  label: 'Protein',  colorKey: 'blue' },
  { key: 'carbs',    label: 'Carbs',    colorKey: 'orange' },
  { key: 'fat',      label: 'Fat',      colorKey: 'yellow' },
  { key: 'meals',    label: 'Meals',    colorKey: 'green' },
  { key: 'water',    label: 'Water',    colorKey: 'blue' },
];

const TIPS: Record<string, string> = {
  calories: "Tip: Aim closer to your calorie goal — that's worth 40 points!",
  protein:  "Tip: Hit your protein target — that's 20 easy points!",
  carbs:    "Tip: Match your carb goal for 10 more points!",
  fat:      "Tip: Stay near your fat target for 10 more points!",
  meals:    "Tip: Log at least 3 meals to max out this category!",
  water:    "Tip: Try to hit your water goal — that's 10 easy points!",
};

export default function DailyScoreCard({ score, grade, gradeColor, breakdown, compact = false }: Props) {
  const { colors } = useTheme();

  if (compact) {
    return <CompactView score={score} grade={grade} gradeColor={gradeColor} colors={colors} />;
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

  return (
    <View style={[styles.fullCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.fullHeader}>
        <Text style={[styles.fullGrade, { color: gradeColor }]}>{grade}</Text>
        <Text style={[styles.fullScore, { color: colors.textMuted }]}>{score} / 100</Text>
      </View>

      <View style={styles.barsContainer}>
        {CATEGORIES.map((cat) => {
          const entry = breakdown[cat.key];
          const fillPct = Math.min((entry.points / entry.max) * 100, 100);
          return (
            <View key={cat.key} style={styles.barRow}>
              <Text style={[styles.barLabel, { color: colors.textMuted }]}>{cat.label}</Text>
              <View style={[styles.barTrack, { backgroundColor: colors.barTrack }]}>
                <View
                  style={[
                    styles.barFill,
                    {
                      width: `${fillPct}%`,
                      backgroundColor: (colors as any)[cat.colorKey],
                    },
                  ]}
                />
              </View>
              <Text style={[styles.barScore, { color: colors.text }]}>
                {entry.points}/{entry.max}
              </Text>
            </View>
          );
        })}
      </View>

      <Text style={[styles.tip, { color: colors.textMuted }]}>
        {TIPS[lowestKey]}
      </Text>
    </View>
  );
}

function CompactView({ score, grade, gradeColor, colors }: { score: number; grade: string; gradeColor: string; colors: any }) {
  const scale = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(1, { damping: 12, stiffness: 120 });
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.compactCard, { backgroundColor: colors.cardGlass, borderColor: colors.cardGlassBorder }, animStyle]}>
      <Text style={[styles.compactHeader, { color: colors.textDim }]}>TODAY'S SCORE</Text>
      <Text style={[styles.compactGrade, { color: gradeColor }]}>{grade}</Text>
      <Text style={[styles.compactScore, { color: colors.textMuted }]}>{score} / 100</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // ── Compact ──
  compactCard: {
    borderRadius: 14,
    padding: 16,
    flex: 1,
    borderWidth: 1,
  },
  compactHeader: {
    fontSize: 11,
    fontFamily: 'DMSans_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  compactGrade: {
    fontSize: 32,
    fontFamily: 'Outfit_800ExtraBold',
    marginTop: 4,
  },
  compactScore: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    marginTop: 2,
  },
  // ── Full ──
  fullCard: {
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
  },
  fullHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
    marginBottom: 16,
  },
  fullGrade: {
    fontSize: 48,
    fontFamily: 'Outfit_800ExtraBold',
  },
  fullScore: {
    fontSize: 16,
    fontFamily: 'DMSans_400Regular',
  },
  barsContainer: {
    gap: 10,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  barLabel: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    width: 60,
  },
  barTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: 6,
    borderRadius: 3,
  },
  barScore: {
    fontSize: 13,
    fontFamily: 'DMSans_500Medium',
    width: 40,
    textAlign: 'right',
  },
  tip: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    fontStyle: 'italic',
    marginTop: 16,
  },
});
