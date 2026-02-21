import React from 'react';
import { View } from 'react-native';
import { Box, Text } from '../theme/restyleTheme';
import AnimatedNumber from './AnimatedNumber';

interface MacroData {
  current: number;
  goal: number;
}

interface MacroLegendProps {
  calories: MacroData;
  protein: MacroData;
  carbs: MacroData;
  fat: MacroData;
}

const LEGEND_ITEMS: { label: string; key: keyof MacroLegendProps; dotColor: string; overColor: string; suffix: string }[] = [
  { label: 'Calories', key: 'calories', dotColor: '#861F41', overColor: '#861F41', suffix: '' },
  { label: 'Protein', key: 'protein', dotColor: '#4A7FC5', overColor: '#4A7FC5', suffix: 'g' },
  { label: 'Carbs', key: 'carbs', dotColor: '#C5A55A', overColor: '#C5A55A', suffix: 'g' },
  { label: 'Fat', key: 'fat', dotColor: '#A8A9AD', overColor: '#666666', suffix: 'g' },
];

export default function MacroLegend({ calories, protein, carbs, fat }: MacroLegendProps) {
  const data: Record<string, MacroData> = { calories, protein, carbs, fat };

  return (
    <View style={{ gap: 12 }}>
      {/* Row 1: Calories + Protein */}
      <View style={{ flexDirection: 'row', gap: 16 }}>
        {LEGEND_ITEMS.slice(0, 2).map((item) => {
          const macro = data[item.key];
          const isOver = macro.current > macro.goal;
          return (
            <View key={item.key} style={{ flex: 1, alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                <View style={{ width: 8, height: 8, borderRadius: 9999, backgroundColor: item.dotColor }} />
                <Text variant="muted" style={{ fontSize: 12 }}>{item.label}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                <AnimatedNumber
                  value={macro.current}
                  fontSize={18}
                  fontFamily="DMSans_700Bold"
                  color={isOver ? item.overColor : undefined}
                  suffix={item.suffix}
                />
                <Text variant="dim" style={{ marginLeft: 4 }}>
                  of {macro.goal.toLocaleString()}{item.suffix}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
      {/* Row 2: Carbs + Fat */}
      <View style={{ flexDirection: 'row', gap: 16 }}>
        {LEGEND_ITEMS.slice(2, 4).map((item) => {
          const macro = data[item.key];
          const isOver = macro.current > macro.goal;
          return (
            <View key={item.key} style={{ flex: 1, alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                <View style={{ width: 8, height: 8, borderRadius: 9999, backgroundColor: item.dotColor }} />
                <Text variant="muted" style={{ fontSize: 12 }}>{item.label}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                <AnimatedNumber
                  value={macro.current}
                  fontSize={18}
                  fontFamily="DMSans_700Bold"
                  color={isOver ? item.overColor : undefined}
                  suffix={item.suffix}
                />
                <Text variant="dim" style={{ marginLeft: 4 }}>
                  of {macro.goal.toLocaleString()}{item.suffix}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}
