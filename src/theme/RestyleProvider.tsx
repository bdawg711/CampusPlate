import React from 'react';
import { ThemeProvider } from '@shopify/restyle';
import { theme } from './restyleTheme';

export function RestyleProvider({ children }: { children: React.ReactNode }) {
  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
}
