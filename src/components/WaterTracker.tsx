import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withTiming,
  withSpring,
  withSequence,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import Svg, { Rect, Path, ClipPath, Defs, G } from 'react-native-svg';
import { Feather } from '@expo/vector-icons';
import { Box, Text, Card } from '../theme/restyleTheme';
import AnimatedNumber from './AnimatedNumber';
import { triggerHaptic } from '../utils/haptics';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

interface WaterTrackerProps {
  waterOz: number;
  waterGoal: number;
  onAddWater: (oz: number) => void;
}

// ── Mini confetti burst (6 pieces, 0.5s) ────────────────────────────────

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
    translateY.value = withTiming(config.y, { duration: 500, easing: Easing.out(Easing.quad) });
    translateX.value = withTiming(config.x, { duration: 500, easing: Easing.out(Easing.quad) });
    opacity.value = withTiming(0, { duration: 500, easing: Easing.in(Easing.quad) }, (finished) => {
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

function PillButton({ label, onPress, muted }: { label: string; onPress: () => void; muted?: boolean }) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
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
        style={[styles.pill, muted && styles.pillMuted]}
      >
        <Text variant="bodySmall" style={muted ? { color: '#9A9A9E', fontSize: 12 } : undefined} color={muted ? undefined : 'textMuted'}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

// ── SVG Water Bottle (Smartwater silhouette) ─────────────────────────────

const BOTTLE_W = 40;
const BOTTLE_H = 94;
const WATER_COLOR = '#4A90D9';

// Tall slim Smartwater shape: small cap → narrow neck → smooth shoulder taper → elongated body → rounded bottom
const BOTTLE_PATH = [
  'M 17 0 H 23',            // cap top
  'Q 25 0, 25 2 V 5',       // cap right side (slightly wider)
  'Q 25 7, 23 7 H 22',      // cap-to-neck taper right
  'V 20',                    // long narrow neck right
  'C 22 26, 31 28, 31 32',  // smooth shoulder curve right
  'V 85',                    // tall body right
  'Q 31 93, 20 93',          // rounded bottom-right
  'Q 9 93, 9 85',            // rounded bottom-left
  'V 32',                    // tall body left
  'C 9 28, 18 26, 18 20',   // smooth shoulder curve left
  'V 7 H 17',               // long narrow neck left
  'Q 15 7, 15 5 V 2',       // cap-to-neck taper left
  'Q 15 0, 17 0 Z',         // cap left side
].join(' ');

function WaterBottle({ pct, goalHit }: { pct: number; goalHit: boolean }) {
  const fillHeight = useSharedValue(0);

  useEffect(() => {
    fillHeight.value = withTiming(Math.min(pct, 1), {
      duration: 600,
      easing: Easing.out(Easing.cubic),
    });
  }, [pct]);

  // Full bottle: cap top at y=0, body bottom at y=93
  const bottleBottom = 93;
  const fullH = 93;

  const animatedFillProps = useAnimatedProps(() => {
    const h = fillHeight.value * fullH;
    return {
      y: bottleBottom - h,
      height: h,
    };
  });

  return (
    <View style={{ width: 52, height: 100, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={BOTTLE_W} height={BOTTLE_H} viewBox={`0 0 ${BOTTLE_W} ${BOTTLE_H}`}>
        <Defs>
          <ClipPath id="bottleClip">
            <Path d={BOTTLE_PATH} />
          </ClipPath>
        </Defs>

        {/* Bottle fill (white base + animated water) */}
        <G clipPath="url(#bottleClip)">
          <Rect x={0} y={0} width={BOTTLE_W} height={BOTTLE_H} fill="#FFFFFF" />
          <AnimatedRect
            x={0}
            width={BOTTLE_W}
            fill={WATER_COLOR}
            opacity={0.75}
            animatedProps={animatedFillProps}
          />
        </G>

        {/* Bottle outline */}
        <Path d={BOTTLE_PATH} fill="none" stroke="#C8C9CC" strokeWidth={1.2} />
      </Svg>

      {/* Checkmark overlay at 100% */}
      {goalHit && (
        <View style={styles.checkOverlay}>
          <Feather name="check" size={22} color="#FFFFFF" />
        </View>
      )}
    </View>
  );
}

// ── Main component ───────────────────────────────────────────────────────

export default function WaterTracker({
  waterOz,
  waterGoal,
  onAddWater,
}: WaterTrackerProps) {
  const prevPct = useRef(0);
  const [miniConfetti, setMiniConfetti] = useState<MiniPieceConfig[] | null>(null);
  const doneCount = useRef(0);

  const pct = waterGoal > 0 ? waterOz / waterGoal : 0;
  const clampedPct = Math.min(pct, 1);

  // Dynamic label
  const labelText = pct >= 1 ? 'Goal hit!' : pct >= 0.8 ? 'Almost there!' : 'Water';
  const labelColor = pct >= 1 ? '#34C759' : pct >= 0.8 ? '#C5A55A' : undefined;

  useEffect(() => {
    // Detect crossing 100% threshold
    if (pct >= 1 && prevPct.current < 1) {
      triggerHaptic('success');
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

  const handleAdd = (oz: number) => {
    triggerHaptic('light');
    onAddWater(oz);
  };

  const handleRemove = (oz: number) => {
    triggerHaptic('light');
    onAddWater(-oz);
  };

  return (
    <Card padding="m" borderRadius="m">
      <Box flexDirection="row" alignItems="center">
        {/* SVG Water Bottle */}
        <View style={{ position: 'relative' }}>
          <WaterBottle pct={clampedPct} goalHit={pct >= 1} />
          {/* Mini confetti burst near the bottle */}
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
        </View>

        {/* Right side: label, oz text, buttons */}
        <Box flex={1} style={{ marginLeft: 12 }}>
          {/* Dynamic label */}
          <Text
            variant="body"
            style={{
              fontFamily: pct >= 0.8 ? 'DMSans_700Bold' : 'DMSans_400Regular',
              ...(labelColor ? { color: labelColor } : {}),
              marginBottom: 2,
            }}
          >
            {labelText}
          </Text>

          {/* Oz text below bottle */}
          <Box style={{ marginBottom: 8 }}>
            <AnimatedNumber
              value={waterOz}
              suffix={` / ${waterGoal} oz`}
              textVariant="bodySmall"
              color="#1A1A1A"
            />
          </Box>

          {/* Buttons row */}
          <Box flexDirection="row" style={{ gap: 4 }} alignItems="center">
            <PillButton label="−8 oz" onPress={() => handleRemove(8)} muted />
            <PillButton label="+8 oz" onPress={() => handleAdd(8)} />
            <PillButton label="+16 oz" onPress={() => handleAdd(16)} />
          </Box>
        </Box>
      </Box>
    </Card>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderWidth: 1,
    borderColor: '#A8A9AD',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pillMuted: {
    borderColor: '#D0D0D2',
    backgroundColor: 'transparent',
  },
  checkOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confettiAnchor: {
    position: 'absolute',
    left: 26,
    top: 45,
    width: 1,
    height: 1,
  },
});
