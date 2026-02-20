import React, { useEffect } from 'react';
import { TouchableOpacity, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { Box, Text } from '@/src/theme/restyleTheme';
import type { MealItem } from '@/src/utils/ai';

interface AIChatBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  mealItems?: MealItem[] | null;
  onLogItem?: (item: MealItem) => void;
}

export default function AIChatBubble({ role, content, mealItems, onLogItem }: AIChatBubbleProps) {
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
          {content.replace(/\n{3,}/g, '\n\n').trim()}
        </Text>

        {mealItems && mealItems.length > 0 && (
          <Box marginTop="s" style={{ gap: 8 }}>
            {mealItems.map((item, idx) => (
              <TouchableOpacity
                key={item.id ?? idx}
                activeOpacity={0.7}
                onPress={() => onLogItem?.(item)}
              >
                <Box
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
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                    <Text variant="dim">
                      {item.protein_g}p · {item.carbs_g}c · {item.fat_g}f
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Feather name="plus-circle" size={14} color="#861F41" />
                      <Text variant="dim" style={{ color: '#861F41', fontFamily: 'DMSans_600SemiBold' }}>Log</Text>
                    </View>
                  </View>
                </Box>
              </TouchableOpacity>
            ))}
          </Box>
        )}
      </Box>
    </Animated.View>
  );
}
