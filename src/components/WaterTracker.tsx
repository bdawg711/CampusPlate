import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withSequence,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { Box, Text, Card } from '../theme/restyleTheme';
import AnimatedNumber from './AnimatedNumber';
import { triggerHaptic } from '../utils/haptics';

interface WaterTrackerProps {
  waterOz: number;
  waterGoal: number;
  onAddWater: (oz: number) => void;
}

// ── Mini confetti burst (5-6 pieces, 0.5s, near the tracker) ────────────

const MINI_CONFETTI_COLORS = ['#34C759', '#C5A55A', '#4A7FC5', '#861F41', '#FFD60A'];
const MINI_PIECE_COUNT = 6;

interface MiniPieceConfig {
  x: number;
  y: number;
  color: string;
  size: number;
}

function MiniConfettiPiece({ config, onDone }: { config: MiniPieceConfig; onDone?: () => void }) {
  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(1);
  const scale = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(1, { damping: 8, stiffness: 200 });
    translateY.value = withTiming(config.y, {
      duration: 500,
      easing: Easing.out(Easing.quad),
    });
    translateX.value = withTiming(config.x, {
      duration: 500,
      easing: Easing.out(Easing.quad),
    });
    opacity.value = withTiming(0, {
      duration: 500,
      easing: Easing.in(Easing.quad),
    }, (finished) => {
      if (finished && onDone) runOnJS(onDone)();
    });
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: config.size,
          height: config.size,
          borderRadius: config.size / 2,
          backgroundColor: config.color,
        },
        animStyle,
      ]}
    />
  );
}

// ── Pill button with scale bounce ────────────────────────────────────────

function PillButton({ label, onPress }: { label: string; onPress: () => void }) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    // Scale bounce: shrink then overshoot then settle
    scale.value = withSequence(
      withTiming(0.85, { duration: 60, easing: Easing.out(Easing.quad) }),
      withSpring(1, { damping: 6, stiffness: 300 }),
    );
    onPress();
  };

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={handlePress}
        style={styles.pill}
      >
        <Text variant="bodySmall" color="textMuted">
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

// ── Main component ───────────────────────────────────────────────────────

export default function WaterTracker({
  waterOz,
  waterGoal,
  onAddWater,
}: WaterTrackerProps) {
  const fillWidth = useSharedValue(0);
  const prevPct = useRef(0);
  const [miniConfetti, setMiniConfetti] = useState<MiniPieceConfig[] | null>(null);
  const doneCount = useRef(0);

  const pct = waterGoal > 0 ? Math.min(waterOz / waterGoal, 1) : 0;

  // Dynamic fill color: maroon <50%, gold 50-99%, green at 100%
  const fillColor =
    pct >= 1 ? '#2D8A4E' : pct >= 0.5 ? '#C5A55A' : '#861F41';

  // Dynamic label
  const labelText = pct >= 1 ? 'Goal hit!' : pct >= 0.8 ? 'Almost there!' : 'Water';
  const labelColor = pct >= 1 ? '#34C759' : pct >= 0.8 ? '#C5A55A' : undefined;

  useEffect(() => {
    fillWidth.value = withTiming(pct, {
      duration: 400,
      easing: Easing.out(Easing.cubic),
    });

    // Detect crossing 100% threshold
    if (pct >= 1 && prevPct.current < 1) {
      triggerHaptic('success');
      // Trigger mini confetti burst
      doneCount.current = 0;
      const pieces: MiniPieceConfig[] = Array.from({ length: MINI_PIECE_COUNT }, (_, i) => {
        const angle = (i / MINI_PIECE_COUNT) * Math.PI * 2;
        return {
          x: Math.cos(angle) * (25 + Math.random() * 15),
          y: Math.sin(angle) * (15 + Math.random() * 10) - 10,
          color: MINI_CONFETTI_COLORS[i % MINI_CONFETTI_COLORS.length],
          size: 4 + Math.random() * 3,
        };
      });
      setMiniConfetti(pieces);
    }
    prevPct.current = pct;
  }, [pct]);

  const handleConfettiPieceDone = useCallback(() => {
    doneCount.current += 1;
    if (doneCount.current >= MINI_PIECE_COUNT) {
      setMiniConfetti(null);
    }
  }, []);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${fillWidth.value * 100}%` as any,
  }));

  const handleAdd = (oz: number) => {
    triggerHaptic('light');
    onAddWater(oz);
  };

  return (
    <Card padding="m" borderRadius="m">
      <Box flexDirection="row" alignItems="center">
        {/* Dynamic label */}
        <Text
          variant="body"
          style={{
            marginRight: 12,
            fontFamily: pct >= 0.8 ? 'DMSans_700Bold' : 'DMSans_400Regular',
            ...(labelColor ? { color: labelColor } : {}),
          }}
        >
          {labelText}
        </Text>

        {/* Silver progress bar with confetti anchor */}
        <Box flex={1} style={styles.track}>
          <Animated.View style={[styles.fill, { backgroundColor: fillColor }, fillStyle]} />
          {/* Mini confetti burst near the bar end */}
          {miniConfetti && (
            <View style={styles.confettiAnchor} pointerEvents="none">
              {miniConfetti.map((piece, i) => (
                <MiniConfettiPiece
                  key={i}
                  config={piece}
                  onDone={i === 0 ? handleConfettiPieceDone : undefined}
                />
              ))}
            </View>
          )}
        </Box>

        {/* Animated count */}
        <Box style={{ marginHorizontal: 8 }}>
          <AnimatedNumber
            value={waterOz}
            suffix={` / ${waterGoal} oz`}
            textVariant="bodySmall"
            color="#1A1A1A"
          />
        </Box>

        {/* Pill buttons with bounce */}
        <PillButton label="+8 oz" onPress={() => handleAdd(8)} />
        <Box width={4} />
        <PillButton label="+16 oz" onPress={() => handleAdd(16)} />
      </Box>
    </Card>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 4,
    borderRadius: 4,
    backgroundColor: '#C8C9CC',
    overflow: 'visible',
    position: 'relative',
  },
  fill: {
    height: 4,
    borderRadius: 4,
    backgroundColor: '#861F41',
  },
  pill: {
    borderWidth: 1,
    borderColor: '#A8A9AD',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  confettiAnchor: {
    position: 'absolute',
    right: 0,
    top: -2,
    width: 1,
    height: 1,
  },
});
