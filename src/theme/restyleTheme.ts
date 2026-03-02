import {
  createTheme,
  createBox,
  createText,
  createRestyleComponent,
  createVariant,
  VariantProps,
} from '@shopify/restyle';
import React from 'react';

// ── Hokie Prestige Palette ──────────────────────────────────────────────────

const palette = {
  // Primary
  white: '#FFFFFF',
  offWhite: '#FAFAFA',
  maroon: '#861F41',
  maroonDark: '#6B1835',
  maroonLight: '#A8325A',
  maroonMuted: 'rgba(134,31,65,0.08)',
  transparent: 'transparent',

  // Metallic Gold
  gold: '#C5A55A',
  goldDark: '#8B6914',
  goldMid: '#C5A55A',
  goldHighlight: '#E8D5A3',
  goldLight: '#D4BA7A',
  goldMuted: 'rgba(197,165,90,0.12)',

  // Metallic Silver
  silver: '#A8A9AD',
  silverDark: '#6B6B6F',
  silverMid: '#A8A9AD',
  silverHighlight: '#D8D8DC',
  silverLight: '#C8C9CC',
  silverMuted: 'rgba(168,169,173,0.10)',

  // Functional
  success: '#2D8A4E',
  warning: '#D4A024',
  error: '#C0392B',

  // Ring colors (flat)
  calorieRing: '#861F41',
  proteinRing: '#4A7FC5',

  // Overlay
  overlay: 'rgba(0,0,0,0.5)',
};

const theme = createTheme({
  colors: {
    ...palette,

    // Semantic tokens
    background: '#FFFFFF',
    backgroundAlt: '#FAFAFA',
    card: '#FFFFFF',
    cardAlt: '#FAFAFA',
    text: '#1A1A1A',
    textMuted: '#6B6B6F',
    textDim: '#9A9A9E',
    border: '#E8E8EA',
    borderLight: '#F0F0F2',
    inputBg: '#F5F5F7',
    inputBorder: '#E8E8EA',
    barTrack: 'rgba(0,0,0,0.06)',
    glowMaroon: 'rgba(134,31,65,0.12)',
    tabBarBg: '#FFFFFF',
    mutedTint: 'rgba(0,0,0,0.04)',

    // Icon tint backgrounds
    maroonTint: 'rgba(134,31,65,0.08)',
    goldTint: 'rgba(197,165,90,0.12)',
    silverTint: 'rgba(168,169,173,0.10)',
    successTint: 'rgba(45,138,78,0.10)',
    warningTint: 'rgba(212,160,36,0.10)',
    errorTint: 'rgba(192,57,43,0.10)',
    proteinTint: 'rgba(74,127,197,0.10)',
  },

  spacing: {
    xxs: 2,
    xs: 4,
    s: 8,
    m: 16,
    l: 24,
    xl: 32,
    xxl: 40,
  },

  borderRadii: {
    none: 0,
    xs: 4,
    s: 6,
    m: 8,
    l: 10,
    xl: 12,
    pill: 20,
    full: 9999,
  },

  textVariants: {
    defaults: {
      fontFamily: 'DMSans_400Regular',
      color: 'text',
    },
    pageTitle: {
      fontSize: 28,
      fontFamily: 'Outfit_700Bold',
      color: 'text',
    },
    sectionHeader: {
      fontSize: 11,
      fontFamily: 'DMSans_600SemiBold',
      textTransform: 'uppercase' as const,
      letterSpacing: 1.5,
      color: 'silver',
    },
    cardTitle: {
      fontSize: 16,
      fontFamily: 'DMSans_600SemiBold',
      color: 'text',
    },
    body: {
      fontSize: 15,
      fontFamily: 'DMSans_500Medium',
      color: 'text',
    },
    bodySmall: {
      fontSize: 14,
      fontFamily: 'DMSans_400Regular',
      color: 'text',
    },
    muted: {
      fontSize: 13,
      fontFamily: 'DMSans_400Regular',
      color: 'textMuted',
    },
    dim: {
      fontSize: 11,
      fontFamily: 'DMSans_400Regular',
      color: 'textDim',
    },
    statValue: {
      fontSize: 22,
      fontFamily: 'DMSans_700Bold',
      color: 'text',
    },
    statLabel: {
      fontSize: 11,
      fontFamily: 'DMSans_500Medium',
      textTransform: 'uppercase' as const,
      letterSpacing: 1,
      color: 'silver',
    },
    ringCenter: {
      fontSize: 36,
      fontFamily: 'Outfit_700Bold',
      color: 'text',
    },
    grade: {
      fontSize: 32,
      fontFamily: 'Outfit_700Bold',
      color: 'text',
    },
  },

  cardVariants: {
    defaults: {
      backgroundColor: 'card',
      borderColor: 'border',
      borderWidth: 1,
      borderRadius: 'm',
    },
    feature: {
      backgroundColor: 'card',
      borderColor: 'border',
      borderWidth: 1,
      borderRadius: 'l',
    },
  },
});

export type Theme = typeof theme;
export { theme };

// Primitives
export const Box = createBox<Theme>();
export const Text = createText<Theme>();

// Card with cardVariants support
export const Card = createRestyleComponent<
  VariantProps<Theme, 'cardVariants'> & React.ComponentProps<typeof Box>,
  Theme
>([createVariant({ themeKey: 'cardVariants' }) as any], Box);
