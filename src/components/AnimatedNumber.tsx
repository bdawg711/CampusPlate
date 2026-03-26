import React, { useCallback, useEffect, useState } from 'react';
import { Text } from 'react-native';
import {
  useSharedValue,
  useAnimatedReaction,
  withTiming,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { useTheme } from '@shopify/restyle';
import type { Theme } from '../theme/restyleTheme';

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

function formatNumber(num: number, decimalPlaces: number): string {
  if (decimalPlaces > 0) return num.toFixed(decimalPlaces);
  return Math.round(num).toLocaleString();
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

  const decimalPlaces =
    decimals !== undefined
      ? decimals
      : Number.isInteger(value)
        ? 0
        : 1;

  const [displayText, setDisplayText] = useState(
    `${prefix}${formatNumber(0, decimalPlaces)}${suffix}`,
  );

  const updateDisplay = useCallback(
    (num: number) => {
      setDisplayText(`${prefix}${formatNumber(num, decimalPlaces)}${suffix}`);
    },
    [prefix, suffix, decimalPlaces],
  );

  useEffect(() => {
    animatedValue.value = withTiming(value, {
      duration,
      easing: Easing.out(Easing.cubic),
    });
  }, [value, duration, animatedValue]);

  useAnimatedReaction(
    () => animatedValue.value,
    (current) => {
      runOnJS(updateDisplay)(current);
    },
    [updateDisplay],
  );

  const variant = theme.textVariants[textVariant] || theme.textVariants.body;
  const variantAny = variant as Record<string, any>;
  const resolvedColor = color || (variantAny.color ? (theme.colors as any)[variantAny.color as string] : theme.colors.text);

  return (
    <Text
      style={{
        fontSize: fontSizeOverride ?? variantAny.fontSize ?? 15,
        fontFamily: fontFamilyOverride ?? variantAny.fontFamily,
        color: resolvedColor,
        padding: 0,
        margin: 0,
      }}
    >
      {displayText}
    </Text>
  );
}
