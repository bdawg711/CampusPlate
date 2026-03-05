import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';

import { Box, Text } from '@/src/theme/restyleTheme';
import { useTheme } from '@/src/context/ThemeContext';
import { requireUserId } from '@/src/utils/auth';
import { supabase } from '@/src/utils/supabase';
import {
  requestMealPlan,
  type MealPlanResponse,
  type MealPlanMeal,
} from '@/src/utils/ai';
import { fetchAndParseCalendar, getTodayEvents, type CalendarEvent } from '@/src/utils/calendar';

// ── Types ────────────────────────────────────────────────────────────────────

interface MealPlanViewProps {
  visible: boolean;
  onClose: () => void;
  onLogged?: () => void;
}

// ── Shimmer skeleton for loading ─────────────────────────────────────────────

function ShimmerCard() {
  const { colors } = useTheme();
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.3, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={animStyle}>
      <Box
        style={{
          borderRadius: 14,
          backgroundColor: colors.cardGlass,
          borderColor: colors.cardGlassBorder,
          borderWidth: 1,
          padding: 16,
          marginBottom: 12,
        }}
      >
        <Box flexDirection="row" alignItems="center" style={{ marginBottom: 12 }}>
          <Box style={{ width: 70, height: 22, borderRadius: 11, backgroundColor: colors.barTrack }} />
          <Box style={{ width: 80, height: 14, borderRadius: 7, backgroundColor: colors.barTrack, marginLeft: 12 }} />
        </Box>
        <Box style={{ width: '90%', height: 14, borderRadius: 7, backgroundColor: colors.barTrack, marginBottom: 8 }} />
        <Box style={{ width: '70%', height: 14, borderRadius: 7, backgroundColor: colors.barTrack, marginBottom: 8 }} />
        <Box style={{ width: '50%', height: 14, borderRadius: 7, backgroundColor: colors.barTrack }} />
      </Box>
    </Animated.View>
  );
}

// ── Meal type pill colors ────────────────────────────────────────────────────

