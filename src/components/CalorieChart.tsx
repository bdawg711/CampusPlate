import React from 'react';
import { useWindowDimensions } from 'react-native';
import Svg, {
  Path,
  Line,
  Circle as SvgCircle,
  Defs,
  LinearGradient,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { Box, Text } from '../theme/restyleTheme';
import type { DayLog } from '../utils/progressData';

// ─── Direct color constants ─────────────────────────────────────────────────
const C = {
  maroon: '#861F41',
  silver: '#A8A9AD',
  textDim: '#9A9A9E',
  textMuted: '#6B6B6F',
  success: '#2D8A4E',
  error: '#C0392B',
};

interface Props {
  data: DayLog[];
  goalCalories: number;
  range?: '1W' | '1M' | '3M' | 'All';
}

const CHART_HEIGHT = 200;
const PADDING_TOP = 20;
const PADDING_BOTTOM = 24;
const PADDING_LEFT = 4;
const PADDING_RIGHT = 4;

function filterByRange(data: DayLog[], range: string): DayLog[] {
  if (range === 'All' || data.length === 0) return data;

  const daysMap: Record<string, number> = { '1W': 7, '1M': 30, '3M': 90 };
  const numDays = daysMap[range] ?? 30;

  const d = new Date();
  const cutoff = new Date(d.getFullYear(), d.getMonth(), d.getDate() - numDays);
  const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`;

  return data.filter((day) => day.date >= cutoffStr);
}

export default function CalorieChart({ data, goalCalories, range = '1M' }: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const chartWidth = screenWidth - 72; // account for card padding + screen padding

  const filtered = filterByRange(data, range);

  if (filtered.length === 0) {
    return (
      <Box
        alignItems="center"
        justifyContent="center"
        style={{ height: CHART_HEIGHT }}
      >
        <Text variant="muted">No data for this period yet</Text>
      </Box>
    );
  }

  const plotW = chartWidth - PADDING_LEFT - PADDING_RIGHT;
  const plotH = CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM;

  // Auto-scale Y
  const maxCal = Math.max(...filtered.map((d) => d.calories), goalCalories) * 1.15;
  const minCal = 0;

  const xScale = (i: number) => PADDING_LEFT + (filtered.length > 1 ? (i / (filtered.length - 1)) * plotW : plotW / 2);
  const yScale = (val: number) => PADDING_TOP + plotH - ((val - minCal) / (maxCal - minCal)) * plotH;

  // Build data path
  const points = filtered.map((d, i) => ({ x: xScale(i), y: yScale(d.calories) }));
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');

  // Fill area path (close to bottom)
  const fillPath = `${linePath} L${points[points.length - 1].x},${PADDING_TOP + plotH} L${points[0].x},${PADDING_TOP + plotH} Z`;

  // Goal line Y
  const goalY = yScale(goalCalories);

  // X-axis labels (every 7 days) — dim text
  const xLabels: { x: number; label: string }[] = [];
  for (let i = 0; i < filtered.length; i += 7) {
    const parts = filtered[i].date.split('-');
    xLabels.push({ x: xScale(i), label: `${parts[1]}/${parts[2]}` });
  }

  // Stats
  const avg = Math.round(filtered.reduce((s, d) => s + d.calories, 0) / filtered.length);

  // Trend: last 7 days vs prior 7 days
  const last7 = filtered.slice(-7);
  const prior7 = filtered.slice(-14, -7);
  const last7Avg = last7.length > 0 ? last7.reduce((s, d) => s + d.calories, 0) / last7.length : 0;
  const prior7Avg = prior7.length > 0 ? prior7.reduce((s, d) => s + d.calories, 0) / prior7.length : 0;

  let trendText = '→ Same';
  let trendColor = C.textMuted;
  if (prior7Avg > 0 && last7Avg !== prior7Avg) {
    const pctChange = Math.round(Math.abs((last7Avg - prior7Avg) / prior7Avg) * 100);
    if (last7Avg > prior7Avg) {
      trendText = `↑ ${pctChange}%`;
      trendColor = C.success;
    } else {
      trendText = `↓ ${pctChange}%`;
      trendColor = C.error;
    }
  }

  return (
    <Box>
      <Svg width={chartWidth} height={CHART_HEIGHT}>
        <Defs>
          <LinearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#861F41" stopOpacity={0.15} />
            <Stop offset="1" stopColor="#861F41" stopOpacity={0} />
          </LinearGradient>
        </Defs>

        {/* Fill area */}
        <Path d={fillPath} fill="url(#areaFill)" />

        {/* Maroon actual data line */}
        <Path d={linePath} stroke={C.maroon} strokeWidth={2} fill="none" />

        {/* Silver dashed goal line */}
        <Line
          x1={PADDING_LEFT}
          y1={goalY}
          x2={PADDING_LEFT + plotW}
          y2={goalY}
          stroke={C.silver}
          strokeWidth={1}
          strokeDasharray="6,4"
          opacity={0.6}
        />
        <SvgText
          x={PADDING_LEFT + plotW}
          y={goalY - 4}
          fill={C.textDim}
          fontSize={8}
          textAnchor="end"
        >
          Goal
        </SvgText>

        {/* Maroon data points */}
        {filtered.map((day, i) => (
          <SvgCircle
            key={day.date}
            cx={xScale(i)}
            cy={yScale(day.calories)}
            r={3}
            fill={day.mealsLogged > 0 ? C.maroon : 'transparent'}
            stroke={day.mealsLogged > 0 ? C.maroon : C.textDim}
            strokeWidth={day.mealsLogged > 0 ? 0 : 1}
          />
        ))}

        {/* Dim axis labels */}
        {xLabels.map((lbl) => (
          <SvgText
            key={lbl.label + lbl.x}
            x={lbl.x}
            y={CHART_HEIGHT - 4}
            fill={C.textDim}
            fontSize={10}
            textAnchor="middle"
          >
            {lbl.label}
          </SvgText>
        ))}
      </Svg>

      {/* Stats row: avg muted bottom-left, trend bottom-right */}
      <Box flexDirection="row" justifyContent="space-between" style={{ marginTop: 8 }}>
        <Text variant="muted">
          Avg: {avg.toLocaleString()} cal/day
        </Text>
        <Text
          style={{
            fontSize: 13,
            fontFamily: 'DMSans_600SemiBold',
            color: trendColor,
          }}
        >
          {trendText}
        </Text>
      </Box>
    </Box>
  );
}
