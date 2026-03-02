import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Light theme ───────────────────────────────────────────────────────────────

const lightColors = {
  // Backgrounds
  background: '#FFFFFF',
  card: '#FFFFFF',
  cardAlt: '#FAFAFA',

  // Text
  text: '#1A1A1A',
  textMuted: '#6B6B6F',
  textDim: '#9A9A9E',

  // Borders
  border: '#E8E8EA',
  borderLight: '#F0F0F2',

  // Inputs
  inputBg: '#F5F5F7',
  inputBorder: '#E8E8EA',

  // Legacy tokens
  cardGlass: '#FFFFFF',
  cardGlassBorder: '#E8E8EA',
  barTrack: 'rgba(0,0,0,0.06)',
  glowMaroon: 'rgba(134,31,65,0.12)',
  tabBarBg: '#FFFFFF',
  mutedTint: 'rgba(0,0,0,0.04)',

  // Accent colors
  maroon: '#861F41',
  maroonLight: '#A8325A',
  maroonDark: '#6B1835',
  orange: '#E87722',
  green: '#2D8A4E',
  blue: '#4A7FC5',
  yellow: '#D4A024',
  red: '#C0392B',

  // Metallic
  gold: '#C5A55A',
  goldLight: '#D4BA7A',
  silver: '#A8A9AD',
  silverLight: '#C8C9CC',

  // Tint backgrounds
  maroonTint: 'rgba(134,31,65,0.08)',
  goldTint: 'rgba(197,165,90,0.12)',
  silverTint: 'rgba(168,169,173,0.10)',
  successTint: 'rgba(45,138,78,0.10)',
  warningTint: 'rgba(212,160,36,0.10)',
  errorTint: 'rgba(192,57,43,0.10)',
};

// ── Dark theme ────────────────────────────────────────────────────────────────

const darkColors: typeof lightColors = {
  // Backgrounds
  background: '#0E0E10',
  card: '#1C1C1E',
  cardAlt: '#2C2C2E',

  // Text
  text: '#F5F5F7',
  textMuted: '#A1A1A6',
  textDim: '#6E6E73',

  // Borders
  border: '#38383A',
  borderLight: '#2C2C2E',

  // Inputs
  inputBg: '#1C1C1E',
  inputBorder: '#38383A',

  // Legacy tokens
  cardGlass: '#1C1C1E',
  cardGlassBorder: '#38383A',
  barTrack: 'rgba(255,255,255,0.08)',
  glowMaroon: 'rgba(168,50,90,0.20)',
  tabBarBg: '#1C1C1E',
  mutedTint: 'rgba(255,255,255,0.04)',

  // Accent colors (same or slightly brightened for dark backgrounds)
  maroon: '#A8325A',
  maroonLight: '#C04872',
  maroonDark: '#861F41',
  orange: '#F09040',
  green: '#34C759',
  blue: '#5B9BD5',
  yellow: '#FFD60A',
  red: '#FF453A',

  // Metallic
  gold: '#D4BA7A',
  goldLight: '#E8D5A3',
  silver: '#B8B9BD',
  silverLight: '#D8D8DC',

  // Tint backgrounds
  maroonTint: 'rgba(168,50,90,0.15)',
  goldTint: 'rgba(212,186,122,0.15)',
  silverTint: 'rgba(184,185,189,0.12)',
  successTint: 'rgba(52,199,89,0.12)',
  warningTint: 'rgba(255,214,10,0.12)',
  errorTint: 'rgba(255,69,58,0.12)',
};

export type ThemeColors = typeof lightColors;
type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'campusplate_theme_mode';

interface ThemeContextType {
  mode: ThemeMode;
  colors: ThemeColors;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  mode: 'light',
  colors: lightColors,
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>('light');

  // Load persisted theme on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved === 'dark' || saved === 'light') setMode(saved);
    }).catch(() => {});
  }, []);

  const toggleTheme = useCallback(() => {
    setMode((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
      return next;
    });
  }, []);

  const colors = mode === 'dark' ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ mode, colors, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
