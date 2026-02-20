import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle as SvgCircle } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';

interface Props {
  userName: string;
  date: string;
  calories: number;
  goalCalories: number;
  protein: number;
  carbs: number;
  fat: number;
  grade: string;
  gradeColor: string;
  streak: number;
  cardRef: React.RefObject<View>;
}

const RING_SIZE = 120;
const RING_STROKE = 10;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export default function ShareCard({
  userName,
  date,
  calories,
  goalCalories,
  protein,
  carbs,
  fat,
  grade,
  gradeColor,
  streak,
  cardRef,
}: Props) {
  const { colors } = useTheme();

  const calPct = goalCalories > 0 ? Math.min(calories / goalCalories, 1) : 0;
  const dashOffset = RING_CIRCUMFERENCE * (1 - calPct);

  // Format date for display
  const parts = date.split('-');
  const dateDisplay = parts.length === 3 ? `${parts[1]}/${parts[2]}/${parts[0]}` : date;

  return (
    <View
      ref={cardRef as any}
      style={[styles.card, { backgroundColor: colors.background }]}
      collapsable={false}
    >
      {/* Brand */}
      <Text style={[styles.brand, { color: colors.maroon }]}>CampusPlate</Text>

      {/* Grade */}
      <Text style={[styles.grade, { color: gradeColor }]}>{grade}</Text>

      {/* Score ring */}
      <View style={styles.ringContainer}>
        <Svg width={RING_SIZE} height={RING_SIZE}>
          <SvgCircle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            stroke={colors.barTrack}
            strokeWidth={RING_STROKE}
            fill="none"
          />
          <SvgCircle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            stroke={gradeColor}
            strokeWidth={RING_STROKE}
            fill="none"
            strokeDasharray={`${RING_CIRCUMFERENCE}`}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            rotation={-90}
            origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
          />
        </Svg>
        <Text style={[styles.ringText, { color: colors.text }]}>
          {calories.toLocaleString()}
        </Text>
      </View>

      {/* Calorie text */}
      <Text style={[styles.calText, { color: colors.text }]}>
        {calories.toLocaleString()} / {goalCalories.toLocaleString()} cal
      </Text>

      {/* Macro row */}
      <View style={styles.macroRow}>
        <Text style={[styles.macroItem, { color: colors.blue }]}>{protein}g P</Text>
        <Text style={[styles.macroDivider, { color: colors.textDim }]}>|</Text>
        <Text style={[styles.macroItem, { color: colors.orange }]}>{carbs}g C</Text>
        <Text style={[styles.macroDivider, { color: colors.textDim }]}>|</Text>
        <Text style={[styles.macroItem, { color: colors.yellow }]}>{fat}g F</Text>
      </View>

      {/* Streak */}
      {streak > 0 && (
        <Text style={[styles.streak, { color: colors.text }]}>🔥 {streak} day streak</Text>
      )}

      {/* User + date */}
      <Text style={[styles.userName, { color: colors.text }]}>{userName}</Text>
      <Text style={[styles.date, { color: colors.textMuted }]}>{dateDisplay}</Text>

      {/* Footer */}
      <Text style={[styles.footer, { color: colors.textDim }]}>Track your nutrition at VT</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: -9999,
    width: 360,
    height: 640,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    marginBottom: 16,
  },
  grade: {
    fontSize: 72,
    fontFamily: 'Outfit_800ExtraBold',
    marginBottom: 12,
  },
  ringContainer: {
    width: RING_SIZE,
    height: RING_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  ringText: {
    position: 'absolute',
    fontSize: 22,
    fontFamily: 'Outfit_700Bold',
  },
  calText: {
    fontSize: 20,
    fontFamily: 'DMSans_600SemiBold',
    marginBottom: 12,
  },
  macroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  macroItem: {
    fontSize: 16,
    fontFamily: 'DMSans_600SemiBold',
  },
  macroDivider: {
    fontSize: 16,
    fontFamily: 'DMSans_400Regular',
  },
  streak: {
    fontSize: 18,
    fontFamily: 'DMSans_600SemiBold',
    marginBottom: 20,
  },
  userName: {
    fontSize: 16,
    fontFamily: 'DMSans_600SemiBold',
    marginBottom: 4,
  },
  date: {
    fontSize: 16,
    fontFamily: 'DMSans_400Regular',
    marginBottom: 24,
  },
  footer: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
  },
});
