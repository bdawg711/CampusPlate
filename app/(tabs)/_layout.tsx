import { Tabs } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';

function TabIcon({ label, active }: { label: string; active: boolean }) {
  return <Text style={{ fontSize: 20, opacity: active ? 1 : 0.5 }}>{label}</Text>;
}

export default function TabLayout() {
  const { mode, colors } = useTheme();

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
          tabBarIcon: () => (
            <View style={styles.plusBtn}>
              <Text style={styles.plusText}>+</Text>
            </View>
          ),
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
          tabBarIcon: ({ focused }) => <TabIcon label="•••" active={focused} />,
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
