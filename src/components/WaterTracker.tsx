import React, { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import { Box, Text, Card } from '../theme/restyleTheme';
import AnimatedNumber from './AnimatedNumber';
import { triggerHaptic } from '../utils/haptics';

interface WaterTrackerProps {
  waterOz: number;
  waterGoal: number;
  onAddWater: (oz: number) => void;
}

function PillButton({ label, onPress }: { label: string; onPress: () => void }) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withTiming(0.93, { duration: 80, easing: Easing.out(Easing.quad) });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 150 });
  };

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.pill}
      >
        <Text variant="bodySmall" color="textMuted">
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

export default function WaterTracker({
  waterOz,
  waterGoal,
  onAddWater,
}: WaterTrackerProps) {
  const fillWidth = useSharedValue(0);

  const pct = waterGoal > 0 ? Math.min(waterOz / waterGoal, 1) : 0;

  // Dynamic fill color: maroon <50%, gold 50-99%, green at 100%
  const fillColor =
    pct >= 1 ? '#2D8A4E' : pct >= 0.5 ? '#C5A55A' : '#861F41';

  useEffect(() => {
    fillWidth.value = withTiming(pct, {
      duration: 400,
      easing: Easing.out(Easing.cubic),
    });
  }, [pct]);

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
        {/* Label */}
        <Text variant="body" style={{ marginRight: 12 }}>
          Water
        </Text>

        {/* Silver progress bar */}
        <Box flex={1} style={styles.track}>
          <Animated.View style={[styles.fill, { backgroundColor: fillColor }, fillStyle]} />
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

        {/* Pill buttons */}
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
    backgroundColor: '#C8C9CC', // silverLight
    overflow: 'hidden',
  },
  fill: {
    height: 4,
    borderRadius: 4,
    backgroundColor: '#861F41', // maroon
  },
  pill: {
    borderWidth: 1,
    borderColor: '#A8A9AD', // flat silver
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
});
