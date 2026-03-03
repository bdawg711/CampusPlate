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
import { useTheme } from '@/src/context/ThemeContext';
import type { MealItem } from '@/src/utils/ai';

interface AIChatBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  mealItems?: MealItem[] | null;
  onLogItem?: (item: MealItem) => void;
}

// ── Markdown-lite parser ────────────────────────────────────────────────────
// Parses a line into Text elements, handling **bold** spans inline.
function renderInlineText(line: string, color: string, key: string) {
  const parts: React.ReactNode[] = [];
  const regex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let idx = 0;

  while ((match = regex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      parts.push(
        <Text key={`${key}-t${idx++}`} style={{ color, lineHeight: 21 }}>
          {line.slice(lastIndex, match.index)}
        </Text>
      );
    }
    parts.push(
      <Text key={`${key}-b${idx++}`} style={{ color, lineHeight: 21, fontFamily: 'DMSans_700Bold' }}>
        {match[1]}
      </Text>
    );
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < line.length) {
    parts.push(
      <Text key={`${key}-t${idx++}`} style={{ color, lineHeight: 21 }}>
        {line.slice(lastIndex)}
      </Text>
    );
  }
  if (parts.length === 0) {
    return <Text key={key} style={{ color, lineHeight: 21 }}>{line}</Text>;
  }
  return (
    <Text key={key} variant="body" style={{ color, lineHeight: 21 }}>
      {parts}
    </Text>
  );
}

// Renders the full content string with markdown-lite formatting
function FormattedContent({ content, color }: { content: string; color: string }) {
  const cleaned = content.replace(/\n{3,}/g, '\n\n').trim();
  const lines = cleaned.split('\n');
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Empty line → spacer
    if (trimmed === '') {
      elements.push(<View key={`sp-${i}`} style={{ height: 8 }} />);
      continue;
    }

    // ### Header
    if (trimmed.startsWith('### ') || trimmed.startsWith('## ') || trimmed.startsWith('# ')) {
      const headerText = trimmed.replace(/^#+\s*/, '').replace(/\*\*/g, '');
      elements.push(
        <Text
          key={`h-${i}`}
          style={{
            color,
            fontFamily: 'DMSans_700Bold',
            fontSize: 15,
            lineHeight: 22,
            marginTop: i > 0 ? 6 : 0,
            marginBottom: 2,
          }}
        >
          {headerText}
        </Text>
      );
      continue;
    }

    // Bullet: - item or * item or numbered list 1. item
    if (/^[-*]\s/.test(trimmed) || /^\d+\.\s/.test(trimmed)) {
      const bulletText = trimmed.replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, '');
      elements.push(
        <View key={`b-${i}`} style={{ flexDirection: 'row', paddingLeft: 4, marginTop: 3 }}>
          <Text style={{ color, lineHeight: 21, width: 14 }}>{'\u2022'}</Text>
          <View style={{ flex: 1 }}>
            {renderInlineText(bulletText, color, `bl-${i}`)}
          </View>
        </View>
      );
      continue;
    }

    // Regular paragraph line
    elements.push(
      <View key={`p-${i}`} style={{ marginTop: i > 0 && lines[i - 1]?.trim() !== '' ? 1 : 0 }}>
        {renderInlineText(trimmed, color, `ln-${i}`)}
      </View>
    );
  }

  return <>{elements}</>;
}

export default function AIChatBubble({ role, content, mealItems, onLogItem }: AIChatBubbleProps) {
  const { colors } = useTheme();
  const C = {
    maroon: '#861F41',
    text: colors.text,
    textMuted: colors.textMuted,
    textDim: colors.textDim,
    border: colors.border,
    borderLight: colors.borderLight,
    cardBg: colors.cardAlt,
    white: colors.card,
  };
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

  const hasMealItems = mealItems && mealItems.length > 0;

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
        maxWidth="85%"
        paddingHorizontal="m"
        paddingVertical="s"
        style={
          isUser
            ? {
                backgroundColor: C.maroon,
                borderRadius: 8,
                borderBottomRightRadius: 4,
                paddingVertical: 12,
              }
            : {
                backgroundColor: C.white,
                borderWidth: 1,
                borderColor: C.border,
                borderRadius: 8,
                borderBottomLeftRadius: 4,
                paddingVertical: 12,
              }
        }
      >
        {/* Formatted text content */}
        <FormattedContent
          content={content}
          color={isUser ? '#FFFFFF' : C.text}
        />

        {/* Meal item cards with visual separator */}
        {hasMealItems && (
          <Box style={{ marginTop: 12 }}>
            {/* Divider + label */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: 10,
                gap: 8,
              }}
            >
              <View style={{ flex: 1, height: 1, backgroundColor: C.borderLight }} />
              <Text
                style={{
                  fontSize: 11,
                  fontFamily: 'DMSans_600SemiBold',
                  color: C.textDim,
                  letterSpacing: 0.8,
                  textTransform: 'uppercase',
                }}
              >
                Tap to log
              </Text>
              <View style={{ flex: 1, height: 1, backgroundColor: C.borderLight }} />
            </View>

            <Box style={{ gap: 8 }}>
              {mealItems!.map((item, idx) => (
                <TouchableOpacity
                  key={item.id ?? idx}
                  activeOpacity={0.7}
                  onPress={() => onLogItem?.(item)}
                >
                  <Box
                    style={{
                      padding: 12,
                      borderRadius: 10,
                      backgroundColor: C.cardBg,
                      borderWidth: 1,
                      borderColor: C.borderLight,
                    }}
                  >
                    {/* Name + Log button */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Text
                        variant="body"
                        style={{ fontFamily: 'DMSans_700Bold', flex: 1, marginRight: 8 }}
                        numberOfLines={2}
                      >
                        {item.name}
                      </Text>
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          backgroundColor: C.maroon,
                          borderRadius: 6,
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          gap: 4,
                        }}
                      >
                        <Feather name="plus" size={12} color="#FFFFFF" />
                        <Text style={{ color: '#FFFFFF', fontSize: 12, fontFamily: 'DMSans_600SemiBold' }}>
                          Log
                        </Text>
                      </View>
                    </View>

                    {/* Hall + Calories */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                      <Text variant="muted" numberOfLines={1} style={{ fontSize: 12 }}>
                        {item.hall}
                      </Text>
                      <Text variant="muted" style={{ fontSize: 12 }}> · </Text>
                      <Text
                        style={{
                          color: C.maroon,
                          fontFamily: 'DMSans_700Bold',
                          fontSize: 13,
                        }}
                      >
                        {item.calories} cal
                      </Text>
                    </View>

                    {/* Macros */}
                    <Text variant="dim" style={{ marginTop: 2, fontSize: 11 }}>
                      {item.protein_g}g protein · {item.carbs_g}g carbs · {item.fat_g}g fat
                    </Text>
                  </Box>
                </TouchableOpacity>
              ))}
            </Box>
          </Box>
        )}
      </Box>
    </Animated.View>
  );
}
