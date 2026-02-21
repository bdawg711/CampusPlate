import React from 'react';
import { View, StyleSheet } from 'react-native';
import AnimatedCard from './AnimatedCard';
import AnimatedNumber from './AnimatedNumber';
import GradientText from './GradientText';
import { Box, Text } from '../theme/restyleTheme';
import { ScoreBreakdown } from '../utils/dailyScore';

// Milestones that get gold gradient text
const MILESTONES = [7, 14, 30, 60, 100];

// Score percentage color: maroon <50%, gold 50-79%, green 80%+
function getScoreColor(score: number): string {
  if (score >= 80) return '#2D8A4E';
  if (score >= 50) return '#C5A55A';
  return '#861F41';
}

interface DashboardStatsRowProps {
  streak: number;
  score: number;
  grade: string;
  breakdown?: ScoreBreakdown;
}

// ── Compute the most impactful tip ──────────────────────────────────────

function getScoreTip(breakdown?: ScoreBreakdown): string | null {
  if (!breakdown) return null;

  // Compute gap (max - points) for each category, sorted by largest gap
  const gaps: { key: string; gap: number; label: string }[] = [
    { key: 'meals', gap: breakdown.meals.max - breakdown.meals.points, label: getMealTip(breakdown.meals.count, breakdown.meals.max - breakdown.meals.points) },
    { key: 'water', gap: breakdown.water.max - breakdown.water.points, label: `Drink water for +${breakdown.water.max - breakdown.water.points} pts` },
    { key: 'protein', gap: breakdown.protein.max - breakdown.protein.points, label: `Hit protein for +${breakdown.protein.max - breakdown.protein.points} pts` },
    { key: 'calories', gap: breakdown.calories.max - breakdown.calories.points, label: `Hit cal goal for +${breakdown.calories.max - breakdown.calories.points} pts` },
  ];

  // Filter out zero-gap categories
  const actionable = gaps.filter((g) => g.gap > 0);
  if (actionable.length === 0) return null;

  // Sort by gap descending, pick the easiest big-gap action
  actionable.sort((a, b) => b.gap - a.gap);
  return actionable[0].label;
}

function getMealTip(count: number, gap: number): string {
  if (count === 0) return `Log a meal for +${gap} pts`;
  if (count === 1) return `Log lunch for +${gap} pts`;
  if (count === 2) return `Log dinner for +${gap} pts`;
  return `Log meals for +${gap} pts`;
}

// ── Component ───────────────────────────────────────────────────────────

export default function DashboardStatsRow({
  streak,
  score,
  grade,
  breakdown,
}: DashboardStatsRowProps) {
  const isMilestone = MILESTONES.includes(streak);
  const isNewUser = streak <= 1;
  const scoreTip = getScoreTip(breakdown);
  const scoreColor = getScoreColor(score);
  const isHighScore = score >= 80;

  return (
    <Box flexDirection="row" gap="s">
      {/* Streak Card */}
      <Box flex={1}>
        <AnimatedCard
          padding="m"
          borderRadius="m"
          backgroundColor="card"
          borderColor="border"
          borderWidth={1}
          overflow="hidden"
        >
          <Text variant="statLabel">CURRENT STREAK</Text>
          <Box marginTop="xs" marginBottom="xxs">
            {isNewUser ? (
              <Text variant="grade" style={{ color: '#1A1A1A' }}>
                Day 1
              </Text>
            ) : isMilestone ? (
              <GradientText
                text={String(streak)}
                gradientType="gold"
                fontSize={32}
                fontFamily="Outfit_700Bold"
              />
            ) : (
              <AnimatedNumber
                value={streak}
                textVariant="grade"
                duration={600}
              />
            )}
          </Box>
          {isNewUser ? (
            <Text variant="dim" style={{ fontSize: 11 }}>
              Log daily to build your streak
            </Text>
          ) : (
            <Text variant="muted">days</Text>
          )}
          {/* Thin maroon bottom-left accent */}
          <View style={styles.streakAccent} />
        </AnimatedCard>
      </Box>

      {/* Score Card */}
      <Box flex={1}>
        <AnimatedCard
          padding="m"
          borderRadius="m"
          backgroundColor="card"
          borderColor="border"
          borderWidth={1}
        >
          <Text variant="statLabel">DAILY GOAL</Text>
          <Box marginTop="xs" marginBottom="xxs">
            {isHighScore ? (
              <GradientText
                text={`${score}%`}
                gradientType="gold"
                fontSize={32}
                fontFamily="Outfit_700Bold"
              />
            ) : (
              <Text
                variant="grade"
                style={{ color: scoreColor }}
              >
                {score}%
              </Text>
            )}
          </Box>
          <Text variant="muted">daily goal</Text>
          {scoreTip && !isHighScore && (
            <Text variant="dim" style={{ fontSize: 11, marginTop: 4 }}>
              {scoreTip}
            </Text>
          )}
        </AnimatedCard>
      </Box>
    </Box>
  );
}

const styles = StyleSheet.create({
  streakAccent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: '30%',
    height: 2,
    backgroundColor: '#861F41',
  },
});
