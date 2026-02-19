import { Tabs } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/src/context/ThemeContext';

function TabIcon({ label, active, color }: { label: string; active: boolean; color?: string }) {
  const scale = useRef(new Animated.Value(1)).current;
  const prevActive = useRef(active);

  useEffect(() => {
    // Bounce when becoming active
    if (active && !prevActive.current) {
      Haptics.selectionAsync();
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.2, duration: 120, easing: Easing.out(Easing.back(2)), useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 150, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]).start();
    }
    prevActive.current = active;
  }, [active, scale]);

  return (
    <Animated.Text style={{ fontSize: 20, opacity: active ? 1 : 0.5, transform: [{ scale }], ...(color ? { color } : {}) }}>
      {label}
    </Animated.Text>
  );
}

function PlusButton({ hasLoggedToday }: { hasLoggedToday: boolean }) {
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!hasLoggedToday) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      );
      animation.start();
      return () => animation.stop();
    } else {
      pulseAnim.setValue(0);
    }
  }, [hasLoggedToday, pulseAnim]);

  const glowScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.15],
  });

  const glowOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.35],
  });

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      {/* Pulse glow layer (behind) */}
      {!hasLoggedToday && (
        <Animated.View
          style={[
            styles.plusBtn,
            {
              position: 'absolute',
              opacity: glowOpacity,
              transform: [{ scale: glowScale }],
            },
          ]}
        />
      )}
      <View style={styles.plusBtn}>
        <Text style={styles.plusText}>+</Text>
      </View>
    </View>
  );
}

export default function TabLayout() {
  const { mode, colors } = useTheme();

  // For the pulse glow — we'd need to track meal logs, but to keep it simple
  // we pass false (assuming they haven't logged). In a real implementation,
  // this would come from context or state. For now, always show the pulse
  // to encourage logging.

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.orange,
        tabBarInactiveTintColor: colors.textDim,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 6,
          paddingTop: 4,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontFamily: 'DMSans_600SemiBold',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => <TabIcon label="🏠" active={focused} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ focused }) => <TabIcon label="📅" active={focused} />,
        }}
      />
      <Tabs.Screen
        name="browse"
        options={{
          title: '',
          tabBarIcon: () => <PlusButton hasLoggedToday={false} />,
          tabBarLabel: () => null,
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: 'Progress',
          tabBarIcon: ({ focused }) => <TabIcon label="📊" active={focused} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color, focused }) => <TabIcon label="•••" active={focused} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  plusBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#8B1E3F',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -16,
    shadowColor: 'rgba(139,30,63,0.3)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 6,
  },
  plusText: {
    color: '#fff',
    fontSize: 28,
    fontFamily: 'Outfit_700Bold',
    marginTop: -2,
  },
});
