import React, { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Easing,
  type SharedValue,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { Text } from '../theme/restyleTheme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface FloatingAddButtonProps {
  onScanPress: () => void;
  onDescribePress: () => void;
  onCustomMealPress: () => void;
}

const ACTIONS: {
  label: string;
  icon: keyof typeof Feather.glyphMap;
  key: 'scan' | 'describe' | 'custom';
}[] = [
  { label: 'Custom Meal', icon: 'plus-circle', key: 'custom' },
  { label: 'Describe Meal', icon: 'edit-3', key: 'describe' },
  { label: 'Scan Barcode', icon: 'camera', key: 'scan' },
];

export default function FloatingAddButton({
  onScanPress,
  onDescribePress,
  onCustomMealPress,
}: FloatingAddButtonProps) {
  const progress = useSharedValue(0);
  const isOpen = useSharedValue(false);

  const toggle = useCallback(() => {
    if (isOpen.value) {
      progress.value = withTiming(0, { duration: 200, easing: Easing.out(Easing.quad) });
      isOpen.value = false;
    } else {
      progress.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.quad) });
      isOpen.value = true;
    }
  }, []);

  const close = useCallback(() => {
    progress.value = withTiming(0, { duration: 200, easing: Easing.out(Easing.quad) });
    isOpen.value = false;
  }, []);

  const handleAction = useCallback((key: string) => {
    close();
    // Small delay so the close animation starts before modal opens
    setTimeout(() => {
      if (key === 'scan') onScanPress();
      else if (key === 'describe') onDescribePress();
      else if (key === 'custom') onCustomMealPress();
    }, 150);
  }, [onScanPress, onDescribePress, onCustomMealPress, close]);

  // Main button rotation
  const mainStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(progress.value, [0, 1], [0, 45])}deg` }],
  }));

  // Backdrop opacity
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: progress.value * 0.5,
    pointerEvents: progress.value > 0.01 ? 'auto' as const : 'none' as const,
  }));

  return (
    <>
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
      </Animated.View>

      {/* Action buttons */}
      <View style={styles.container} pointerEvents="box-none">
        {ACTIONS.map((action, index) => (
          <ActionButton
            key={action.key}
            label={action.label}
            icon={action.icon}
            index={index}
            progress={progress}
            onPress={() => handleAction(action.key)}
          />
        ))}

        {/* Main FAB */}
        <Pressable onPress={toggle} style={styles.fab}>
          <Animated.View style={mainStyle}>
            <Feather name="plus" size={28} color="#FFFFFF" />
          </Animated.View>
        </Pressable>
      </View>
    </>
  );
}

// ── Action button sub-component ──────────────────────────────────────────

function ActionButton({
  label,
  icon,
  index,
  progress,
  onPress,
}: {
  label: string;
  icon: keyof typeof Feather.glyphMap;
  index: number;
  progress: SharedValue<number>;
  onPress: () => void;
}) {
  // Each button fans out at a different offset above the main FAB
  const offset = (index + 1) * 60 + 16;

  const animStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.3, 1], [0, 0.5, 1]),
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [0, -offset]) },
      { scale: interpolate(progress.value, [0, 1], [0.8, 1]) },
    ],
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      style={[styles.actionRow, animStyle]}
    >
      <View style={styles.labelContainer}>
        <Text
          variant="bodySmall"
          style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: '#FFFFFF' }}
        >
          {label}
        </Text>
      </View>
      <View style={styles.actionButton}>
        <Feather name={icon} size={20} color="#FFFFFF" />
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
    zIndex: 90,
  },
  container: {
    position: 'absolute',
    bottom: 110,
    left: 0,
    right: 0,
    alignItems: 'flex-end',
    paddingRight: 20,
    zIndex: 100,
  },
  fab: {
    marginTop: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#861F41',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#861F41',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'absolute',
    bottom: 0,
    right: 20,
  },
  labelContainer: {
    marginRight: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#861F41',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6, // align with main FAB center
  },
});
