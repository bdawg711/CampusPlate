import { Tabs } from 'expo-router';
import React from 'react';
import FloatingTabBar from '@/src/components/FloatingTabBar';

export default function TabLayout() {

  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarStyle: { position: 'absolute', height: 0 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="browse" options={{ title: 'Browse' }} />
      <Tabs.Screen name="ai" options={{ title: 'AI' }} />
      <Tabs.Screen name="progress" options={{ title: 'Progress' }} />
      <Tabs.Screen name="more" options={{ title: 'Settings' }} />
      <Tabs.Screen name="history" options={{ href: null }} />
    </Tabs>
  );
}
