import React from 'react';
import Svg, {
  Circle as SvgCircle,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
} from 'react-native-svg';
import { Box, Text } from '../theme/restyleTheme';

// ─── Direct color constants (ring colors per PRD) ───────────────────────────
const C = {
  proteinRing: '#4A7FC5',  // Steel blue
  text: '#1A1A1A',
  textMuted: '#6B6B6F',
  textDim: '#9A9A9E',
  silverLight: '#C8C9CC',
  // Gold/silver metallic flat fallbacks for dots
  goldFlat: '#C5A55A',
  silverFlat: '#A8A9AD',
};

interface Props {
  actual: { protein: number; carbs: number; fat: number };
  target: { protein: number; carbs: number; fat: number };
}

const RING_SIZE = 28;
const RING_STROKE = 3;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export default function MacroBreakdown({ actual, target }: Props) {
  // Calorie contributions for stacked bar
  const protCal = actual.protein * 4;
  const carbCal = actual.carbs * 4;
  const fatCal = actual.fat * 9;
  const totalCal = protCal + carbCal + fatCal || 1;

  const protPct = (protCal / totalCal) * 100;
  const carbPct = (carbCal / totalCal) * 100;
  const fatPct = (fatCal / totalCal) * 100;

  const macros = [
    { label: 'Protein', actual: actual.protein, target: target.protein, color: C.proteinRing, dotColor: C.proteinRing, pct: protPct, gradientId: null },
    { label: 'Carbs', actual: actual.carbs, target: target.carbs, color: C.goldFlat, dotColor: C.goldFlat, pct: carbPct, gradientId: 'macroGold' },
    { label: 'Fat', actual: actual.fat, target: target.fat, color: C.silverFlat, dotColor: C.silverFlat, pct: fatPct, gradientId: 'macroSilver' },
  ];

  return (
    <Box>
      {/* Stacked bar — ring colors: blue protein, gold carbs, silver fat */}
      <Box
        style={{
          height: 12,
          borderRadius: 6,
          flexDirection: 'row',
          overflow: 'hidden',
          backgroundColor: C.silverLight,
        }}
      >
        <Box style={{ width: `${protPct}%` as any, height: 12, backgroundColor: C.proteinRing }} />
        <Box style={{ width: `${carbPct}%` as any, height: 12, backgroundColor: C.goldFlat }} />
        <Box style={{ width: `${fatPct}%` as any, height: 12, backgroundColor: C.silverFlat }} />
      </Box>

      {/* Three columns with mini rings */}
      <Box flexDirection="row" style={{ marginTop: 16, gap: 8 }}>
        {macros.map((m) => {
          const fillPct = m.target > 0 ? Math.min(m.actual / m.target, 1) : 0;
          const dashOffset = RING_CIRCUMFERENCE * (1 - fillPct);

          return (
            <Box key={m.label} flex={1} alignItems="center">
              <Box flexDirection="row" alignItems="center" style={{ gap: 4, marginBottom: 4 }}>
                <Box
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: m.dotColor,
                  }}
                />
                <Text variant="muted">{m.label}</Text>
              </Box>
              <Text
                style={{
                  fontSize: 15,
                  fontFamily: 'DMSans_600SemiBold',
                  color: C.text,
                  marginBottom: 6,
                }}
              >
                {Math.round(m.actual)}g / {Math.round(m.target)}g
              </Text>
              <Svg width={RING_SIZE} height={RING_SIZE}>
                <Defs>
                  {/* Gold metallic gradient for carbs ring */}
                  <SvgLinearGradient id="macroGold" x1="0%" y1="0%" x2="100%" y2="100%">
                    <Stop offset="0%" stopColor="#8B6914" />
                    <Stop offset="30%" stopColor="#C5A55A" />
                    <Stop offset="50%" stopColor="#E8D5A3" />
                    <Stop offset="70%" stopColor="#C5A55A" />
                    <Stop offset="100%" stopColor="#8B6914" />
                  </SvgLinearGradient>
                  {/* Silver metallic gradient for fat ring */}
                  <SvgLinearGradient id="macroSilver" x1="0%" y1="0%" x2="100%" y2="100%">
                    <Stop offset="0%" stopColor="#6B6B6F" />
                    <Stop offset="30%" stopColor="#A8A9AD" />
                    <Stop offset="50%" stopColor="#D8D8DC" />
                    <Stop offset="70%" stopColor="#A8A9AD" />
                    <Stop offset="100%" stopColor="#6B6B6F" />
                  </SvgLinearGradient>
                </Defs>
                {/* Track */}
                <SvgCircle
                  cx={RING_SIZE / 2}
                  cy={RING_SIZE / 2}
                  r={RING_RADIUS}
                  stroke={C.silverLight}
                  strokeWidth={RING_STROKE}
                  fill="none"
                />
                {/* Fill */}
                <SvgCircle
                  cx={RING_SIZE / 2}
                  cy={RING_SIZE / 2}
                  r={RING_RADIUS}
                  stroke={m.gradientId ? `url(#${m.gradientId})` : m.color}
                  strokeWidth={RING_STROKE}
                  fill="none"
                  strokeDasharray={`${RING_CIRCUMFERENCE}`}
                  strokeDashoffset={dashOffset}
                  strokeLinecap="round"
                  rotation={-90}
                  origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
                />
              </Svg>
            </Box>
          );
        })}
      </Box>

      {/* Split label */}
      <Text variant="dim" style={{ textAlign: 'center', marginTop: 14 }}>
        Your split: {Math.round(protPct)}% P / {Math.round(carbPct)}% C / {Math.round(fatPct)}% F
      </Text>
    </Box>
  );
}
