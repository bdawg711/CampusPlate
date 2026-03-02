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

export interface CustomMeal {
  id: string;
  name: string;
  calories: number;
  protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
  meal_period: string;
  created_at?: string;
}

interface MealLogSectionProps {
  logs: MealLog[];
  customMeals?: CustomMeal[];
  onHistoryPress: () => void;
  onDeleteLog: (logId: string) => void;
  logBelongsToMealGroup: (logMeal: string, group: string) => boolean;
  onBrowseMeal?: (meal: string) => void;
  onCustomMealPress?: () => void;
  onDeleteCustomMeal?: (id: string) => void;
}

// ── Meal groups config ──────────────────────────────────────────────────────

const MEAL_GROUPS: { key: string; label: string; labelLower: string }[] = [
  { key: 'Breakfast', label: 'BREAKFAST', labelLower: 'breakfast' },
  { key: 'Lunch', label: 'LUNCH', labelLower: 'lunch' },
  { key: 'Dinner', label: 'DINNER', labelLower: 'dinner' },
  { key: 'Snack', label: 'SNACKS', labelLower: 'snacks' },
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
  customMeals = [],
  onHistoryPress,
  onDeleteLog,
  logBelongsToMealGroup,
  onBrowseMeal,
  onCustomMealPress,
  onDeleteCustomMeal,
}: MealLogSectionProps) {
  // Filter out Snack group if there are no custom snack meals
  const hasSnackCustom = customMeals.some((m) => m.meal_period === 'Snack');
  const visibleGroups = MEAL_GROUPS.filter(
    (g) => g.key !== 'Snack' || hasSnackCustom,
  );

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
        <Box flexDirection="row" alignItems="center" style={{ gap: 16 }}>
          {onCustomMealPress && (
            <Text
              variant="bodySmall"
              color="maroon"
              style={{ fontFamily: 'DMSans_500Medium', fontSize: 13 }}
              onPress={onCustomMealPress}
            >
              + Custom
            </Text>
          )}
          <Text
            variant="bodySmall"
            color="maroon"
            style={{ fontFamily: 'DMSans_600SemiBold' }}
            onPress={onHistoryPress}
          >
            History →
          </Text>
        </Box>
      </Box>

      {/* Meal groups */}
      {visibleGroups.map((group, groupIdx) => {
        const mealLogs = logs.filter((l) =>
          logBelongsToMealGroup(l.meal, group.key),
        );
        const groupCustom = customMeals.filter(
          (m) => m.meal_period === group.key,
        );
        const mealCals =
          mealLogs.reduce((sum, l) => sum + getNutrition(l).cal, 0) +
          groupCustom.reduce((sum, m) => sum + (m.calories || 0), 0);
        const totalItems = mealLogs.length + groupCustom.length;

        return (
          <Box key={group.key} marginBottom="m">
            {/* Section header */}
            <Text variant="sectionHeader" marginBottom="s">
              {group.label} — {mealCals} CAL
            </Text>

            {totalItems === 0 ? (
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
              <>
                {/* Dining hall logs */}
                {mealLogs.map((log, i) => {
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
                          accessibilityLabel="Delete meal"
                          accessibilityRole="button"
                          style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'center' }}
                        >
                          <Feather name="x" size={16} color="#9A9A9E" />
                        </TouchableOpacity>
                      </Box>

                      {/* Divider */}
                      {(i < mealLogs.length - 1 || groupCustom.length > 0) && (
                        <Box height={1} backgroundColor="borderLight" />
                      )}
                    </Box>
                  );
                })}

                {/* Custom meals */}
                {groupCustom.map((meal, i) => {
                  const pro = Math.round(meal.protein_g || 0);
                  const carb = Math.round(meal.total_carbs_g || 0);
                  const fat = Math.round(meal.total_fat_g || 0);
                  return (
                    <Box key={meal.id}>
                      <Box
                        flexDirection="row"
                        alignItems="center"
                        paddingVertical="s"
                      >
                        <Feather
                          name="edit-3"
                          size={14}
                          color="#E87722"
                          style={{ marginRight: 8 }}
                        />
                        <Box flex={1}>
                          <Box flexDirection="row" alignItems="center" style={{ gap: 6 }}>
                            <Text variant="body" numberOfLines={1} style={{ flexShrink: 1 }}>
                              {meal.name}
                            </Text>
                            <Box
                              style={{
                                paddingHorizontal: 6,
                                paddingVertical: 1,
                                borderRadius: 4,
                                backgroundColor: 'rgba(232,119,34,0.12)',
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 10,
                                  fontFamily: 'DMSans_600SemiBold',
                                  color: '#E87722',
                                }}
                              >
                                Custom
                              </Text>
                            </Box>
                          </Box>
                          <Text variant="dim" style={{ marginTop: 2 }}>
                            P {pro}g · C {carb}g · F {fat}g
                          </Text>
                        </Box>

                        <Text
                          variant="bodySmall"
                          color="textMuted"
                          style={{ marginRight: 8 }}
                        >
                          {meal.calories} cal
                        </Text>

                        <TouchableOpacity
                          onPress={() => onDeleteCustomMeal?.(meal.id)}
                          accessibilityLabel="Delete custom meal"
                          accessibilityRole="button"
                          style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'center' }}
                        >
                          <Feather name="x" size={16} color="#9A9A9E" />
                        </TouchableOpacity>
                      </Box>

                      {i < groupCustom.length - 1 && (
                        <Box height={1} backgroundColor="borderLight" />
                      )}
                    </Box>
                  );
                })}
              </>
            )}

            {/* Divider between groups */}
            {groupIdx < visibleGroups.length - 1 && (
              <Box height={1} backgroundColor="borderLight" marginTop="s" />
            )}
          </Box>
        );
      })}
    </Box>
  );
}
