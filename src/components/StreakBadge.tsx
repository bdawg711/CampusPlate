import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import type { Badge } from '../utils/streaks';

interface Props {
  badge: Badge;
  size?: 'small' | 'large';
}

function getBadgeColor(type: Badge['type'], colors: any): string {
  if (type === 'streak') return colors.orange;
  if (type === 'water') return colors.blue;
  return colors.maroon;
}

export default function StreakBadge({ badge, size = 'small' }: Props) {
  const { colors } = useTheme();
  const isLarge = size === 'large';
  const circleSize = isLarge ? 64 : 44;
  const emojiSize = isLarge ? 28 : 20;

  const bgColor = badge.earned ? getBadgeColor(badge.type, colors) : colors.cardAlt;

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.circle,
          {
            width: circleSize,
            height: circleSize,
            borderRadius: circleSize / 2,
            backgroundColor: bgColor,
            opacity: badge.earned ? 1 : 0.4,
          },
        ]}
      >
        <Text style={{ fontSize: emojiSize, textAlign: 'center' }}>
          {badge.earned ? badge.emoji : '🔒'}
        </Text>
      </View>

      <Text
        style={[
          styles.name,
          {
            fontSize: isLarge ? 13 : 10,
            color: badge.earned ? (isLarge ? colors.text : colors.textMuted) : colors.textDim,
            maxWidth: circleSize + 16,
          },
        ]}
        numberOfLines={2}
      >
        {badge.name}
      </Text>

      {isLarge && (
        <Text
          style={[styles.description, { color: colors.textMuted, maxWidth: circleSize + 24 }]}
          numberOfLines={1}
        >
          {badge.description}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  circle: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  name: {
    fontFamily: 'DMSans_500Medium',
    textAlign: 'center',
    marginTop: 6,
  },
  description: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 2,
  },
});
