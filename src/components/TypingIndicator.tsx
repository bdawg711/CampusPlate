import React, { useEffect } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';
import { Box } from '@/src/theme/restyleTheme';

// ── Three silver dots pulsing in sequence ────────────────────────────────────
// Each dot: 6px circle, opacity 0.3 -> 1.0 -> 0.3, 150ms stagger between dots
// Small white card bubble container with border

export default function TypingIndicator() {
  return (
    <Box
      style={{
        paddingHorizontal: 12,
        marginBottom: 10,
        alignItems: 'flex-start',
      }}
    >
      <Box
        flexDirection="row"
        backgroundColor="card"
        borderWidth={1}
        borderColor="border"
        borderRadius="m"
        style={{
          borderBottomLeftRadius: 4,
          paddingHorizontal: 16,
          paddingVertical: 12,
          gap: 6,
        }}
      >
        <PulsingDot delay={0} />
        <PulsingDot delay={150} />
        <PulsingDot delay={300} />
      </Box>
    </Box>
  );
}

function PulsingDot({ delay }: { delay: number }) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1.0, { duration: 400, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.3, { duration: 400, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      )
    );
    return () => cancelAnimation(opacity);
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: '#A8A9AD',
        },
        animStyle,
      ]}
    />
  );
}
