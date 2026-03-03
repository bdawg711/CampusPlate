import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { Box, Text } from '../theme/restyleTheme';
import { useTheme } from '@/src/context/ThemeContext';
import MetallicShimmer from './MetallicShimmer';
import type { Badge } from '../utils/streaks';

// Gold metallic gradient stops
const GOLD_GRADIENT: readonly [string, string, string, string, string] = [
  '#8B6914', '#C5A55A', '#E8D5A3', '#C5A55A', '#8B6914',
];
const GOLD_LOCATIONS: readonly [number, number, number, number, number] = [
  0, 0.3, 0.5, 0.7, 1.0,
];

interface Props {
  badge: Badge;
  size?: 'small' | 'large';
}

export default function StreakBadge({ badge, size = 'small' }: Props) {
  const { colors } = useTheme();
  const C = {
    silver: '#A8A9AD',
    silverLight: '#C8C9CC',
    textDim: colors.textDim,
    textMuted: colors.textMuted,
    text: colors.text,
    offWhite: colors.cardAlt,
  };
  const isLarge = size === 'large';
  const circleSize = isLarge ? 64 : 44;
  const emojiSize = isLarge ? 28 : 20;
  const [shimmerPlayed, setShimmerPlayed] = useState(false);

  // Play shimmer once when badge transitions to earned
  useEffect(() => {
    if (badge.earned && !shimmerPlayed) {
      const timer = setTimeout(() => setShimmerPlayed(true), 400);
      return () => clearTimeout(timer);
    }
  }, [badge.earned, shimmerPlayed]);

  return (
    <Box alignItems="center" accessibilityLabel={`${badge.name}${badge.earned ? ', earned' : ', locked'}`}>
      <View
        style={{
          width: circleSize,
          height: circleSize,
          borderRadius: circleSize / 2,
          overflow: 'hidden',
          opacity: badge.earned ? 1 : 0.4,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {badge.earned ? (
          // Unlocked: gold metallic gradient background + shimmer
          <>
            <LinearGradient
              colors={[...GOLD_GRADIENT]}
              locations={[...GOLD_LOCATIONS]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                position: 'absolute',
                width: circleSize,
                height: circleSize,
              }}
            />
            <Feather name={(badge.icon || 'award') as any} size={emojiSize} color="#FFFFFF" />
            <MetallicShimmer
              width={circleSize}
              height={circleSize}
              borderRadius={circleSize / 2}
              play={shimmerPlayed}
            />
          </>
        ) : (
          // Locked: silver fill + flat silver lock icon
          <>
            <View
              style={{
                position: 'absolute',
                width: circleSize,
                height: circleSize,
                backgroundColor: C.offWhite,
              }}
            />
            <Feather name="lock" size={emojiSize - 4} color={C.silver} />
          </>
        )}
      </View>

      <Text
        variant="dim"
        style={{
          textAlign: 'center',
          marginTop: 6,
          maxWidth: circleSize + 16,
          color: badge.earned ? (isLarge ? C.text : C.textMuted) : C.textDim,
        }}
        numberOfLines={2}
      >
        {badge.name}
      </Text>

      {isLarge && (
        <Text
          variant="dim"
          style={{
            textAlign: 'center',
            marginTop: 2,
            maxWidth: circleSize + 24,
            color: C.textMuted,
          }}
          numberOfLines={1}
        >
          {badge.description}
        </Text>
      )}
    </Box>
  );
}
