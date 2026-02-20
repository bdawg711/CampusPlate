import React from 'react';

import { Box, Text } from '../theme/restyleTheme';
import AnimatedNumber from './AnimatedNumber';
import GradientText from './GradientText';

// ─── Direct color constants ─────────────────────────────────────────────────
const C = {
  text: '#1A1A1A',
  textMuted: '#6B6B6F',
};

const MILESTONES = [7, 14, 30, 60, 100];

interface Props {
  currentStreak: number;
  longestStreak: number;
}

export default function StreakDisplay({ currentStreak, longestStreak }: Props) {
  const isMilestone = MILESTONES.includes(currentStreak);

  if (currentStreak === 0) {
    return (
      <Box style={{ paddingVertical: 4 }}>
        <Text variant="muted">
          Log a meal to start your streak!
        </Text>
      </Box>
    );
  }

  return (
    <Box style={{ paddingVertical: 4 }}>
      <Box flexDirection="row" alignItems="baseline" style={{ gap: 8 }}>
        {isMilestone ? (
          <GradientText
            text={`${currentStreak}`}
            gradientType="gold"
            fontSize={32}
            fontFamily="Outfit_700Bold"
          />
        ) : (
          <AnimatedNumber
            value={currentStreak}
            textVariant="grade"
            color={C.text}
            decimals={0}
          />
        )}
        <Text variant="bodySmall" color="textMuted">
          day streak
        </Text>
      </Box>
      <Text variant="dim" style={{ marginTop: 2 }}>
        Best: {longestStreak} days
      </Text>
    </Box>
  );
}
