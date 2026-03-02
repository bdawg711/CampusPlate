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

const MEAL_PERIODS = ['Breakfast', 'Lunch', 'Dinner', 'Snack'] as const;
type MealPeriod = (typeof MEAL_PERIODS)[number];

interface CustomMealModalProps {
  visible: boolean;
  onClose: () => void;
  onLogged: () => void;
  /** Date string in YYYY-MM-DD format */
  date: string;
}

interface FieldErrors {
  name?: string;
  calories?: string;
  protein?: string;
  carbs?: string;
  fat?: string;
}

export default function CustomMealModal({
  visible,
  onClose,
  onLogged,
  date,
}: CustomMealModalProps) {
  const { colors } = useTheme();

  const [name, setName] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [mealPeriod, setMealPeriod] = useState<MealPeriod>('Snack');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  // Reset form when modal opens
  useEffect(() => {
    if (visible) {
      setName('');
      setCalories('');
      setProtein('');
      setCarbs('');
      setFat('');
      setMealPeriod('Snack');
      setSaving(false);
      setErrors({});
    }
  }, [visible]);

  const validate = (): boolean => {
    const newErrors: FieldErrors = {};
    const trimmedName = name.trim();

    if (trimmedName.length < 1) {
      newErrors.name = 'Name is required';
    } else if (trimmedName.length > 100) {
      newErrors.name = 'Name must be under 100 characters';
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

  const canSubmit = name.trim().length > 0 && calories.trim().length > 0 && !saving;

  const handleSubmit = async () => {
    if (!validate()) return;

    setSaving(true);
    try {
      const userId = await requireUserId();

      const { error } = await supabase.from('custom_meals').insert({
        user_id: userId,
        name: name.trim(),
        calories: parseInt(calories, 10),
        protein_g: parseFloat(protein || '0'),
        total_carbs_g: parseFloat(carbs || '0'),
        total_fat_g: parseFloat(fat || '0'),
        date,
        meal_period: mealPeriod,
      });

      if (error) {
        console.warn('Custom meal insert error:', error.message);
        Alert.alert('Error', 'Failed to log meal. Please try again.');
        setSaving(false);
        return;
      }

      triggerHaptic('success');
      onLogged();
      onClose();
    } catch (e) {
      console.warn('Custom meal error:', e);
      Alert.alert('Error', 'Something went wrong. Please try again.');
      setSaving(false);
    }
  };

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
            Log Custom Meal
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
            {/* Meal Name */}
            <Text
              style={{
                fontSize: 11,
                fontFamily: 'DMSans_600SemiBold',
                textTransform: 'uppercase',
                letterSpacing: 1.5,
                color: colors.silver,
                marginBottom: 8,
              }}
            >
              Meal Name
            </Text>
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
            <Text
              style={{
                fontSize: 11,
                fontFamily: 'DMSans_600SemiBold',
                textTransform: 'uppercase',
                letterSpacing: 1.5,
                color: colors.silver,
                marginBottom: 8,
              }}
            >
              Calories
            </Text>
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
            <Text
              style={{
                fontSize: 11,
                fontFamily: 'DMSans_600SemiBold',
                textTransform: 'uppercase',
                letterSpacing: 1.5,
                color: colors.silver,
                marginBottom: 8,
              }}
            >
              Macros
            </Text>
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
            <Text
              style={{
                fontSize: 11,
                fontFamily: 'DMSans_600SemiBold',
                textTransform: 'uppercase',
                letterSpacing: 1.5,
                color: colors.silver,
                marginBottom: 8,
              }}
            >
              Meal Period
            </Text>
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

            {/* Log Meal Button */}
            <TouchableOpacity
              style={{
                borderRadius: 14,
                paddingVertical: 16,
                height: 52,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.maroon,
                opacity: canSubmit ? 1 : 0.5,
              }}
              onPress={handleSubmit}
              disabled={!canSubmit}
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
                  Log Meal
                </Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
