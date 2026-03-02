import React, { useEffect } from 'react';
import {
  View,
  Pressable,
  Dimensions,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { triggerHaptic } from '@/src/utils/haptics';
import { Text } from '@/src/theme/restyleTheme';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

const TAB_CONFIG: {
  name: string;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  size: number;
}[] = [
  { name: 'index', label: 'Home', icon: 'home', size: 22 },
  { name: 'browse', label: 'Menu', icon: 'search', size: 22 },
  { name: 'ai', label: 'Ask AI', icon: 'zap', size: 24 },
  { name: 'progress', label: 'Progress', icon: 'trending-up', size: 22 },
  { name: 'more', label: 'Settings', icon: 'sliders', size: 22 },
];

const MAROON = '#861F41';
const SILVER = '#A8A9AD';

function TabItem({
  config,
  isFocused,
  onPress,
  onLongPress,
}: {
  config: (typeof TAB_CONFIG)[number];
  isFocused: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const scale = useSharedValue(1);
  const labelOpacity = useSharedValue(isFocused ? 1 : 0.5);
  const glowOpacity = useSharedValue(0.15);
  const isAI = config.name === 'ai';

  // Animate label opacity on focus change
  useEffect(() => {
    labelOpacity.value = withTiming(isFocused ? 1 : 0.5, { duration: 200 });
  }, [isFocused]);

  // AI glow pulse when focused
  useEffect(() => {
    if (isAI && isFocused) {
      glowOpacity.value = withRepeat(
        withSequence(
          withTiming(0.25, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.15, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
        ),
        -1, // infinite
      );
    } else if (isAI) {
      glowOpacity.value = withTiming(0.15, { duration: 200 });
    }
  }, [isFocused, isAI]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const labelAnimStyle = useAnimatedStyle(() => ({
    opacity: labelOpacity.value,
  }));

  const glowAnimStyle = useAnimatedStyle(() => ({
    shadowOpacity: glowOpacity.value,
  }));

  const handlePressIn = () => {
    scale.value = withTiming(0.9, { duration: 75, easing: Easing.out(Easing.quad) });
  };

  const handlePressOut = () => {
    scale.value = withTiming(1, { duration: 75, easing: Easing.out(Easing.quad) });
  };

  const iconColor = isAI ? '#FFFFFF' : isFocused ? MAROON : SILVER;
  const labelColor = isFocused ? MAROON : SILVER;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : {}}
      accessibilityLabel={config.label}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
      }}
    >
      <Animated.View style={[{ alignItems: 'center', justifyContent: 'center' }, animatedStyle]}>
        {isAI ? (
          <Animated.View
            style={[
              {
                width: 48,
                height: 48,
                borderRadius: 9999,
                backgroundColor: MAROON,
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: -20,
                ...Platform.select({
                  ios: {
                    shadowColor: MAROON,
                    shadowOffset: { width: 0, height: 4 },
                    shadowRadius: 8,
                  },
                  android: {
                    elevation: 6,
                  },
                }),
              },
              glowAnimStyle,
            ]}
          >
            <Feather name={config.icon} size={config.size} color="#FFFFFF" />
          </Animated.View>
        ) : (
          <Feather name={config.icon} size={config.size} color={iconColor} />
        )}
        {!isAI && (
          <Animated.View style={labelAnimStyle}>
            <Text
              style={{
                fontSize: 11,
                fontFamily: 'DMSans_500Medium',
                marginTop: 2,
                color: labelColor,
              }}
              numberOfLines={1}
            >
              {config.label}
            </Text>
          </Animated.View>
        )}
      </Animated.View>
    </Pressable>
  );
}

export default function FloatingTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const screenWidth = Dimensions.get('window').width;

  return (
    <View
      style={{
        position: 'absolute',
        bottom: 24,
        alignSelf: 'center',
        width: screenWidth - 32,
        height: 64,
        borderRadius: 28,
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#E8E8EA',
        overflow: 'visible',
        ...Platform.select({
          ios: {
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.04,
            shadowRadius: 8,
          },
          android: {
            elevation: 4,
          },
        }),
      }}
    >
      {state.routes.map((route, index) => {
        const config = TAB_CONFIG.find((t) => t.name === route.name);
        if (!config) return null;

        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            triggerHaptic('medium');
            navigation.navigate(route.name);
          }
        };

        const onLongPress = () => {
          navigation.emit({
            type: 'tabLongPress',
            target: route.key,
          });
        };

        return (
          <TabItem
            key={route.key}
            config={config}
            isFocused={isFocused}
            onPress={onPress}
            onLongPress={onLongPress}
          />
        );
      })}
    </View>
  );
}
