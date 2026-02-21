import React, { useEffect } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { TextInput } from 'react-native';
import { useTheme } from '@shopify/restyle';
import type { Theme } from '../theme/restyleTheme';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  textVariant?: keyof Theme['textVariants'];
  color?: string;
  decimals?: number;
  fontSize?: number;
  fontFamily?: string;
}

export default function AnimatedNumber({
  value,
  duration = 600,
  prefix = '',
  suffix = '',
  textVariant = 'body',
  color,
  decimals,
  fontSize: fontSizeOverride,
  fontFamily: fontFamilyOverride,
}: AnimatedNumberProps) {
  const theme = useTheme<Theme>();
  const animatedValue = useSharedValue(0);

  useEffect(() => {
    animatedValue.value = withTiming(value, {
      duration,
      easing: Easing.out(Easing.cubic),
    });
  }, [value, duration, animatedValue]);

  // Determine decimal places from the value if not specified
  const decimalPlaces =
    decimals !== undefined
      ? decimals
      : Number.isInteger(value)
        ? 0
        : 1;

  const variant = theme.textVariants[textVariant] || theme.textVariants.body;
  const variantAny = variant as Record<string, any>;
  const resolvedColor = color || (variantAny.color ? (theme.colors as any)[variantAny.color as string] : theme.colors.text);

  const animatedProps = useAnimatedProps(() => {
    const num = animatedValue.value;
    const formatted = decimalPlaces > 0
      ? num.toFixed(decimalPlaces)
      : Math.round(num).toLocaleString();
    return {
      text: `${prefix}${formatted}${suffix}`,
      defaultValue: `${prefix}${formatted}${suffix}`,
    } as any;
  });

  return (
    <AnimatedTextInput
      underlineColorAndroid="transparent"
      editable={false}
      animatedProps={animatedProps}
      style={{
        fontSize: fontSizeOverride ?? variantAny.fontSize ?? 15,
        fontFamily: fontFamilyOverride ?? variantAny.fontFamily,
        color: resolvedColor,
        padding: 0,
        margin: 0,
      }}
    />
  );
}
