import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/src/context/ThemeContext';

const WATER_BLUE = '#5B7FFF';
const GOAL_GREEN = '#34C759';
const TOTAL_ICONS = 8;

interface WaterTrackerProps {
  glasses: number;
  goal: number;
  onAddGlass: () => void;
  onRemoveGlass: () => void;
  loading: boolean;
}

export default function WaterTracker({
  glasses,
  goal,
  onAddGlass,
  onRemoveGlass,
  loading,
}: WaterTrackerProps) {
  const { colors } = useTheme();
  const [trackWidth, setTrackWidth] = useState(0);

  const goalReached = glasses >= goal;
  const barColor = goalReached ? GOAL_GREEN : WATER_BLUE;

  // — Glass scale shared values —
  // Declared individually (not in a loop) to satisfy rules of hooks.
  const s0 = useSharedValue(1);
  const s1 = useSharedValue(1);
  const s2 = useSharedValue(1);
  const s3 = useSharedValue(1);
  const s4 = useSharedValue(1);
  const s5 = useSharedValue(1);
  const s6 = useSharedValue(1);
  const s7 = useSharedValue(1);

  // Stable ref so effects can index by position without needing the array in deps.
  const svRef = useRef([s0, s1, s2, s3, s4, s5, s6, s7]);

  const as0 = useAnimatedStyle(() => ({ transform: [{ scale: s0.value }] }));
  const as1 = useAnimatedStyle(() => ({ transform: [{ scale: s1.value }] }));
  const as2 = useAnimatedStyle(() => ({ transform: [{ scale: s2.value }] }));
  const as3 = useAnimatedStyle(() => ({ transform: [{ scale: s3.value }] }));
  const as4 = useAnimatedStyle(() => ({ transform: [{ scale: s4.value }] }));
  const as5 = useAnimatedStyle(() => ({ transform: [{ scale: s5.value }] }));
  const as6 = useAnimatedStyle(() => ({ transform: [{ scale: s6.value }] }));
  const as7 = useAnimatedStyle(() => ({ transform: [{ scale: s7.value }] }));
  const animStyleList = [as0, as1, as2, as3, as4, as5, as6, as7];

  // — Button press scale animations —
  const addScale = useSharedValue(1);
  const removeScale = useSharedValue(1);
  const addAnimStyle = useAnimatedStyle(() => ({ transform: [{ scale: addScale.value }] }));
  const removeAnimStyle = useAnimatedStyle(() => ({ transform: [{ scale: removeScale.value }] }));

  // — Progress bar fill animation —
  const fillWidth = useSharedValue(0);
  const barAnimStyle = useAnimatedStyle(() => ({ width: fillWidth.value }));

  // Animate bar whenever glass count or measured track width changes.
  useEffect(() => {
    if (trackWidth > 0) {
      fillWidth.value = withTiming(Math.min(glasses / goal, 1) * trackWidth, { duration: 300 });
    }
  }, [glasses, goal, trackWidth]);

  // Bounce the icon that just became filled.
  const prevGlasses = useRef(glasses);
  useEffect(() => {
    const prev = prevGlasses.current;
    if (glasses > prev && glasses > 0 && glasses <= TOTAL_ICONS) {
      const sv = svRef.current[glasses - 1];
      if (sv) {
        sv.value = withSequence(
          withSpring(1.35, { damping: 6, stiffness: 300 }),
          withSpring(1, { damping: 12, stiffness: 200 }),
        );
      }
    }
    prevGlasses.current = glasses;
  }, [glasses]);

  // — Handlers —
  const handleAdd = () => {
    // Medium haptic when this tap will reach or exceed the goal; light otherwise.
    if (glasses + 1 >= goal) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onAddGlass();
  };

  const handleRemove = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onRemoveGlass();
  };

  return (
    <View style={[st.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Section header */}
      <View style={st.headerRow}>
        <View style={st.titleGroup}>
          <Text style={st.headerEmoji}>💧</Text>
          <Text style={[st.title, { color: colors.text, fontFamily: 'Outfit_700Bold' }]}>
            Water
          </Text>
        </View>
        <Text style={[st.count, { color: colors.textMuted, fontFamily: 'DMSans_600SemiBold' }]}>
          {glasses} / {goal} glasses
        </Text>
      </View>

      {/* Glass icons — each wrapped in its own Animated.View for the bounce */}
      <View style={st.iconsRow}>
        {Array.from({ length: TOTAL_ICONS }).map((_, i) => (
          <Animated.View key={i} style={animStyleList[i]}>
            <Text style={[st.glassIcon, { color: i < glasses ? WATER_BLUE : colors.textDim }]}>
              💧
            </Text>
          </Animated.View>
        ))}
      </View>

      {/* Progress bar — onLayout gives us the pixel width to animate against */}
      <View
        style={[st.trackOuter, { backgroundColor: colors.cardAlt }]}
        onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
      >
        <Animated.View style={[st.trackFill, { backgroundColor: barColor }, barAnimStyle]} />
      </View>

      {/* Buttons */}
      <View style={st.btnRow}>
        {/* Remove glass — Animated.View wrapper carries the press-scale */}
        <Animated.View style={removeAnimStyle}>
          <Pressable
            onPressIn={() => {
              removeScale.value = withSpring(0.93, { damping: 15, stiffness: 400 });
            }}
            onPressOut={() => {
              removeScale.value = withSpring(1, { damping: 15, stiffness: 400 });
            }}
            onPress={handleRemove}
            disabled={loading}
            style={[st.btnMinus, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}
          >
            <Text style={[st.btnMinusText, { color: colors.textMuted, fontFamily: 'Outfit_700Bold' }]}>
              −
            </Text>
          </Pressable>
        </Animated.View>

        {/* Add glass */}
        <Animated.View style={[st.btnAddWrap, addAnimStyle]}>
          <Pressable
            onPressIn={() => {
              addScale.value = withSpring(0.93, { damping: 15, stiffness: 400 });
            }}
            onPressOut={() => {
              addScale.value = withSpring(1, { damping: 15, stiffness: 400 });
            }}
            onPress={handleAdd}
            disabled={loading}
            style={[st.btnAdd, { backgroundColor: WATER_BLUE, opacity: loading ? 0.6 : 1 }]}
          >
            <Text style={[st.btnAddText, { fontFamily: 'Outfit_700Bold' }]}>+ Add glass</Text>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerEmoji: { fontSize: 18 },
  title: { fontSize: 17 },
  count: { fontSize: 13 },
  iconsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  glassIcon: { fontSize: 22 },
  trackOuter: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 16,
  },
  trackFill: {
    height: 6,
    borderRadius: 3,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  btnAddWrap: {
    flex: 1,
  },
  btnMinus: {
    width: 48,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnMinusText: {
    fontSize: 22,
    lineHeight: 26,
  },
  btnAdd: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnAddText: {
    color: '#fff',
    fontSize: 15,
  },
});
