import React, { createContext, useContext } from 'react';

// ── Single light theme colors matching the Hokie Prestige palette ──────────

const colors = {
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

  // Legacy tokens (mapped to new palette for un-migrated screens)
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

export type ThemeColors = typeof colors;

interface ThemeContextType {
  mode: 'light';
  colors: ThemeColors;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  mode: 'light',
  colors,
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <ThemeContext.Provider value={{ mode: 'light', colors, toggleTheme: () => {} }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
