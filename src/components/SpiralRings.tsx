import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  withDelay,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
} from 'react-native-svg';
import AnimatedNumber from './AnimatedNumber';
import MetallicShimmer from './MetallicShimmer';
import { triggerHaptic } from '../utils/haptics';
import { Text } from '../theme/restyleTheme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ── Types ───────────────────────────────────────────────────────────────────

interface MacroData {
  current: number;
  goal: number;
}

interface SpiralRingsProps {
  calories: MacroData;
  protein: MacroData;
  carbs: MacroData;
  fat: MacroData;
  size?: number;
  animated?: boolean;
}

// ── Constants ───────────────────────────────────────────────────────────────

const STROKE_WIDTH = 10;
const RING_GAP = 8;
const MAX_FILL = 0.95; // Cap visual fill at 95% for 96-99% range

// Ring durations (outer → inner, each 50ms shorter)
const DURATIONS = [900, 850, 800, 750];
// Stagger delays (0 / 120 / 240 / 360 ms)
const DELAYS = [0, 120, 240, 360];
// Rotational offsets: -90 (12 o'clock) then -30 deg stagger per ring
const ROTATIONS = [-90, -120, -150, -180];

// Track circle opacities
const TRACK_COLORS = [
  'rgba(134,31,65,0.10)', // cal — maroon
  'rgba(74,127,197,0.10)', // pro — steel blue
  'rgba(197,165,90,0.10)', // carb — gold
  'rgba(168,169,173,0.10)', // fat — silver
];

// Normal stroke IDs / colors
const NORMAL_STROKES = [
  '#861F41', // cal — flat maroon
  '#4A7FC5', // pro — flat steel blue
  'url(#goldMetallic)', // carb — always gold gradient
  'url(#silverMetallic)', // fat — silver gradient
];

// Over-target stroke IDs — brighter versions of each ring's own color
const OVER_TARGET_STROKES = [
  'url(#maroonBright)', // cal — bright maroon
  'url(#blueBright)',   // pro — bright steel blue
  'url(#goldBright)',   // carb — bright gold
  'url(#silverBright)', // fat — bright silver
];

// ── Component ───────────────────────────────────────────────────────────────

