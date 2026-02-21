import React from 'react';
import { TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Box, Text } from '../theme/restyleTheme';

// ── Types ───────────────────────────────────────────────────────────────────

interface NutritionData {
  calories: number;
  protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
}

export interface MealLog {
  id: string;
  servings: number;
  meal: string;
  created_at?: string;
  menu_items: {
    id?: number;
    name: string;
    station?: string;
    nutrition: NutritionData | NutritionData[] | null;
  } | null;
}

interface MealLogSectionProps {
  logs: MealLog[];
  onHistoryPress: () => void;
  onDeleteLog: (logId: string) => void;
  logBelongsToMealGroup: (logMeal: string, group: string) => boolean;
  onBrowseMeal?: (meal: string) => void;
}

// ── Meal groups config ──────────────────────────────────────────────────────

const MEAL_GROUPS: { key: string; label: string; labelLower: string }[] = [
  { key: 'Breakfast', label: 'BREAKFAST', labelLower: 'breakfast' },
  { key: 'Lunch', label: 'LUNCH', labelLower: 'lunch' },
  { key: 'Dinner', label: 'DINNER', labelLower: 'dinner' },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

function getNutrition(log: MealLog) {
  const raw = log.menu_items?.nutrition;
  const n = Array.isArray(raw) ? raw[0] : raw;
  const cal = n?.calories || 0;
  const pro = n?.protein_g || 0;
  const carb = n?.total_carbs_g || 0;
  const fat = n?.total_fat_g || 0;
  const s = log.servings || 1;
  return {
    cal: Math.round(cal * s),
    pro: Math.round(pro * s),
    carb: Math.round(carb * s),
    fat: Math.round(fat * s),
  };
}

function getMealName(log: MealLog): string {
  const mi = log.menu_items as any;
  if (typeof mi === 'string') return mi;
  if (mi?.name) return mi.name;
  return 'Unknown item';
}

// ── Component ───────────────────────────────────────────────────────────────

export default function MealLogSection({
  logs,
  onHistoryPress,
  onDeleteLog,
  logBelongsToMealGroup,
  onBrowseMeal,
}: MealLogSectionProps) {
  return (
    <Box>
      {/* Header */}
      <Box
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
        marginBottom="m"
      >
        <Text variant="cardTitle">Today's Meals</Text>
        <Text
          variant="bodySmall"
          color="maroon"
          style={{ fontFamily: 'DMSans_600SemiBold' }}
          onPress={onHistoryPress}
        >
          History →
        </Text>
      </Box>

      {/* Meal groups */}
      {MEAL_GROUPS.map((group, groupIdx) => {
        const mealLogs = logs.filter((l) =>
          logBelongsToMealGroup(l.meal, group.key),
        );
        const mealCals = mealLogs.reduce(
          (sum, l) => sum + getNutrition(l).cal,
          0,
        );

        return (
          <Box key={group.key} marginBottom="m">
            {/* Section header */}
            <Text variant="sectionHeader" marginBottom="s">
              {group.label} — {mealCals} CAL
            </Text>

            {mealLogs.length === 0 ? (
              /* Compact empty state — single line ~40px */
              <Box style={{ paddingVertical: 4 }}>
                <Text variant="muted" style={{ fontSize: 13 }}>
                  Nothing for {group.labelLower} yet{' · '}
                  <Text
                    variant="muted"
                    style={{ fontSize: 13, color: '#861F41', fontFamily: 'DMSans_600SemiBold' }}
                    onPress={() => onBrowseMeal?.(group.key)}
                  >
                    Browse →
                  </Text>
                </Text>
              </Box>
            ) : (
              mealLogs.map((log, i) => {
                const n = getNutrition(log);
                return (
                  <Box key={log.id}>
                    <Box
                      flexDirection="row"
                      alignItems="center"
                      paddingVertical="s"
                    >
                      {/* Name */}
                      <Box flex={1}>
                        <Text variant="body" numberOfLines={1}>
                          {getMealName(log)}
                        </Text>
                        <Text variant="dim" style={{ marginTop: 2 }}>
                          P {n.pro}g · C {n.carb}g · F {n.fat}g
                        </Text>
                      </Box>

                      {/* Calories */}
                      <Text
                        variant="bodySmall"
                        color="textMuted"
                        style={{ marginRight: 8 }}
                      >
                        {n.cal} cal
                      </Text>

                      {/* Delete */}
                      <TouchableOpacity
                        onPress={() => onDeleteLog(log.id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Feather name="x" size={16} color="#9A9A9E" />
                      </TouchableOpacity>
                    </Box>

                    {/* Divider between items */}
                    {i < mealLogs.length - 1 && (
                      <Box
                        height={1}
                        backgroundColor="borderLight"
                      />
                    )}
                  </Box>
                );
              })
            )}

            {/* Divider between groups */}
            {groupIdx < MEAL_GROUPS.length - 1 && (
              <Box height={1} backgroundColor="borderLight" marginTop="s" />
            )}
          </Box>
        );
      })}
    </Box>
  );
}
