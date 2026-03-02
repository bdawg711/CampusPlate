import React, { useEffect, useRef } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { triggerHaptic } from '@/src/utils/haptics';
import { Text } from '@/src/theme/restyleTheme';
import GradientText from './GradientText';

interface Props {
  visible: boolean;
  message: string;
  /** 'goal' = gold metallic bg + maroon text, 'streak' = maroon bg + gold gradient text, 'water' = steel blue bg + white text */
  variant?: 'goal' | 'streak' | 'water';
  /** Legacy color prop — if set and no variant, uses this as bg with white text */
  color?: string;
  onDismiss?: () => void;
}

export default function GoalHitBanner({ visible, message, variant, color, onDismiss }: Props) {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(-100);
  const opacity = useSharedValue(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismissing = useRef(false);

  // Determine variant from legacy color if not explicitly set
  const effectiveVariant = variant ?? (color === '#4A7FC5' ? 'water' : 'goal');

  const dismiss = () => {
    onDismiss?.();
  };

  const fadeOut = (duration: number) => {
    if (dismissing.current) return;
    dismissing.current = true;
    if (timer.current) clearTimeout(timer.current);
    opacity.value = withTiming(0, {
      duration,
      easing: Easing.in(Easing.quad),
    }, (finished) => {
      if (finished) runOnJS(dismiss)();
    });
  };

  useEffect(() => {
    if (visible) {
      dismissing.current = false;
      // Slide in from top with spring
      translateY.value = withSpring(0, { damping: 14, stiffness: 120 });
      opacity.value = withTiming(1, { duration: 150 });
      triggerHaptic('medium');

      // Auto-dismiss after 3 seconds with 500ms fade
      timer.current = setTimeout(() => fadeOut(500), 3000);
    } else {
      translateY.value = -100;
      opacity.value = 0;
      dismissing.current = false;
    }

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [visible]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!visible) return null;

  const containerStyle = {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    zIndex: 9998,
    marginHorizontal: 16,
    top: insets.top + 10,
    borderRadius: 8,
    overflow: 'hidden' as const,
  };

  // Tap banner to dismiss immediately (200ms fade)
  const handleTap = () => fadeOut(200);

  let content: React.ReactNode;

  if (effectiveVariant === 'goal') {
    // Gold metallic gradient bg + maroon text
    content = (
      <LinearGradient
        colors={['#8B6914', '#C5A55A', '#E8D5A3', '#C5A55A', '#8B6914']}
        locations={[0, 0.3, 0.5, 0.7, 1.0]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingVertical: 14, paddingHorizontal: 20 }}
      >
        <Text
          style={{
            color: '#861F41',
            fontSize: 15,
            fontFamily: 'DMSans_700Bold',
            textAlign: 'center',
          }}
        >
          {message}
        </Text>
      </LinearGradient>
    );
  } else if (effectiveVariant === 'streak') {
    // Maroon bg + gold GradientText
    content = (
      <View style={{ backgroundColor: '#861F41', paddingVertical: 14, paddingHorizontal: 20 }}>
        <View style={{ alignItems: 'center' }}>
          <GradientText
            text={message}
            gradientType="gold"
            fontSize={15}
            fontFamily="DMSans_700Bold"
          />
        </View>
      </View>
    );
  } else {
    // Water variant or fallback: solid bg + white text
    const bgColor = effectiveVariant === 'water' ? '#4A7FC5' : (color ?? '#861F41');
    content = (
      <View style={{ backgroundColor: bgColor, paddingVertical: 14, paddingHorizontal: 20 }}>
        <Text
          style={{
            color: '#FFFFFF',
            fontSize: 15,
            fontFamily: 'DMSans_600SemiBold',
            textAlign: 'center',
          }}
        >
          {message}
        </Text>
      </View>
    );
  }

  return (
    <Animated.View style={[containerStyle, animStyle]} pointerEvents="box-none">
      <Pressable onPress={handleTap} accessibilityRole="button" accessibilityLabel="Dismiss banner">
        {content}
      </Pressable>
    </Animated.View>
  );
}
