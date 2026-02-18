import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_KEY = 'campusplate_theme';

const darkColors = {
  background: '#0F0F1A',
  card: '#1A1A2E',
  cardAlt: '#16162A',
  text: '#F0EDE6',
  textMuted: '#7A7A90',
  textDim: '#4A4A60',
  border: 'rgba(255,255,255,0.05)',
  inputBg: '#1A1A2E',
  inputBorder: 'rgba(255,255,255,0.08)',
};

const lightColors = {
  background: '#FAF8F4',
  card: '#FFFFFF',
  cardAlt: '#F5F3EF',
  text: '#1A1A1A',
  textMuted: '#8A8A8A',
  textDim: '#BCBCBC',
  border: 'rgba(0,0,0,0.05)',
  inputBg: '#FFFFFF',
  inputBorder: 'rgba(0,0,0,0.1)',
};

export const accent = {
  maroon: '#8B1E3F',
  maroonLight: '#A8274D',
  orange: '#E87722',
  green: '#34C759',
  blue: '#5B7FFF',
  yellow: '#FFD60A',
  red: '#FF453A',
};

export type ThemeColors = typeof darkColors & typeof accent;

type ThemeMode = 'dark' | 'light';

interface ThemeContextType {
  mode: ThemeMode;
  colors: ThemeColors;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  mode: 'dark',
  colors: { ...darkColors, ...accent },
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>('dark');

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((val) => {
      if (val === 'light' || val === 'dark') setMode(val);
    });
  }, []);

  const toggleTheme = () => {
    const next = mode === 'dark' ? 'light' : 'dark';
    setMode(next);
    AsyncStorage.setItem(THEME_KEY, next);
  };

  const base = mode === 'dark' ? darkColors : lightColors;
  const colors: ThemeColors = { ...base, ...accent };

  return (
    <ThemeContext.Provider value={{ mode, colors, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