function getMealPillColor(type: string, colors: any): { bg: string; text: string } {
  switch (type) {
    case 'Breakfast':
      return { bg: colors.warningTint, text: colors.yellow };
    case 'Lunch':
      return { bg: colors.successTint, text: colors.green };
    case 'Dinner':
      return { bg: colors.maroonTint, text: colors.maroon };
    case 'Snack':
      return { bg: colors.goldTint, text: colors.gold };
    default:
      return { bg: colors.mutedTint, text: colors.textMuted };
  }
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function MealPlanView({ visible, onClose, onLogged }: MealPlanViewProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [plan, setPlan] = useState<MealPlanResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loggingMealIdx, setLoggingMealIdx] = useState<number | null>(null);
  const [todayClasses, setTodayClasses] = useState<CalendarEvent[]>([]);
  const [hasCanvas, setHasCanvas] = useState(false);

  const generatePlan = useCallback(async () => {
    setLoading(true);
    setError(null);
    setPlan(null);

    try {
      const userId = await requireUserId();

      // Fetch profile for goals + Canvas URL
      const { data: profile } = await supabase
        .from('profiles')
        .select('goal_calories, goal_protein_g, goal_carbs_g, goal_fat_g, canvas_ical_url, dietary_needs')
        .eq('id', userId)
        .single();

      const goals = {
        calories: profile?.goal_calories ?? 2000,
        protein: profile?.goal_protein_g ?? 100,
        carbs: profile?.goal_carbs_g ?? 250,
        fat: profile?.goal_fat_g ?? 65,
      };

      // Parse dietary needs — handle string, array, or null
      const dietaryRaw = profile?.dietary_needs;
      let dietary: string[] = [];
      if (Array.isArray(dietaryRaw)) {
        dietary = dietaryRaw.filter(Boolean);
      } else if (typeof dietaryRaw === 'string' && dietaryRaw.trim()) {
        dietary = dietaryRaw.split(',').map((s: string) => s.trim()).filter(Boolean);
      }

      const preferences = { dietary, allergies: [] as string[] };

      // Load schedule if Canvas is linked
      let schedule: { name: string; start: string; end: string; location?: string }[] = [];
      const icalUrl = profile?.canvas_ical_url;
      if (icalUrl) {
        setHasCanvas(true);
        try {
          const weekEvents = await fetchAndParseCalendar(icalUrl);
          const todayEvents = getTodayEvents(weekEvents);
          setTodayClasses(todayEvents);
          schedule = todayEvents.map((e) => ({
            name: e.name,
            start: e.startTime,
            end: e.endTime,
            location: e.location || undefined,
          }));
        } catch {
          // Canvas fetch failed — continue without schedule
        }
      } else {
        setHasCanvas(false);
        setTodayClasses([]);
      }

      const result = await requestMealPlan(schedule, goals, preferences);
      setPlan(result);
    } catch (e: any) {
      setError(e?.message || "Couldn't generate meal plan. Try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Generate plan on open
  useEffect(() => {
    if (visible && !plan && !loading) {
      generatePlan();
    }
  }, [visible]);

  // Reset state on close
  const handleClose = () => {
    setPlan(null);
    setError(null);
    setLoading(false);
    onClose();
  };

  // Log all items from a meal in one tap
  const handleLogMeal = async (meal: MealPlanMeal, mealIdx: number) => {
    setLoggingMealIdx(mealIdx);
    try {
      const userId = await requireUserId();
      const d = new Date();
      const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

      // Log each item as a custom meal
      const inserts = meal.items.map((item) => ({
        user_id: userId,
        name: item.name,
        calories: Math.round(item.calories),
        protein_g: Math.round(item.protein),
        total_carbs_g: Math.round(item.carbs),
        total_fat_g: Math.round(item.fat),
        meal_period: meal.type,
        date: today,
      }));

      const { error: insertErr } = await supabase.from('custom_meals').insert(inserts);
      if (insertErr) {
        Alert.alert('Error', 'Failed to log meals. Please try again.');
        return;
      }

      Alert.alert('Logged!', `${meal.items.length} items from ${meal.type} added to your log.`);
      onLogged?.();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to log meals.');
    } finally {
      setLoggingMealIdx(null);
    }
  };

  // ── Format date for header ─────────────────────────────────────────────────
  const headerDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <Box flex={1} style={{ backgroundColor: colors.background }}>
        {/* ── Header ── */}
        <Box
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
          paddingHorizontal="m"
          style={{
            paddingTop: insets.top + 8,
            paddingBottom: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <Box flex={1}>
            <Text style={{ fontSize: 20, fontFamily: 'Outfit_700Bold', color: colors.text }}>
              Today's Meal Plan
            </Text>
            <Text style={{ fontSize: 13, fontFamily: 'DMSans_400Regular', color: colors.textMuted, marginTop: 2 }}>
              {headerDate}
            </Text>
          </Box>
          <TouchableOpacity
            onPress={handleClose}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: colors.cardGlass,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Feather name="x" size={20} color={colors.text} />
          </TouchableOpacity>
        </Box>

        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Loading State ── */}
          {loading && (
            <Box>
              <Box alignItems="center" style={{ marginBottom: 20 }}>
                <Text style={{ fontSize: 15, fontFamily: 'DMSans_500Medium', color: colors.textMuted }}>
                  Generating your meal plan...
                </Text>
              </Box>
              <ShimmerCard />
              <ShimmerCard />
              <ShimmerCard />
            </Box>
          )}

          {/* ── Error State ── */}
          {error && !loading && (
            <Box alignItems="center" style={{ paddingTop: 60 }}>
              <Feather name="alert-circle" size={48} color={colors.textDim} style={{ opacity: 0.3, marginBottom: 16 }} />
              <Text style={{ fontSize: 16, fontFamily: 'DMSans_500Medium', color: colors.text, textAlign: 'center', marginBottom: 8 }}>
                Couldn't generate plan
              </Text>
              <Text style={{ fontSize: 14, fontFamily: 'DMSans_400Regular', color: colors.textMuted, textAlign: 'center', marginBottom: 24 }}>
                {error}
              </Text>
              <TouchableOpacity
                onPress={generatePlan}
                style={{
                  paddingHorizontal: 24,
                  paddingVertical: 12,
                  borderRadius: 14,
                  backgroundColor: colors.maroon,
                }}
              >
                <Text style={{ fontSize: 15, fontFamily: 'DMSans_600SemiBold', color: '#FFFFFF' }}>
                  Try Again
                </Text>
              </TouchableOpacity>
            </Box>
          )}

          {/* ── Plan Content ── */}
          {plan && !loading && (
            <>
              {/* Schedule context */}
              {hasCanvas && todayClasses.length > 0 && (
                <Box
                  flexDirection="row"
                  alignItems="center"
                  style={{
                    marginBottom: 16,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 10,
                    backgroundColor: colors.successTint,
                  }}
                >
                  <Feather name="calendar" size={14} color={colors.green} style={{ marginRight: 8 }} />
                  <Text style={{ fontSize: 13, fontFamily: 'DMSans_500Medium', color: colors.green }}>
                    Built around your {todayClasses.length} class{todayClasses.length !== 1 ? 'es' : ''} today
                  </Text>
                </Box>
              )}

              {/* Meal cards timeline */}
              {plan.meals.map((meal, idx) => {
                const pillColor = getMealPillColor(meal.type, colors);
                const isLogging = loggingMealIdx === idx;

                return (
                  <Box
                    key={`${meal.type}-${idx}`}
                    style={{
                      borderRadius: 14,
                      backgroundColor: colors.cardGlass,
                      borderColor: colors.cardGlassBorder,
                      borderWidth: 1,
                      padding: 16,
                      marginBottom: 12,
                    }}
                  >
                    {/* Meal type pill + time/location */}
                    <Box flexDirection="row" alignItems="center" style={{ marginBottom: 12 }}>
                      <Box
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          borderRadius: 12,
                          backgroundColor: pillColor.bg,
                        }}
                      >
                        <Text style={{ fontSize: 12, fontFamily: 'DMSans_600SemiBold', color: pillColor.text }}>
                          {meal.type}
                        </Text>
                      </Box>
                      <Text style={{ fontSize: 13, fontFamily: 'DMSans_500Medium', color: colors.textMuted, marginLeft: 10 }}>
                        {meal.time}
                      </Text>
                      <Text style={{ fontSize: 11, fontFamily: 'DMSans_400Regular', color: colors.textDim, marginLeft: 6 }}>
                        · {meal.location}
                      </Text>
                    </Box>

                    {/* Items list */}
                    {meal.items.map((item, itemIdx) => (
                      <Box
                        key={`${item.name}-${itemIdx}`}
                        flexDirection="row"
                        justifyContent="space-between"
                        alignItems="center"
                        style={{
                          paddingVertical: 8,
                          borderBottomWidth: itemIdx < meal.items.length - 1 ? 1 : 0,
                          borderBottomColor: colors.borderLight,
                        }}
                      >
                        <Text
                          style={{ fontSize: 14, fontFamily: 'DMSans_500Medium', color: colors.text, flex: 1 }}
                          numberOfLines={1}
                        >
                          {item.name}
                        </Text>
                        <Text style={{ fontSize: 13, fontFamily: 'DMSans_400Regular', color: colors.textMuted, marginLeft: 8 }}>
                          {Math.round(item.calories)} cal
                        </Text>
                      </Box>
                    ))}

                    {/* AI note */}
                    {!!meal.note && (
                      <Box
                        flexDirection="row"
                        alignItems="flex-start"
                        style={{
                          marginTop: 10,
                          paddingTop: 10,
                          borderTopWidth: 1,
                          borderTopColor: colors.borderLight,
                        }}
                      >
                        <Feather name="info" size={12} color={colors.textDim} style={{ marginRight: 6, marginTop: 2 }} />
                        <Text style={{ fontSize: 12, fontFamily: 'DMSans_400Regular', color: colors.textDim, flex: 1 }}>
                          {meal.note}
                        </Text>
                      </Box>
                    )}

                    {/* Log button */}
                    <TouchableOpacity
                      onPress={() => handleLogMeal(meal, idx)}
                      disabled={isLogging}
                      activeOpacity={0.7}
                      style={{
                        marginTop: 12,
                        paddingVertical: 10,
                        borderRadius: 10,
                        backgroundColor: colors.maroon,
                        alignItems: 'center',
                        opacity: isLogging ? 0.6 : 1,
                      }}
                    >
                      {isLogging ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={{ fontSize: 14, fontFamily: 'DMSans_600SemiBold', color: '#FFFFFF' }}>
                          Log These Items
                        </Text>
                      )}
                    </TouchableOpacity>
                  </Box>
                );
              })}

              {/* Daily total summary */}
              {plan.dailyTotal && (
                <Box
                  style={{
                    borderRadius: 14,
                    backgroundColor: colors.cardGlass,
                    borderColor: colors.cardGlassBorder,
                    borderWidth: 1,
                    padding: 16,
                    marginTop: 4,
                    marginBottom: 12,
                  }}
                >
                  <Text style={{ fontSize: 14, fontFamily: 'Outfit_700Bold', color: colors.text, marginBottom: 12 }}>
                    Daily Totals
                  </Text>
                  <Box flexDirection="row" justifyContent="space-between">
                    <MacroStat label="Calories" value={plan.dailyTotal.calories} unit="kcal" color={colors.maroon} />
                    <MacroStat label="Protein" value={plan.dailyTotal.protein} unit="g" color={colors.blue} />
                    <MacroStat label="Carbs" value={plan.dailyTotal.carbs} unit="g" color={colors.yellow} />
                    <MacroStat label="Fat" value={plan.dailyTotal.fat} unit="g" color={colors.orange} />
                  </Box>
                </Box>
              )}

              {/* AI Tip */}
              {!!plan.tip && (
                <Box
                  flexDirection="row"
                  alignItems="flex-start"
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    borderRadius: 12,
                    backgroundColor: colors.goldTint,
                    marginBottom: 16,
                  }}
                >
                  <Feather name="zap" size={14} color={colors.gold} style={{ marginRight: 8, marginTop: 1 }} />
                  <Text style={{ fontSize: 13, fontFamily: 'DMSans_500Medium', color: colors.text, flex: 1 }}>
                    {plan.tip}
                  </Text>
                </Box>
              )}

              {/* Regenerate + remaining */}
              <Box alignItems="center" style={{ marginTop: 8 }}>
                <TouchableOpacity
                  onPress={generatePlan}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 20,
                    paddingVertical: 10,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.card,
                  }}
                >
                  <Feather name="refresh-cw" size={14} color={colors.maroon} style={{ marginRight: 8 }} />
                  <Text style={{ fontSize: 14, fontFamily: 'DMSans_600SemiBold', color: colors.maroon }}>
                    Regenerate
                  </Text>
                </TouchableOpacity>
                <Text style={{ fontSize: 12, fontFamily: 'DMSans_400Regular', color: colors.textDim, marginTop: 8 }}>
                  {plan.remaining} plan{plan.remaining !== 1 ? 's' : ''} remaining today
                </Text>
              </Box>
            </>
          )}
        </ScrollView>
      </Box>
    </Modal>
  );
}

// ── Macro stat helper ────────────────────────────────────────────────────────

function MacroStat({ label, value, unit, color }: { label: string; value: number; unit: string; color: string }) {
  const { colors } = useTheme();
  return (
    <Box alignItems="center">
      <Text style={{ fontSize: 18, fontFamily: 'DMSans_700Bold', color }}>
        {Math.round(value)}
      </Text>
      <Text style={{ fontSize: 10, fontFamily: 'DMSans_400Regular', color: colors.textDim, marginTop: 2 }}>
        {unit}
      </Text>
      <Text style={{ fontSize: 11, fontFamily: 'DMSans_500Medium', color: colors.textMuted, marginTop: 1 }}>
        {label}
      </Text>
    </Box>
  );
}
