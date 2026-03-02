import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Text } from '@/src/theme/restyleTheme';
import { useTheme } from '@/src/context/ThemeContext';
import { supabase } from '@/src/utils/supabase';
import { requireUserId } from '@/src/utils/auth';
import { triggerHaptic } from '@/src/utils/haptics';

// ── Types ───────────────────────────────────────────────────────────────────

const MEAL_PERIODS = ['Breakfast', 'Lunch', 'Dinner', 'Snack'] as const;
type MealPeriod = (typeof MEAL_PERIODS)[number];

export interface DiningMealData {
  type: 'dining';
  id: string;
  name: string;
  station?: string;
  meal: string;
  servings: number;
}

export interface CustomMealData {
  type: 'custom';
  id: string;
  name: string;
  calories: number;
  protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
  meal_period: string;
}

export type EditingMeal = DiningMealData | CustomMealData;

interface EditMealModalProps {
  visible: boolean;
  meal: EditingMeal | null;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}

interface FieldErrors {
  name?: string;
  calories?: string;
  protein?: string;
  carbs?: string;
  fat?: string;
}

// ── Component ───────────────────────────────────────────────────────────────

export default function EditMealModal({
  visible,
  meal,
  onClose,
  onSaved,
  onDeleted,
}: EditMealModalProps) {
  const { colors } = useTheme();

  // Dining hall meal state
  const [servings, setServings] = useState(1);

  // Custom meal state
  const [name, setName] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [mealPeriod, setMealPeriod] = useState<MealPeriod>('Snack');
  const [errors, setErrors] = useState<FieldErrors>({});

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Populate form when modal opens or meal changes
  useEffect(() => {
    if (visible && meal) {
      setSaving(false);
      setDeleting(false);
      setErrors({});

      if (meal.type === 'dining') {
        setServings(meal.servings);
      } else {
        setName(meal.name);
        setCalories(String(meal.calories));
        setProtein(String(meal.protein_g));
        setCarbs(String(meal.total_carbs_g));
        setFat(String(meal.total_fat_g));
        setMealPeriod((meal.meal_period as MealPeriod) || 'Snack');
      }
    }
  }, [visible, meal]);

  if (!meal) return null;

  const isDining = meal.type === 'dining';

  // ── Dining: servings stepper ──────────────────────────────────────────────

  const adjustServings = (delta: number) => {
    setServings((prev) => {
      const next = Math.round((prev + delta) * 10) / 10;
      if (next < 0.5) return 0.5;
      if (next > 10) return 10;
      return next;
    });
  };

  // ── Custom: validation ────────────────────────────────────────────────────

  const validateCustom = (): boolean => {
    const newErrors: FieldErrors = {};
    const trimmedName = name.trim();

    if (trimmedName.length < 1) {
      newErrors.name = 'Name is required';
    } else if (trimmedName.length > 100) {
      newErrors.name = 'Must be under 100 characters';
    }

    const cal = parseInt(calories, 10);
    if (calories === '' || isNaN(cal)) {
      newErrors.calories = 'Required';
    } else if (cal < 0 || cal > 5000) {
      newErrors.calories = '0-5000';
    }

    const pro = parseFloat(protein || '0');
    if (protein !== '' && (isNaN(pro) || pro < 0 || pro > 500)) {
      newErrors.protein = '0-500';
    }

    const crb = parseFloat(carbs || '0');
    if (carbs !== '' && (isNaN(crb) || crb < 0 || crb > 500)) {
      newErrors.carbs = '0-500';
    }

    const ft = parseFloat(fat || '0');
    if (fat !== '' && (isNaN(ft) || ft < 0 || ft > 500)) {
      newErrors.fat = '0-500';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (isDining) {
      setSaving(true);
      try {
        const userId = await requireUserId();
        const { error } = await supabase
          .from('meal_logs')
          .update({ servings })
          .eq('id', meal.id)
          .eq('user_id', userId);

        if (error) {
          console.warn('Update meal_logs error:', error.message);
          Alert.alert('Error', 'Failed to save. Please try again.');
          setSaving(false);
          return;
        }

        triggerHaptic('success');
        onSaved();
        onClose();
      } catch (e) {
        console.warn('Save dining meal error:', e);
        Alert.alert('Error', 'Something went wrong. Please try again.');
        setSaving(false);
      }
    } else {
      if (!validateCustom()) return;

      setSaving(true);
      try {
        const userId = await requireUserId();
        const { error } = await supabase
          .from('custom_meals')
          .update({
            name: name.trim(),
            calories: parseInt(calories, 10),
            protein_g: parseFloat(protein || '0'),
            total_carbs_g: parseFloat(carbs || '0'),
            total_fat_g: parseFloat(fat || '0'),
            meal_period: mealPeriod,
          })
          .eq('id', meal.id)
          .eq('user_id', userId);

        if (error) {
          console.warn('Update custom_meals error:', error.message);
          Alert.alert('Error', 'Failed to save. Please try again.');
          setSaving(false);
          return;
        }

        triggerHaptic('success');
        onSaved();
        onClose();
      } catch (e) {
        console.warn('Save custom meal error:', e);
        Alert.alert('Error', 'Something went wrong. Please try again.');
        setSaving(false);
      }
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDelete = () => {
    Alert.alert('Delete Meal', 'Are you sure you want to remove this meal?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            const userId = await requireUserId();
            const table = isDining ? 'meal_logs' : 'custom_meals';
            const { error } = await supabase
              .from(table)
              .delete()
              .eq('id', meal.id)
              .eq('user_id', userId);

            if (error) {
              console.warn(`Delete ${table} error:`, error.message);
              Alert.alert('Error', 'Failed to delete. Please try again.');
              setDeleting(false);
              return;
            }

            triggerHaptic('success');
            onDeleted();
            onClose();
          } catch (e) {
            console.warn('Delete meal error:', e);
            Alert.alert('Error', 'Something went wrong. Please try again.');
            setDeleting(false);
          }
        },
      },
    ]);
  };

  // ── Section header style ──────────────────────────────────────────────────

  const sectionHeaderStyle = {
    fontSize: 11,
    fontFamily: 'DMSans_600SemiBold' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 1.5,
    color: colors.silver,
    marginBottom: 8,
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Modal handle */}
        <View style={{ alignItems: 'center', paddingTop: 8, paddingBottom: 4 }}>
          <View
            style={{
              width: 36,
              height: 4,
              borderRadius: 9999,
              backgroundColor: colors.silver,
            }}
          />
        </View>

        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 20,
            paddingVertical: 16,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <View style={{ width: 64 }} />
          <Text
            style={{
              flex: 1,
              textAlign: 'center',
              fontSize: 17,
              color: colors.text,
              fontFamily: 'Outfit_700Bold',
            }}
          >
            Edit Meal
          </Text>
          <TouchableOpacity
            onPress={onClose}
            style={{ width: 64, alignItems: 'flex-end' }}
            activeOpacity={0.6}
          >
            <Feather name="x" size={22} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            contentContainerStyle={{ padding: 20, paddingBottom: 48 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {isDining ? (
              /* ── Dining Hall Meal ── */
              <>
                {/* Item name (read-only) */}
                <Text style={sectionHeaderStyle}>Item</Text>
                <View
                  style={{
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.cardAlt,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    marginBottom: 4,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 15,
                      fontFamily: 'DMSans_600SemiBold',
                      color: colors.text,
                    }}
                    numberOfLines={2}
                  >
                    {meal.name}
                  </Text>
                </View>
                {(meal as DiningMealData).station ? (
                  <Text
                    style={{
                      fontSize: 12,
                      fontFamily: 'DMSans_400Regular',
                      color: colors.textMuted,
                      marginBottom: 16,
                      marginLeft: 4,
                    }}
                  >
                    {(meal as DiningMealData).station} · {(meal as DiningMealData).meal}
                  </Text>
                ) : (
                  <Text
                    style={{
                      fontSize: 12,
                      fontFamily: 'DMSans_400Regular',
                      color: colors.textMuted,
                      marginBottom: 16,
                      marginLeft: 4,
                    }}
                  >
                    {(meal as DiningMealData).meal}
                  </Text>
                )}

                {/* Servings stepper */}
                <Text style={sectionHeaderStyle}>Servings</Text>
                <View
                  style={{
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.card,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingVertical: 12,
                    gap: 20,
                    marginBottom: 28,
                  }}
                >
                  <TouchableOpacity
                    onPress={() => adjustServings(-0.5)}
                    disabled={servings <= 0.5}
                    activeOpacity={0.6}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      backgroundColor: servings <= 0.5 ? colors.cardAlt : colors.cardAlt,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 1,
                      borderColor: colors.border,
                      opacity: servings <= 0.5 ? 0.4 : 1,
                    }}
                  >
                    <Feather name="minus" size={18} color={colors.text} />
                  </TouchableOpacity>

                  <Text
                    style={{
                      fontSize: 28,
                      fontFamily: 'Outfit_700Bold',
                      color: colors.text,
                      minWidth: 60,
                      textAlign: 'center',
                    }}
                  >
                    {servings}
                  </Text>

                  <TouchableOpacity
                    onPress={() => adjustServings(0.5)}
                    disabled={servings >= 10}
                    activeOpacity={0.6}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      backgroundColor: colors.cardAlt,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 1,
                      borderColor: colors.border,
                      opacity: servings >= 10 ? 0.4 : 1,
                    }}
                  >
                    <Feather name="plus" size={18} color={colors.text} />
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              /* ── Custom Meal ── */
              <>
                {/* Meal Name */}
                <Text style={sectionHeaderStyle}>Meal Name</Text>
                <View
                  style={{
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: errors.name ? colors.red : colors.border,
                    backgroundColor: colors.card,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    marginBottom: errors.name ? 4 : 16,
                  }}
                >
                  <TextInput
                    style={{
                      fontSize: 15,
                      fontFamily: 'DMSans_400Regular',
                      color: colors.text,
                    }}
                    placeholder="e.g. Chipotle Bowl"
                    placeholderTextColor={colors.textDim}
                    value={name}
                    onChangeText={setName}
                    returnKeyType="next"
                    maxLength={100}
                  />
                </View>
                {errors.name ? (
                  <Text
                    style={{
                      fontSize: 12,
                      fontFamily: 'DMSans_400Regular',
                      color: colors.red,
                      marginBottom: 12,
                    }}
                  >
                    {errors.name}
                  </Text>
                ) : null}

                {/* Calories */}
                <Text style={sectionHeaderStyle}>Calories</Text>
                <View
                  style={{
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: errors.calories ? colors.red : colors.border,
                    backgroundColor: colors.card,
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    marginBottom: errors.calories ? 4 : 16,
                  }}
                >
                  <TextInput
                    style={{
                      flex: 1,
                      fontSize: 20,
                      fontFamily: 'Outfit_700Bold',
                      color: colors.text,
                      textAlign: 'center',
                    }}
                    placeholder="0"
                    placeholderTextColor={colors.textDim}
                    value={calories}
                    onChangeText={(t) => setCalories(t.replace(/[^0-9]/g, ''))}
                    keyboardType="number-pad"
                    returnKeyType="done"
                    maxLength={4}
                    selectTextOnFocus
                  />
                  <Text
                    style={{
                      fontSize: 13,
                      fontFamily: 'DMSans_400Regular',
                      color: colors.textMuted,
                      marginLeft: 4,
                    }}
                  >
                    kcal
                  </Text>
                </View>
                {errors.calories ? (
                  <Text
                    style={{
                      fontSize: 12,
                      fontFamily: 'DMSans_400Regular',
                      color: colors.red,
                      marginBottom: 12,
                    }}
                  >
                    {errors.calories}
                  </Text>
                ) : null}

                {/* Macros — 3 column row */}
                <Text style={sectionHeaderStyle}>Macros</Text>
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
                  {/* Protein */}
                  <View style={{ flex: 1 }}>
                    <View
                      style={{
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: errors.protein ? colors.red : colors.border,
                        backgroundColor: colors.card,
                        padding: 12,
                        alignItems: 'center',
                      }}
                    >
                      <View
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: colors.blue,
                          marginBottom: 6,
                        }}
                      />
                      <TextInput
                        style={{
                          fontSize: 18,
                          fontFamily: 'Outfit_700Bold',
                          color: colors.text,
                          textAlign: 'center',
                          width: '100%',
                        }}
                        placeholder="0"
                        placeholderTextColor={colors.textDim}
                        value={protein}
                        onChangeText={(t) => setProtein(t.replace(/[^0-9.]/g, ''))}
                        keyboardType="decimal-pad"
                        returnKeyType="done"
                        maxLength={5}
                        selectTextOnFocus
                      />
                      <Text
                        style={{
                          fontSize: 11,
                          fontFamily: 'DMSans_400Regular',
                          color: colors.textMuted,
                          marginTop: 2,
                        }}
                      >
                        Protein (g)
                      </Text>
                    </View>
                    {errors.protein ? (
                      <Text
                        style={{
                          fontSize: 11,
                          fontFamily: 'DMSans_400Regular',
                          color: colors.red,
                          marginTop: 2,
                          textAlign: 'center',
                        }}
                      >
                        {errors.protein}
                      </Text>
                    ) : null}
                  </View>

                  {/* Carbs */}
                  <View style={{ flex: 1 }}>
                    <View
                      style={{
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: errors.carbs ? colors.red : colors.border,
                        backgroundColor: colors.card,
                        padding: 12,
                        alignItems: 'center',
                      }}
                    >
                      <View
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: colors.yellow,
                          marginBottom: 6,
                        }}
                      />
                      <TextInput
                        style={{
                          fontSize: 18,
                          fontFamily: 'Outfit_700Bold',
                          color: colors.text,
                          textAlign: 'center',
                          width: '100%',
                        }}
                        placeholder="0"
                        placeholderTextColor={colors.textDim}
                        value={carbs}
                        onChangeText={(t) => setCarbs(t.replace(/[^0-9.]/g, ''))}
                        keyboardType="decimal-pad"
                        returnKeyType="done"
                        maxLength={5}
                        selectTextOnFocus
                      />
                      <Text
                        style={{
                          fontSize: 11,
                          fontFamily: 'DMSans_400Regular',
                          color: colors.textMuted,
                          marginTop: 2,
                        }}
                      >
                        Carbs (g)
                      </Text>
                    </View>
                    {errors.carbs ? (
                      <Text
                        style={{
                          fontSize: 11,
                          fontFamily: 'DMSans_400Regular',
                          color: colors.red,
                          marginTop: 2,
                          textAlign: 'center',
                        }}
                      >
                        {errors.carbs}
                      </Text>
                    ) : null}
                  </View>

                  {/* Fat */}
                  <View style={{ flex: 1 }}>
                    <View
                      style={{
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: errors.fat ? colors.red : colors.border,
                        backgroundColor: colors.card,
                        padding: 12,
                        alignItems: 'center',
                      }}
                    >
                      <View
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: colors.silver,
                          marginBottom: 6,
                        }}
                      />
                      <TextInput
                        style={{
                          fontSize: 18,
                          fontFamily: 'Outfit_700Bold',
                          color: colors.text,
                          textAlign: 'center',
                          width: '100%',
                        }}
                        placeholder="0"
                        placeholderTextColor={colors.textDim}
                        value={fat}
                        onChangeText={(t) => setFat(t.replace(/[^0-9.]/g, ''))}
                        keyboardType="decimal-pad"
                        returnKeyType="done"
                        maxLength={5}
                        selectTextOnFocus
                      />
                      <Text
                        style={{
                          fontSize: 11,
                          fontFamily: 'DMSans_400Regular',
                          color: colors.textMuted,
                          marginTop: 2,
                        }}
                      >
                        Fat (g)
                      </Text>
                    </View>
                    {errors.fat ? (
                      <Text
                        style={{
                          fontSize: 11,
                          fontFamily: 'DMSans_400Regular',
                          color: colors.red,
                          marginTop: 2,
                          textAlign: 'center',
                        }}
                      >
                        {errors.fat}
                      </Text>
                    ) : null}
                  </View>
                </View>

                {/* Meal Period Pills */}
                <Text style={sectionHeaderStyle}>Meal Period</Text>
                <View
                  style={{
                    flexDirection: 'row',
                    gap: 8,
                    marginBottom: 28,
                  }}
                >
                  {MEAL_PERIODS.map((period) => {
                    const active = mealPeriod === period;
                    return (
                      <TouchableOpacity
                        key={period}
                        onPress={() => setMealPeriod(period)}
                        activeOpacity={0.7}
                        style={{
                          flex: 1,
                          paddingVertical: 10,
                          borderRadius: 24,
                          borderWidth: 1,
                          alignItems: 'center',
                          backgroundColor: active ? colors.maroon : colors.cardAlt,
                          borderColor: active ? colors.maroon : colors.border,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 13,
                            fontFamily: 'DMSans_600SemiBold',
                            color: active ? '#FFFFFF' : colors.textMuted,
                          }}
                        >
                          {period}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            {/* ── Two-button footer ── */}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {/* Delete — outline, red text */}
              <TouchableOpacity
                style={{
                  flex: 1,
                  borderRadius: 14,
                  paddingVertical: 16,
                  height: 52,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: colors.red,
                  backgroundColor: 'transparent',
                  opacity: deleting ? 0.6 : 1,
                }}
                onPress={handleDelete}
                disabled={saving || deleting}
                activeOpacity={0.85}
              >
                {deleting ? (
                  <ActivityIndicator color={colors.red} />
                ) : (
                  <Text
                    style={{
                      color: colors.red,
                      fontSize: 16,
                      fontFamily: 'DMSans_700Bold',
                    }}
                  >
                    Delete
                  </Text>
                )}
              </TouchableOpacity>

              {/* Save — filled maroon */}
              <TouchableOpacity
                style={{
                  flex: 1,
                  borderRadius: 14,
                  paddingVertical: 16,
                  height: 52,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.maroon,
                  opacity: saving ? 0.6 : 1,
                }}
                onPress={handleSave}
                disabled={saving || deleting}
                activeOpacity={0.85}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text
                    style={{
                      color: '#FFFFFF',
                      fontSize: 16,
                      fontFamily: 'DMSans_700Bold',
                    }}
                  >
                    Save
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
