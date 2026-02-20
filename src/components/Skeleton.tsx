import React, { useEffect } from 'react';
import { View, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

// ─── Colors ─────────────────────────────────────────────────────────────────
const BG = '#E8E8EA';           // silverMuted background
const SHIMMER_LIGHT = 'rgba(255,255,255,0.6)';
const GRADIENT_WIDTH = 160;

interface SkeletonProps {
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export default function Skeleton({ width, height, borderRadius = 8, style }: SkeletonProps) {
  const translateX = useSharedValue(-GRADIENT_WIDTH);

  useEffect(() => {
    // Sweep from off-left to off-right, then repeat
    translateX.value = withDelay(
      Math.random() * 300, // slight random stagger so not all bones shimmer in lockstep
      withRepeat(
        withTiming(400, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
        -1,    // infinite
        false  // no reverse
      )
    );
    return () => cancelAnimation(translateX);
  }, [translateX]);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: BG,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 0,
            left: 0,
            width: GRADIENT_WIDTH,
            height: '100%',
          },
          shimmerStyle,
        ]}
      >
        <LinearGradient
          colors={['transparent', SHIMMER_LIGHT, 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ width: GRADIENT_WIDTH, height: '100%' as any }}
        />
      </Animated.View>
    </View>
  );
}
