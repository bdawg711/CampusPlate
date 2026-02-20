import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Box, Text } from '@/src/theme/restyleTheme';
import type { MealItem } from '@/src/utils/ai';

interface AIChatBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  mealItems?: MealItem[] | null;
  onLogItem?: (item: MealItem) => void;
}

export default function AIChatBubble({ role, content, mealItems }: AIChatBubbleProps) {
  const isUser = role === 'user';

  // Entrance animation: slide-in from bottom with fade
  const translateY = useSharedValue(20);
  const opacity = useSharedValue(0);

  useEffect(() => {
    translateY.value = withTiming(0, {
      duration: 150,
      easing: Easing.out(Easing.cubic),
    });
    opacity.value = withTiming(1, {
      duration: 150,
      easing: Easing.out(Easing.cubic),
    });
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          paddingHorizontal: 12,
          marginBottom: 10,
          alignItems: isUser ? ('flex-end' as const) : ('flex-start' as const),
        },
        animStyle,
      ]}
    >
      <Box
        maxWidth="75%"
        paddingHorizontal="m"
        paddingVertical="s"
        style={
          isUser
            ? {
                backgroundColor: '#861F41',
                borderRadius: 8,
                borderBottomRightRadius: 4,
                paddingVertical: 12,
              }
            : {
                backgroundColor: '#FFFFFF',
                borderWidth: 1,
                borderColor: '#E8E8EA',
                borderRadius: 8,
                borderBottomLeftRadius: 4,
                paddingVertical: 12,
              }
        }
      >
        <Text
          variant="body"
          style={{
            color: isUser ? '#FFFFFF' : '#1A1A1A',
            lineHeight: 21,
          }}
        >
          {content}
        </Text>

        {mealItems && mealItems.length > 0 && (
          <Box marginTop="s" style={{ gap: 8 }}>
            {mealItems.map((item, idx) => (
              <Box
                key={item.id ?? idx}
                padding="s"
                borderRadius="m"
                borderWidth={1}
                borderColor="border"
                backgroundColor="card"
              >
                <Text
                  variant="body"
                  style={{ fontFamily: 'DMSans_600SemiBold' }}
                  numberOfLines={2}
                >
                  {item.name}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text variant="muted" numberOfLines={1}>
                    {item.hall}
                  </Text>
                  <Text variant="muted"> · </Text>
                  <Text
                    variant="muted"
                    style={{ color: '#1A1A1A', fontFamily: 'DMSans_600SemiBold' }}
                  >
                    {item.calories} cal
                  </Text>
                </View>
                <Text variant="dim" style={{ marginTop: 4 }}>
                  {item.protein_g}p · {item.carbs_g}c · {item.fat_g}f
                </Text>
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Animated.View>
  );
}

// ── OLD CODE (commented out, do not delete) ──────────────────────────────────
/*
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';
import type { MealItem } from '@/src/utils/ai';

interface AIChatBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  mealItems?: MealItem[] | null;
  onLogItem?: (item: MealItem) => void;
}

export default function AIChatBubble({ role, content, mealItems }: AIChatBubbleProps) {
  const { colors } = useTheme();
  const isUser = role === 'user';

  return (
    <View style={[styles.row, isUser ? styles.rowUser : styles.rowAssistant]}>
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: isUser ? colors.maroon : colors.cardGlass,
          },
          isUser ? styles.bubbleUser : styles.bubbleAssistant,
        ]}
      >
        <Text
          style={[
            styles.content,
            { color: isUser ? '#FFFFFF' : colors.text },
          ]}
        >
          {content}
        </Text>

        {mealItems && mealItems.length > 0 && (
          <View style={styles.itemsContainer}>
            {mealItems.map((item, idx) => (
              <View
                key={item.id ?? idx}
                style={[styles.itemCard, { backgroundColor: colors.cardGlass, borderColor: colors.cardGlassBorder }]}
              >
                <Text style={[styles.itemName, { color: colors.text }]} numberOfLines={2}>
                  {item.name}
                </Text>
                <View style={styles.itemMeta}>
                  <Text style={[styles.itemHall, { color: colors.textMuted }]} numberOfLines={1}>
                    {item.hall}
                  </Text>
                  <Text style={[{ fontSize: 13, color: colors.textMuted, fontFamily: 'DMSans_400Regular' }]}> · </Text>
                  <Text style={[{ fontSize: 13, color: colors.text, fontFamily: 'DMSans_600SemiBold' }]}>
                    {item.calories} cal
                  </Text>
                </View>
                <Text style={[styles.microRow, { color: colors.textDim }]}>
                  {item.protein_g}p · {item.carbs_g}c · {item.fat_g}f
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  rowUser: {
    alignItems: 'flex-end',
  },
  rowAssistant: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '75%',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  bubbleUser: {
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    borderBottomLeftRadius: 4,
  },
  content: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    lineHeight: 21,
  },
  itemsContainer: {
    marginTop: 10,
    gap: 8,
  },
  itemCard: {
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
  },
  itemName: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 15,
    marginBottom: 2,
  },
  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemHall: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
  },
  microRow: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    marginTop: 4,
  },
});
*/
