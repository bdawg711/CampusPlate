import React from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/src/context/ThemeContext';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

const TAB_CONFIG: {
  name: string;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  size: number;
}[] = [
  { name: 'index', label: 'Home', icon: 'home', size: 22 },
  { name: 'browse', label: 'Browse', icon: 'search', size: 22 },
  { name: 'ai', label: 'AI', icon: 'zap', size: 26 },
  { name: 'progress', label: 'Progress', icon: 'trending-up', size: 22 },
  { name: 'more', label: 'Settings', icon: 'sliders', size: 22 },
];

export default function FloatingTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const { colors } = useTheme();
  const screenWidth = Dimensions.get('window').width;

  return (
    <View
      style={[
        styles.container,
        {
          width: screenWidth - 32,
          backgroundColor: colors.tabBarBg,
          borderColor: colors.cardGlassBorder,
          ...Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.15,
              shadowRadius: 16,
            },
            android: {
              elevation: 12,
            },
          }),
        },
      ]}
    >
      {state.routes.map((route, index) => {
        const config = TAB_CONFIG.find((t) => t.name === route.name);
        if (!config) return null;

        const isFocused = state.index === index;
        const isAI = config.name === 'ai';

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.navigate(route.name);
          }
        };

        const onLongPress = () => {
          navigation.emit({
            type: 'tabLongPress',
            target: route.key,
          });
        };

        const iconColor = isFocused ? colors.text : colors.textDim;

        return (
          <TouchableOpacity
            key={route.key}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={config.label}
            onPress={onPress}
            onLongPress={onLongPress}
            style={styles.tab}
            activeOpacity={0.7}
          >
            <View style={styles.iconContainer}>
              {isAI && (
                <View
                  style={[
                    styles.aiGlow,
                    { backgroundColor: colors.glowMaroon },
                  ]}
                />
              )}
              <Feather
                name={config.icon}
                size={config.size}
                color={iconColor}
                style={{ opacity: isFocused ? 1 : 0.35 }}
              />
            </View>
            {isFocused && (
              <Text
                style={[styles.label, { color: colors.text }]}
                numberOfLines={1}
              >
                {config.label}
              </Text>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    height: 64,
    borderRadius: 28,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    overflow: 'hidden',
  },
  tab: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  aiGlow: {
    position: 'absolute',
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  label: {
    fontSize: 10,
    fontFamily: 'DMSans_500Medium',
    marginTop: 2,
  },
});
