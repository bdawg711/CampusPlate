import React from 'react';
import { useWindowDimensions } from 'react-native';
import Svg, {
  Path,
  Circle as SvgCircle,
  Defs,
  LinearGradient,
  Stop,
} from 'react-native-svg';
import { Box, Text } from '../theme/restyleTheme';
import { useTheme } from '@/src/context/ThemeContext';
import type { WeightEntry, WeightTrend } from '../utils/weightData';

interface Props {
  entries: WeightEntry[];
  trend: WeightTrend;
}

const CHART_HEIGHT = 180;
const PAD_TOP = 16;
const PAD_BOTTOM = 8;
const PAD_H = 4;

function buildPath(points: { x: number; y: number }[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
}

export default function WeightChart({ entries, trend }: Props) {
  const { colors } = useTheme();
  const C = {
    maroon: '#861F41',
    silver: '#A8A9AD',
    silverLight: '#C8C9CC',
    text: colors.text,
    textMuted: colors.textMuted,
    textDim: colors.textDim,
    success: '#2D8A4E',
    error: '#C0392B',
    border: colors.border,
    offWhite: colors.cardAlt,
  };
  const { width: screenWidth } = useWindowDimensions();
  const chartWidth = screenWidth - 72;

  if (entries.length < 2) return null;

  const plotW = chartWidth - PAD_H * 2;
  const plotH = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;

  // Y scale with padding
  const allWeights = [...entries.map((e) => e.weight), ...trend.smoothed.map((s) => s.weight)];
  const minW = Math.min(...allWeights) - 1;
  const maxW = Math.max(...allWeights) + 1;

  const xScale = (i: number) => PAD_H + (i / (entries.length - 1)) * plotW;
  const yScale = (val: number) => PAD_TOP + plotH - ((val - minW) / (maxW - minW)) * plotH;

  // Maroon actual weight points
  const rawPts = entries.map((e, i) => ({ x: xScale(i), y: yScale(e.weight) }));
  const rawPath = buildPath(rawPts);

  // Silver 7-day average (trend) points
  const trendPts = trend.smoothed.map((s, i) => ({ x: xScale(i), y: yScale(s.weight) }));
  const trendPath = buildPath(trendPts);

  // Fill area under trend line
  const trendFill = `${trendPath} L${trendPts[trendPts.length - 1].x},${PAD_TOP + plotH} L${trendPts[0].x},${PAD_TOP + plotH} Z`;

  // Diff color
  const diffColor = trend.difference < 0 ? C.success : trend.difference > 0 ? C.error : C.textMuted;
  const diffSign = trend.difference > 0 ? '+' : '';

  // Date range label
  const firstDate = entries[0].date;
  const lastDate = entries[entries.length - 1].date;
  const fmtDate = (d: string) => { const p = d.split('-'); return `${p[1]}/${p[2]}`; };

  // Change pill helpers
  const pillColor = (val: number | null) => {
    if (val == null) return C.textMuted;
    return val < 0 ? C.success : val > 0 ? C.error : C.textMuted;
  };
  const pillText = (val: number | null) => {
    if (val == null) return '—';
    const sign = val > 0 ? '+' : '';
    return `${sign}${val}`;
  };

  return (
    <Box>
      {/* Stats header */}
      <Box flexDirection="row" justifyContent="space-between" alignItems="flex-start" style={{ marginBottom: 12 }}>
        <Box>
          <Text
            style={{
              fontSize: 24,
              fontFamily: 'Outfit_700Bold',
              color: C.text,
            }}
          >
            {trend.average} lbs
          </Text>
          <Text variant="dim" style={{ marginTop: 2 }}>
            {fmtDate(firstDate)} – {fmtDate(lastDate)}
          </Text>
        </Box>
        <Text
          style={{
            fontSize: 16,
            fontFamily: 'DMSans_600SemiBold',
            color: diffColor,
            marginTop: 4,
          }}
        >
          {diffSign}{trend.difference} lbs
        </Text>
      </Box>

      {/* SVG chart */}
      <Svg width={chartWidth} height={CHART_HEIGHT}>
        <Defs>
          <LinearGradient id="trendFillMaroon" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#861F41" stopOpacity={0.08} />
            <Stop offset="1" stopColor="#861F41" stopOpacity={0} />
          </LinearGradient>
        </Defs>

        {/* Trend fill area */}
        <Path d={trendFill} fill="url(#trendFillMaroon)" />

        {/* Maroon actual weight line */}
        <Path d={rawPath} stroke={C.maroon} strokeWidth={2} fill="none" />

        {/* Silver 7-day average line */}
        <Path d={trendPath} stroke={C.silver} strokeWidth={1.5} fill="none" strokeDasharray="4,3" />

        {/* Maroon data points */}
        {rawPts.map((p, i) => (
          <SvgCircle
            key={entries[i].date}
            cx={p.x}
            cy={p.y}
            r={3}
            fill={C.maroon}
          />
        ))}
      </Svg>

      {/* Change pills with directional color */}
      <Box flexDirection="row" style={{ gap: 10, marginTop: 12 }}>
        <Box
          style={{
            borderRadius: 20,
            paddingVertical: 8,
            paddingHorizontal: 16,
            backgroundColor: C.offWhite,
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontFamily: 'DMSans_500Medium',
              color: pillColor(trend.change3Day),
            }}
          >
            3-day: {pillText(trend.change3Day)} lbs
          </Text>
        </Box>
        <Box
          style={{
            borderRadius: 20,
            paddingVertical: 8,
            paddingHorizontal: 16,
            backgroundColor: C.offWhite,
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontFamily: 'DMSans_500Medium',
              color: pillColor(trend.change7Day),
            }}
          >
            7-day: {pillText(trend.change7Day)} lbs
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
