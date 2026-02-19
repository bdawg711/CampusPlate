import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withSpring,
  withTiming,
  useDerivedValue,
  useAnimatedReaction,
  runOnJS,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/src/context/ThemeContext';

const WATER_BLUE = '#5B7FFF';
const GOAL_GREEN = '#34C759';

// Ring geometry — matches calorie ring pattern, scaled down
const RING_SIZE = 96;
const STROKE_WIDTH = 12;
const RADIUS = (RING_SIZE - STROKE_WIDTH) / 2; // 42
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;    // ~263.9

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface WaterTrackerProps {
  consumed: number;
  goal: number;
  onAddWater: (oz: number) => void;
  onRemoveWater: (oz: number) => void;
  loading: boolean;
}

const QUICK_ADD = [
  { label: '+8 oz', oz: 8 },
  { label: '+12 oz', oz: 12 },
  { label: '+16 oz', oz: 16 },
  { label: '+24 oz', oz: 24 },
];

export default function WaterTracker({ consumed, goal, onAddWater, onRemoveWater, loading }: WaterTrackerProps) {
  const { colors } = useTheme();

  const goalReached = consumed >= goal;
  const ringColor = goalReached ? GOAL_GREEN : WATER_BLUE;

  // — Ring fill animation —
  const dashOffset = useSharedValue(CIRCUMFERENCE);

  // — Counting number animation —
  const animatedConsumed = useSharedValue(consumed);
  const [displayConsumed, setDisplayConsumed] = useState(consumed);

  useEffect(() => {
    const progress = Math.min(consumed / goal, 1);
    dashOffset.value = withTiming(CIRCUMFERENCE * (1 - progress), { duration: 400 });
    animatedConsumed.value = withTiming(consumed, { duration: 300 });
  }, [consumed, goal]);

  // Bridge animated value to JS state for display
  useAnimatedReaction(
    () => Math.round(animatedConsumed.value),
    (current, prev) => {
      if (current !== prev) {
        runOnJS(setDisplayConsumed)(current);
      }
    },
    [animatedConsumed]
  );

  const animatedRingProps = useAnimatedProps(() => ({
    strokeDashoffset: dashOffset.value,
  }));

  // — Pill press scale animations (declared individually — never in a loop) —
  const scale0 = useSharedValue(1);
  const scale1 = useSharedValue(1);
  const scale2 = useSharedValue(1);
  const scale3 = useSharedValue(1);
  const scale4 = useSharedValue(1); // -8 oz button
  const scales = [scale0, scale1, scale2, scale3];

  const anim0 = useAnimatedStyle(() => ({ transform: [{ scale: scale0.value }] }));
  const anim1 = useAnimatedStyle(() => ({ transform: [{ scale: scale1.value }] }));
  const anim2 = useAnimatedStyle(() => ({ transform: [{ scale: scale2.value }] }));
  const anim3 = useAnimatedStyle(() => ({ transform: [{ scale: scale3.value }] }));
  const anim4 = useAnimatedStyle(() => ({ transform: [{ scale: scale4.value }] }));
  const animStyles = [anim0, anim1, anim2, anim3];

  const handlePress = (oz: number) => {
    if (consumed + oz >= goal) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onAddWater(oz);
  };

  const handleRemove = () => {
    if (consumed <= 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onRemoveWater(8);
  };

  const handleReset = () => {
    if (consumed <= 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onRemoveWater(consumed);
  };

  const renderPill = (item: (typeof QUICK_ADD)[number], index: number) => (
    <Animated.View key={item.oz} style={[st.pillWrap, animStyles[index]]}>
      <Pressable
        onPressIn={() => {
          scales[index].value = withSpring(0.93, { damping: 15, stiffness: 400 });
        }}
        onPressOut={() => {
          scales[index].value = withSpring(1, { damping: 15, stiffness: 400 });
        }}
        onPress={() => handlePress(item.oz)}
        disabled={loading}
        style={[st.pill, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}
      >
        <Text style={[st.pillText, { fontFamily: 'DMSans_600SemiBold' }]}>
          {item.label}
        </Text>
      </Pressable>
    </Animated.View>
  );

  return (
    <View style={[st.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Row 1 — Header */}
      <View style={st.headerRow}>
        <Text style={[st.title, { color: colors.text, fontFamily: 'Outfit_700Bold' }]}>
          Hydration
        </Text>
        <Text style={[st.counter, { color: colors.textMuted, fontFamily: 'DMSans_500Medium' }]}>
          {displayConsumed} / {goal} oz
        </Text>
      </View>

      {/* Row 2 — Ring + Quick Add */}
      <View style={st.bodyRow}>
        {/* Left — SVG water ring */}
        <View style={st.ringWrap}>
          <Svg width={RING_SIZE} height={RING_SIZE}>
            {/* Track circle */}
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RADIUS}
              stroke="rgba(91,127,255,0.12)"
              strokeWidth={STROKE_WIDTH}
              fill="none"
            />
            {/* Fill circle — animated dashOffset */}
            <AnimatedCircle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RADIUS}
              stroke={ringColor}
              strokeWidth={STROKE_WIDTH}
              fill="none"
              strokeDasharray={CIRCUMFERENCE}
              strokeLinecap="round"
              transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
              animatedProps={animatedRingProps}
            />
          </Svg>
          {/* Center text — absolutely positioned over the ring */}
          <View style={st.ringCenter}>
            <Text style={[st.ringNumber, { color: colors.text, fontFamily: 'Outfit_700Bold' }]}>
              {displayConsumed}
            </Text>
            <Text style={[st.ringUnit, { color: colors.textMuted, fontFamily: 'DMSans_400Regular' }]}>
              oz
            </Text>
          </View>
        </View>

        {/* Right — 2×2 quick-add pill grid + undo */}
        <View style={st.pillGrid}>
          <View style={st.pillRow}>
            {renderPill(QUICK_ADD[0], 0)}
            {renderPill(QUICK_ADD[1], 1)}
          </View>
          <View style={st.pillRow}>
            {renderPill(QUICK_ADD[2], 2)}
            {renderPill(QUICK_ADD[3], 3)}
          </View>
          {/* Remove row */}
          <View style={[st.pillRow, st.removeRow]}>
            <Animated.View style={[st.pillWrap, anim4]}>
              <Pressable
                onPressIn={() => {
                  if (consumed > 0) scale4.value = withSpring(0.93, { damping: 15, stiffness: 400 });
                }}
                onPressOut={() => {
                  scale4.value = withSpring(1, { damping: 15, stiffness: 400 });
                }}
                onPress={handleRemove}
                disabled={loading || consumed <= 0}
                style={[
                  st.pill,
                  { backgroundColor: colors.cardAlt, borderColor: colors.border },
                  (loading || consumed <= 0) && st.removeDisabled,
                ]}
              >
                <Text
                  style={[
                    st.pillText,
                    { color: colors.textMuted, fontFamily: 'DMSans_600SemiBold' },
                  ]}
                >
                  −8 oz
                </Text>
              </Pressable>
            </Animated.View>
            <Pressable
              onPress={handleReset}
              disabled={loading || consumed <= 0}
              style={st.resetBtn}
            >
              <Text
                style={[
                  st.resetText,
                  { color: colors.textMuted, fontFamily: 'DMSans_500Medium' },
                  (loading || consumed <= 0) && { opacity: 0.35 },
                ]}
              >
                Reset
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 17,
  },
  counter: {
    fontSize: 13,
  },
  bodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  ringWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringCenter: {
    position: 'absolute',
    alignItems: 'center',
  },
  ringNumber: {
    fontSize: 22,
    lineHeight: 26,
  },
  ringUnit: {
    fontSize: 11,
    marginTop: 1,
  },
  pillGrid: {
    flex: 1,
    gap: 8,
  },
  pillRow: {
    flexDirection: 'row',
    gap: 8,
  },
  pillWrap: {
    flex: 1,
  },
  pill: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
  },
  pillText: {
    fontSize: 13,
    color: WATER_BLUE,
  },
  removeRow: {
    marginTop: 2,
    alignItems: 'center',
  },
  removeDisabled: {
    opacity: 0.35,
  },
  resetBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  resetText: {
    fontSize: 12,
  },
});
