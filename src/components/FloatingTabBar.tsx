import React from 'react';
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
  withSpring,
  Easing,
} from 'react-native-reanimated';
import { triggerHaptic } from '@/src/utils/haptics';
import { Box, Text } from '@/src/theme/restyleTheme';
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
  const isAI = config.name === 'ai';

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withTiming(0.85, { duration: 100, easing: Easing.out(Easing.quad) });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 150 });
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
          <View
            style={{
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
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                },
                android: {
                  elevation: 6,
                },
              }),
            }}
          >
            <Feather name={config.icon} size={config.size} color="#FFFFFF" />
          </View>
        ) : (
          <Feather name={config.icon} size={config.size} color={iconColor} />
        )}
        {!isAI && (
          <Text
            style={{
              fontSize: 10,
              fontFamily: 'DMSans_500Medium',
              marginTop: 2,
              color: labelColor,
            }}
            numberOfLines={1}
          >
            {config.label}
          </Text>
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
