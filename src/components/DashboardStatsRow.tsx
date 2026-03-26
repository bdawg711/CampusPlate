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
  nutritionScore: number;
}

// ── Component ───────────────────────────────────────────────────────────

export default function DashboardStatsRow({
  streak,
  nutritionScore,
}: DashboardStatsRowProps) {
  const isMilestone = MILESTONES.includes(streak);
  const isNewUser = streak <= 1;
  const scoreColor = getScoreColor(nutritionScore);
  const isHighScore = nutritionScore >= 80;

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
                text={`${nutritionScore}%`}
                gradientType="gold"
                fontSize={32}
                fontFamily="Outfit_700Bold"
              />
            ) : (
              <Text
                variant="grade"
                style={{ color: scoreColor }}
              >
                {nutritionScore}%
              </Text>
            )}
          </Box>
          <Text variant="muted">daily nutrition score</Text>
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