export default function SpiralRings({
  calories,
  protein,
  carbs,
  fat,
  size = 280,
  animated = true,
}: SpiralRingsProps) {
  const isFirstLoad = useRef(true);
  const shimmerFired = useRef(false);
  const [shimmerPlay, setShimmerPlay] = useState(false);

  const center = size / 2;

  // Ring radii (outer → inner)
  const radii = React.useMemo(() => {
    const cal = (size - STROKE_WIDTH) / 2;
    const pro = cal - STROKE_WIDTH - RING_GAP;
    const carb = pro - STROKE_WIDTH - RING_GAP;
    const fatR = carb - STROKE_WIDTH - RING_GAP;
    return [cal, pro, carb, fatR];
  }, [size]);

  const circumferences = React.useMemo(
    () => radii.map((r) => 2 * Math.PI * r),
    [radii],
  );

  // Shared progress values (0 → MAX_FILL)
  const progress = [
    useSharedValue(0),
    useSharedValue(0),
    useSharedValue(0),
    useSharedValue(0),
  ];

  // Previous percentages for threshold detection
  const prevPcts = useRef([0, 0, 0, 0]);

  // Compute raw percentages
  const macros = [calories, protein, carbs, fat];
  const rawPcts = macros.map((m) => (m.goal > 0 ? m.current / m.goal : 0));
  // At 100%+: slightly overshoot to 1.01 so round linecaps overlap and close the gap.
  // At 96-99%: cap at 95% to keep spiral gap. Below 96%: proportional fill.
  const targets = rawPcts.map((p) => {
    if (p >= 1.0) return 1.01;          // goal hit — overshoot ensures fully closed ring
    if (p >= 0.96) return MAX_FILL;     // nearly there — cap to show gap
    return p;                            // proportional fill
  });
  const overTargets = rawPcts.map((p) => p > 1);

  // ── Animate on data change ──────────────────────────────────────────────

  useEffect(() => {
    if (!animated) {
      targets.forEach((t, i) => {
        progress[i].value = t;
      });
      return;
    }

    // Skip if no data yet
    if (targets.every((t) => t === 0)) return;

    if (isFirstLoad.current) {
      // Staggered fill-on-load
      targets.forEach((t, i) => {
        progress[i].value = withDelay(
          DELAYS[i],
          withTiming(t, {
            duration: DURATIONS[i],
            easing: Easing.out(Easing.cubic),
          }),
        );
      });
      isFirstLoad.current = false;
    } else {
      // Smooth spring update (no rewind — just animate to new value)
      targets.forEach((t, i) => {
        progress[i].value = withSpring(t, { damping: 14, stiffness: 90 });
      });
    }

    // Haptic on 25% threshold crossing
    const THRESHOLDS = [0.25, 0.5, 0.75, 1.0];
    const crossed = rawPcts.some((curr, i) =>
      THRESHOLDS.some((t) => prevPcts.current[i] < t && curr >= t),
    );
    if (crossed) triggerHaptic('success');

    prevPcts.current = [...rawPcts];

    // Over-target shimmer (fires once)
    if (overTargets.some(Boolean) && !shimmerFired.current) {
      shimmerFired.current = true;
      setShimmerPlay(true);
    }
  }, [targets[0], targets[1], targets[2], targets[3]]);

  // ── Animated props for each ring ────────────────────────────────────────

  const calAnimProps = useAnimatedProps(() => ({
    strokeDashoffset: circumferences[0] * (1 - progress[0].value),
  }));

  const proAnimProps = useAnimatedProps(() => ({
    strokeDashoffset: circumferences[1] * (1 - progress[1].value),
  }));

  const carbAnimProps = useAnimatedProps(() => ({
    strokeDashoffset: circumferences[2] * (1 - progress[2].value),
  }));

  const fatAnimProps = useAnimatedProps(() => ({
    strokeDashoffset: circumferences[3] * (1 - progress[3].value),
  }));

  const animatedPropsArr = [calAnimProps, proAnimProps, carbAnimProps, fatAnimProps];

  // Stroke: over-target → bright version of own color, else normal
  const strokes = overTargets.map((over, i) =>
    over ? OVER_TARGET_STROKES[i] : NORMAL_STROKES[i],
  );

  return (
    <View
      style={[styles.container, { width: size, height: size }]}
      accessibilityLabel={`Calories ${calories.current} of ${calories.goal}, Protein ${protein.current}g of ${protein.goal}g, Carbs ${carbs.current}g of ${carbs.goal}g, Fat ${fat.current}g of ${fat.goal}g`}
      accessibilityRole="image"
    >
      <Svg width={size} height={size}>
        <Defs>
          <SvgLinearGradient id="goldMetallic" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#8B6914" />
            <Stop offset="30%" stopColor="#C5A55A" />
            <Stop offset="50%" stopColor="#E8D5A3" />
            <Stop offset="70%" stopColor="#C5A55A" />
            <Stop offset="100%" stopColor="#8B6914" />
          </SvgLinearGradient>
          <SvgLinearGradient id="silverMetallic" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#6B6B6F" />
            <Stop offset="30%" stopColor="#A8A9AD" />
            <Stop offset="50%" stopColor="#D8D8DC" />
            <Stop offset="70%" stopColor="#A8A9AD" />
            <Stop offset="100%" stopColor="#6B6B6F" />
          </SvgLinearGradient>

          {/* Over-target bright gradients — each ring keeps its identity but glows */}
          <SvgLinearGradient id="maroonBright" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#A0274F" />
            <Stop offset="30%" stopColor="#C44475" />
            <Stop offset="50%" stopColor="#E8A0B8" />
            <Stop offset="70%" stopColor="#C44475" />
            <Stop offset="100%" stopColor="#A0274F" />
          </SvgLinearGradient>
          <SvgLinearGradient id="blueBright" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#5A8FD5" />
            <Stop offset="30%" stopColor="#7AAFEF" />
            <Stop offset="50%" stopColor="#B8D4F8" />
            <Stop offset="70%" stopColor="#7AAFEF" />
            <Stop offset="100%" stopColor="#5A8FD5" />
          </SvgLinearGradient>
          <SvgLinearGradient id="goldBright" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#A07D1A" />
            <Stop offset="30%" stopColor="#D4B86A" />
            <Stop offset="50%" stopColor="#F0E0B0" />
            <Stop offset="70%" stopColor="#D4B86A" />
            <Stop offset="100%" stopColor="#A07D1A" />
          </SvgLinearGradient>
          <SvgLinearGradient id="silverBright" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#8A8A8F" />
            <Stop offset="30%" stopColor="#C8C8CD" />
            <Stop offset="50%" stopColor="#ECECF0" />
            <Stop offset="70%" stopColor="#C8C8CD" />
            <Stop offset="100%" stopColor="#8A8A8F" />
          </SvgLinearGradient>
        </Defs>

        {/* 4 rings: track + animated fill */}
        {radii.map((r, i) => (
          <React.Fragment key={i}>
            {/* Track */}
            <Circle
              cx={center}
              cy={center}
              r={r}
              stroke={TRACK_COLORS[i]}
              strokeWidth={STROKE_WIDTH}
              fill="none"
            />
            {/* Fill arc */}
            <AnimatedCircle
              cx={center}
              cy={center}
              r={r}
              stroke={strokes[i]}
              strokeWidth={STROKE_WIDTH}
              fill="none"
              strokeDasharray={circumferences[i]}
              animatedProps={animatedPropsArr[i]}
              strokeLinecap="round"
              transform={`rotate(${ROTATIONS[i]} ${center} ${center})`}
            />
          </React.Fragment>
        ))}
      </Svg>

      {/* Center content */}
      <View style={styles.center}>
        <AnimatedNumber
          value={calories.current}
          textVariant="ringCenter"
          duration={900}
        />
        <Text variant="muted" style={{ marginTop: 2 }}>
          of {calories.goal.toLocaleString()} cal
        </Text>
      </View>

      {/* Over-target shimmer overlay */}
      {shimmerPlay && (
        <MetallicShimmer
          width={size}
          height={size}
          borderRadius={size / 2}
          play={shimmerPlay}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    position: 'absolute',
    alignItems: 'center',
  },
});
