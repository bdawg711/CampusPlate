import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { Box, Text } from '@/src/theme/restyleTheme';
import { requireUserId } from '@/src/utils/auth';
import { supabase } from '@/src/utils/supabase';
import { getCurrentMealPeriod } from '@/src/utils/meals';
import { estimateMeal } from '@/src/utils/ai';

// ── Types ───────────────────────────────────────────────────────────────────

interface AIMealLogModalProps {
  visible: boolean;
  onClose: () => void;
  onLogged: () => void;
}

interface EstimateResult {
  name: string;
  calories: number;
  protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
}

type MealPeriod = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';

const MEAL_PERIODS: MealPeriod[] = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

// ── Component ───────────────────────────────────────────────────────────────

export default function AIMealLogModal({
  visible,
  onClose,
  onLogged,
}: AIMealLogModalProps) {
  const insets = useSafeAreaInsets();

  const [description, setDescription] = useState('');
  const [estimating, setEstimating] = useState(false);
  const [result, setResult] = useState<EstimateResult | null>(null);
  const [editing, setEditing] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState<MealPeriod>(
    getCurrentMealPeriod() as MealPeriod,
  );
  const [logging, setLogging] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);

  // Editable fields (strings for TextInput, parsed on save)
  const [editName, setEditName] = useState('');
  const [editCal, setEditCal] = useState('');
  const [editPro, setEditPro] = useState('');
  const [editCarb, setEditCarb] = useState('');
  const [editFat, setEditFat] = useState('');

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setDescription('');
      setEstimating(false);
      setResult(null);
      setEditing(false);
      setLogging(false);
      setErrorMsg(null);
      setSelectedMeal(getCurrentMealPeriod() as MealPeriod);
    }
  }, [visible]);

  // ── Estimate nutrition ─────────────────────────────────────────────────

  const handleEstimate = async () => {
    if (!description.trim() || estimating) return;
    Keyboard.dismiss();
    setEstimating(true);
    setErrorMsg(null);
    setResult(null);
    setEditing(false);

    try {
      const data = await estimateMeal(description.trim());
      setResult({
        name: data.name,
        calories: data.calories,
        protein_g: data.protein_g,
        total_carbs_g: data.total_carbs_g,
        total_fat_g: data.total_fat_g,
      });
      setRemaining(data.remaining);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      setErrorMsg(err?.message || "Couldn't estimate. Try being more specific.");
    } finally {
      setEstimating(false);
    }
  };

  // ── Start editing ──────────────────────────────────────────────────────

  const startEditing = () => {
    if (!result) return;
    setEditName(result.name);
    setEditCal(String(result.calories));
    setEditPro(String(result.protein_g));
    setEditCarb(String(result.total_carbs_g));
    setEditFat(String(result.total_fat_g));
    setEditing(true);
  };

  const saveEdits = () => {
    setResult({
      name: editName.trim() || 'Custom Meal',
      calories: parseInt(editCal, 10) || 0,
      protein_g: parseInt(editPro, 10) || 0,
      total_carbs_g: parseInt(editCarb, 10) || 0,
      total_fat_g: parseInt(editFat, 10) || 0,
    });
    setEditing(false);
    Keyboard.dismiss();
  };

  // ── Log to custom_meals ────────────────────────────────────────────────

  const handleLogMeal = async () => {
    if (!result || logging) return;
    setLogging(true);

    try {
      const userId = await requireUserId();
      const d = new Date();
      const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

      const { error } = await supabase.from('custom_meals').insert({
        user_id: userId,
        name: result.name,
        calories: result.calories,
        protein_g: result.protein_g,
        total_carbs_g: result.total_carbs_g,
        total_fat_g: result.total_fat_g,
        meal: selectedMeal,
        date: today,
        source: 'ai_estimate',
      });

      if (error) {
        if (__DEV__) console.error('Log AI meal failed:', error.message);
        Alert.alert('Error', 'Failed to log meal. Please try again.');
        setLogging(false);
        return;
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onLogged();
      onClose();
    } catch (e: any) {
      if (__DEV__) console.error('Log error:', e?.message);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setLogging(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <Box flex={1} backgroundColor="background">
          {/* Header */}
          <Box
            flexDirection="row"
            alignItems="center"
            justifyContent="space-between"
            paddingHorizontal="l"
            borderColor="border"
            style={{
              paddingTop: Platform.OS === 'ios' ? insets.top + 8 : 16,
              paddingBottom: 14,
              borderBottomWidth: 1,
            }}
          >
            <Box flex={1}>
              <Text
                variant="cardTitle"
                style={{ fontSize: 18, fontFamily: 'Outfit_600SemiBold' }}
              >
                Describe Your Meal
              </Text>
            </Box>
            <TouchableOpacity
              onPress={onClose}
              accessibilityLabel="Close"
              accessibilityRole="button"
              style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'center' }}
            >
              <Feather name="x" size={22} color="#6B6B6F" />
            </TouchableOpacity>
          </Box>

          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={0}
          >
            <ScrollView
              contentContainerStyle={{
                paddingHorizontal: 20,
                paddingTop: 24,
                paddingBottom: 40,
              }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Description input */}
              <Text variant="sectionHeader" style={{ marginBottom: 10 }}>
                WHAT DID YOU EAT?
              </Text>
              <TextInput
                style={{
                  backgroundColor: '#F5F5F7',
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  paddingTop: 14,
                  paddingBottom: 14,
                  fontSize: 15,
                  fontFamily: 'DMSans_400Regular',
                  color: '#1A1A1A',
                  minHeight: 90,
                  textAlignVertical: 'top',
                }}
                value={description}
                onChangeText={setDescription}
                placeholder="e.g. Chipotle burrito bowl with chicken, rice, beans, cheese, and guac"
                placeholderTextColor="#9A9A9E"
                multiline
                maxLength={500}
                editable={!estimating}
              />

              {/* Remaining estimates */}
              {remaining !== null && (
                <Box alignItems="flex-end" style={{ marginTop: 6 }}>
                  <Text
                    variant="dim"
                    style={{
                      color: remaining <= 3 ? '#E87722' : '#9A9A9E',
                    }}
                  >
                    {remaining} estimate{remaining !== 1 ? 's' : ''} remaining today
                  </Text>
                </Box>
              )}

              {/* Estimate button */}
              <TouchableOpacity
                onPress={handleEstimate}
                activeOpacity={0.7}
                disabled={!description.trim() || estimating}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'center',
                  alignItems: 'center',
                  backgroundColor: '#861F41',
                  paddingVertical: 14,
                  borderRadius: 14,
                  marginTop: 16,
                  opacity: !description.trim() || estimating ? 0.5 : 1,
                }}
              >
                {estimating ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Feather name="zap" size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
                    <Text
                      variant="body"
                      style={{ color: '#FFFFFF', fontFamily: 'DMSans_600SemiBold', fontSize: 16 }}
                    >
                      Estimate Nutrition
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Error state */}
              {errorMsg && !estimating && (
                <Box
                  alignItems="center"
                  style={{
                    marginTop: 20,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    backgroundColor: 'rgba(192,57,43,0.08)',
                    borderRadius: 12,
                  }}
                >
                  <Text
                    variant="muted"
                    style={{ color: '#C0392B', textAlign: 'center', lineHeight: 20 }}
                  >
                    {errorMsg}
                  </Text>
                  <TouchableOpacity
                    onPress={handleEstimate}
                    activeOpacity={0.7}
                    style={{ marginTop: 10 }}
                  >
                    <Text
                      variant="body"
                      style={{ color: '#861F41', fontFamily: 'DMSans_600SemiBold' }}
                    >
                      Try Again
                    </Text>
                  </TouchableOpacity>
                </Box>
              )}

              {/* Estimating shimmer */}
              {estimating && (
                <Box alignItems="center" style={{ marginTop: 32 }}>
                  <ActivityIndicator size="large" color="#861F41" />
                  <Text
                    variant="muted"
                    style={{ marginTop: 12, fontFamily: 'DMSans_500Medium' }}
                  >
                    Estimating nutrition...
                  </Text>
                </Box>
              )}

              {/* Result card */}
              {result && !estimating && (
                <Box
                  style={{
                    marginTop: 24,
                    backgroundColor: '#FFFFFF',
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: '#E8E8EA',
                    padding: 20,
                  }}
                >
                  {/* Name + Edit toggle */}
                  <Box flexDirection="row" alignItems="center" justifyContent="space-between">
                    {editing ? (
                      <TextInput
                        style={{
                          flex: 1,
                          fontSize: 18,
                          fontFamily: 'Outfit_600SemiBold',
                          color: '#1A1A1A',
                          borderBottomWidth: 1,
                          borderBottomColor: '#E8E8EA',
                          paddingBottom: 4,
                          marginRight: 12,
                        }}
                        value={editName}
                        onChangeText={setEditName}
                        maxLength={100}
                      />
                    ) : (
                      <Text
                        variant="cardTitle"
                        style={{ fontSize: 18, fontFamily: 'Outfit_600SemiBold', flex: 1 }}
                        numberOfLines={2}
                      >
                        {result.name}
                      </Text>
                    )}
                    <TouchableOpacity
                      onPress={editing ? saveEdits : startEditing}
                      activeOpacity={0.7}
                    >
                      <Text
                        variant="body"
                        style={{
                          color: '#861F41',
                          fontFamily: 'DMSans_600SemiBold',
                          fontSize: 14,
                        }}
                      >
                        {editing ? 'Done' : 'Edit'}
                      </Text>
                    </TouchableOpacity>
                  </Box>

                  <Text variant="dim" style={{ marginTop: 4 }}>
                    AI Estimated
                  </Text>

                  {/* Nutrition grid */}
                  <Box
                    flexDirection="row"
                    justifyContent="space-between"
                    style={{ marginTop: 20, gap: 8 }}
                  >
                    {editing ? (
                      <>
                        <EditableNutritionPill label="Calories" value={editCal} unit="kcal" color="#861F41" onChangeText={setEditCal} />
                        <EditableNutritionPill label="Protein" value={editPro} unit="g" color="#4A7FC5" onChangeText={setEditPro} />
                        <EditableNutritionPill label="Carbs" value={editCarb} unit="g" color="#E87722" onChangeText={setEditCarb} />
                        <EditableNutritionPill label="Fat" value={editFat} unit="g" color="#D4A024" onChangeText={setEditFat} />
                      </>
                    ) : (
                      <>
                        <NutritionPill label="Calories" value={`${result.calories}`} unit="kcal" color="#861F41" />
                        <NutritionPill label="Protein" value={`${result.protein_g}`} unit="g" color="#4A7FC5" />
                        <NutritionPill label="Carbs" value={`${result.total_carbs_g}`} unit="g" color="#E87722" />
                        <NutritionPill label="Fat" value={`${result.total_fat_g}`} unit="g" color="#D4A024" />
                      </>
                    )}
                  </Box>

                  {/* Meal period picker */}
                  <Box style={{ marginTop: 20 }}>
                    <Text variant="sectionHeader" style={{ marginBottom: 10 }}>
                      MEAL PERIOD
                    </Text>
                    <Box flexDirection="row" style={{ gap: 8 }}>
                      {MEAL_PERIODS.map((meal) => (
                        <Pressable
                          key={meal}
                          onPress={() => setSelectedMeal(meal)}
                          style={{
                            flex: 1,
                            paddingVertical: 8,
                            borderRadius: 20,
                            backgroundColor: selectedMeal === meal ? '#861F41' : '#F5F5F7',
                            alignItems: 'center',
                          }}
                        >
                          <Text
                            variant="bodySmall"
                            style={{
                              fontFamily: 'DMSans_500Medium',
                              fontSize: 13,
                              color: selectedMeal === meal ? '#FFFFFF' : '#6B6B6F',
                            }}
                          >
                            {meal}
                          </Text>
                        </Pressable>
                      ))}
                    </Box>
                  </Box>

                  {/* Log button */}
                  <TouchableOpacity
                    onPress={handleLogMeal}
                    activeOpacity={0.7}
                    disabled={logging || editing}
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'center',
                      alignItems: 'center',
                      backgroundColor: '#861F41',
                      paddingVertical: 14,
                      borderRadius: 14,
                      marginTop: 24,
                      opacity: logging || editing ? 0.6 : 1,
                    }}
                  >
                    {logging ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Feather name="check" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                        <Text
                          variant="body"
                          style={{ color: '#FFFFFF', fontFamily: 'DMSans_600SemiBold', fontSize: 16 }}
                        >
                          Log Meal
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>

                  {/* Re-estimate link */}
                  <TouchableOpacity
                    onPress={() => {
                      setResult(null);
                      setEditing(false);
                      setErrorMsg(null);
                    }}
                    activeOpacity={0.7}
                    style={{ alignItems: 'center', marginTop: 12 }}
                  >
                    <Text
                      variant="body"
                      style={{ color: '#6B6B6F', fontFamily: 'DMSans_500Medium', fontSize: 14 }}
                    >
                      Start Over
                    </Text>
                  </TouchableOpacity>
                </Box>
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        </Box>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

// ── NutritionPill (read-only) ──────────────────────────────────────────────

function NutritionPill({
  label,
  value,
  unit,
  color,
}: {
  label: string;
  value: string;
  unit: string;
  color: string;
}) {
  return (
    <Box
      flex={1}
      alignItems="center"
      style={{
        paddingVertical: 12,
        paddingHorizontal: 4,
        backgroundColor: `${color}10`,
        borderRadius: 10,
      }}
    >
      <Text
        variant="body"
        style={{ fontSize: 18, fontFamily: 'DMSans_700Bold', color }}
      >
        {value}
      </Text>
      <Text variant="dim" style={{ marginTop: 2, color: '#6B6B6F' }}>
        {unit}
      </Text>
      <Text variant="dim" style={{ marginTop: 1, fontSize: 10, color: '#9A9A9E' }}>
        {label}
      </Text>
    </Box>
  );
}

// ── EditableNutritionPill ──────────────────────────────────────────────────

function EditableNutritionPill({
  label,
  value,
  unit,
  color,
  onChangeText,
}: {
  label: string;
  value: string;
  unit: string;
  color: string;
  onChangeText: (text: string) => void;
}) {
  return (
    <Box
      flex={1}
      alignItems="center"
      style={{
        paddingVertical: 8,
        paddingHorizontal: 4,
        backgroundColor: `${color}10`,
        borderRadius: 10,
      }}
    >
      <TextInput
        style={{
          fontSize: 18,
          fontFamily: 'DMSans_700Bold',
          color,
          textAlign: 'center',
          minWidth: 40,
          paddingVertical: 2,
          borderBottomWidth: 1,
          borderBottomColor: `${color}40`,
        }}
        value={value}
        onChangeText={onChangeText}
        keyboardType="numeric"
        maxLength={5}
      />
      <Text variant="dim" style={{ marginTop: 2, color: '#6B6B6F' }}>
        {unit}
      </Text>
      <Text variant="dim" style={{ marginTop: 1, fontSize: 10, color: '#9A9A9E' }}>
        {label}
      </Text>
    </Box>
  );
}
