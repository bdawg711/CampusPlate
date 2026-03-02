import React from 'react';
import { ThemeProvider } from '@shopify/restyle';
import { theme, darkTheme } from './restyleTheme';
import { useTheme } from '@/src/context/ThemeContext';

export function RestyleProvider({ children }: { children: React.ReactNode }) {
  const { mode } = useTheme();
  const activeTheme = mode === 'dark' ? darkTheme : theme;
  return <ThemeProvider theme={activeTheme}>{children}</ThemeProvider>;
}
