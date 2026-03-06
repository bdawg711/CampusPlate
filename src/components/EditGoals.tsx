import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Box, Text } from '@/src/theme/restyleTheme';
import { useTheme } from '@/src/context/ThemeContext';
import type { Goals } from '@/src/utils/goals';
import { recalculateGoals } from '@/src/utils/goals';
import { requireUserId } from '@/src/utils/auth';
import { supabase } from '@/src/utils/supabase';

// Approved accent rgba backgrounds for macro chips
const CHIP_BG_PROTEIN = 'rgba(74,127,197,0.12)';
const CHIP_BG_CARBS   = 'rgba(197,165,90,0.12)';
const CHIP_BG_FAT     = 'rgba(168,169,173,0.12)';

interface EditGoalsProps {
  visible: boolean;
  currentGoals: Goals;
  onSave: (goals: Goals) => Promise<void>;
  onRecalculate?: () => Promise<Goals>;
  onClose: () => void;
}

export default function EditGoals({
  visible,
  currentGoals,
  onSave,
  onClose,
}: EditGoalsProps) {
  const { colors } = useTheme();

  const [mode, setMode] = useState<'custom' | 'calculated'>('custom');
  const [calories, setCalories] = useState(String(currentGoals.goalCalories));
  const [protein, setProtein] = useState(String(currentGoals.goalProtein));
  const [carbs, setCarbs] = useState(String(currentGoals.goalCarbs));
  const [fat, setFat] = useState(String(currentGoals.goalFat));
  const [saving, setSaving] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [preview, setPreview] = useState<Goals | null>(null);

  useEffect(() => {
    if (visible) {
      setCalories(String(currentGoals.goalCalories));
      setProtein(String(currentGoals.goalProtein));
      setCarbs(String(currentGoals.goalCarbs));
      setFat(String(currentGoals.goalFat));
      setMode('custom');
      setSaving(false);
      setRecalculating(false);
      setPreview(null);
    }
  }, [visible, currentGoals]);

  const isEditable = mode === 'custom';

  const getInputStyle = (accent: string) => ({
    flex: 1,
    borderRadius: 6,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 20,
    textAlign: 'center' as const,
    fontFamily: 'Outfit_700Bold',
    backgroundColor: isEditable ? colors.inputBg : colors.cardAlt,
    borderColor: isEditable ? accent : colors.border,
    color: isEditable ? colors.text : colors.textMuted,
  });

  const handleSave = async () => {
    const cal = parseInt(calories, 10);
    const pro = parseInt(protein, 10);
    const crb = parseInt(carbs, 10);
    const ft  = parseInt(fat, 10);
    if (isNaN(cal) || isNaN(pro) || isNaN(crb) || isNaN(ft)) return;
    if (cal < 1 || pro < 1 || crb < 1 || ft < 1) return;

    setSaving(true);
    try {
      await onSave({ goalCalories: cal, goalProtein: pro, goalCarbs: crb, goalFat: ft });
    } finally {
      setSaving(false);
    }
  };

  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      const userId = await requireUserId();
      const { data } = await supabase
        .from('profiles')
        .select('weight, height, age, is_male, activity_level, goal')
        .eq('id', userId)
        .single();
      const newGoals = recalculateGoals(
        data?.weight ?? 150,
        data?.height ?? 170,
        data?.age ?? 20,
        data?.is_male ?? true,
        data?.activity_level ?? 'light',
        data?.goal ?? 'maintain',
      );
      setPreview(newGoals);
    } catch {
      // silently ignore
    } finally {
      setRecalculating(false);
    }
  };

  const handleApplyPreview = async () => {
    if (!preview) return;
    setSaving(true);
    try {
      const userId = await requireUserId();
      await supabase.from('profiles').update({
        goal_calories: preview.goalCalories,
        goal_protein_g: preview.goalProtein,
        goal_carbs_g: preview.goalCarbs,
        goal_fat_g: preview.goalFat,
      }).eq('id', userId);
      await onSave(preview);
      setPreview(null);
    } catch {
      // silently ignore
    } finally {
      setSaving(false);
    }
  };

  const pCal = (parseInt(calories, 10) > 0 ? (parseInt(protein, 10) || 0) * 4 : 0);
  const cCal = (parseInt(calories, 10) > 0 ? (parseInt(carbs, 10) || 0) * 4 : 0);
  const fCal = (parseInt(calories, 10) > 0 ? (parseInt(fat, 10) || 0) * 9 : 0);
  const totalMacroCal = pCal + cCal + fCal;

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
          <View style={{ width: 36, height: 4, borderRadius: 9999, backgroundColor: colors.textDim }} />
        </View>

        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <TouchableOpacity onPress={onClose} style={{ width: 64 }} activeOpacity={0.6}>
            <Text style={{ fontSize: 15, color: colors.textDim, fontFamily: 'DMSans_500Medium' }}>Cancel</Text>
          </TouchableOpacity>
          <Text style={{ flex: 1, textAlign: 'center', fontSize: 17, color: colors.text, fontFamily: 'Outfit_700Bold' }}>
            Nutrition Goals
          </Text>
          <View style={{ width: 64 }} />
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView
            contentContainerStyle={{ padding: 20, paddingBottom: 48 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Mode toggle */}
            <View style={{ flexDirection: 'row', borderRadius: 6, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.cardAlt, padding: 4, marginBottom: 16 }}>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 9, borderRadius: 6, alignItems: 'center', backgroundColor: mode === 'custom' ? '#861F41' : 'transparent' }}
                onPress={() => setMode('custom')}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 14, color: mode === 'custom' ? '#FFFFFF' : colors.textMuted, fontFamily: 'DMSans_600SemiBold' }}>
                  Custom
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 9, borderRadius: 6, alignItems: 'center', backgroundColor: mode === 'calculated' ? '#861F41' : 'transparent' }}
                onPress={() => setMode('calculated')}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 14, color: mode === 'calculated' ? '#FFFFFF' : colors.textMuted, fontFamily: 'DMSans_600SemiBold' }}>
                  Calculated
                </Text>
              </TouchableOpacity>
            </View>

            {mode === 'calculated' && (
              <Text style={{ fontSize: 12, lineHeight: 18, marginTop: -8, marginBottom: 16, color: colors.textMuted, fontFamily: 'DMSans_400Regular' }}>
                Goals are computed from your body stats and fitness goal. Tap "Recalculate" below to refresh, then Save.
              </Text>
            )}

            {/* Goal fields */}
            <View style={{ borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, overflow: 'hidden', marginBottom: 12 }}>
              {/* Calories */}
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 10 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#861F41' }} />
                <Text style={{ width: 72, fontSize: 14, color: colors.text, fontFamily: 'DMSans_500Medium' }}>Calories</Text>
                <TextInput
                  style={getInputStyle('#861F41')}
                  value={calories}
                  onChangeText={setCalories}
                  keyboardType="number-pad"
                  returnKeyType="done"
                  editable={isEditable}
                  maxLength={5}
                  selectTextOnFocus
                />
                <Text style={{ width: 36, fontSize: 13, textAlign: 'right', color: colors.textMuted, fontFamily: 'DMSans_400Regular' }}>kcal</Text>
              </View>

              <View style={{ height: 1, marginLeft: 38, backgroundColor: colors.borderLight }} />

              {/* Protein */}
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 10 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#4A7FC5' }} />
                <Text style={{ width: 72, fontSize: 14, color: colors.text, fontFamily: 'DMSans_500Medium' }}>Protein</Text>
                <TextInput
                  style={getInputStyle('#4A7FC5')}
                  value={protein}
                  onChangeText={setProtein}
                  keyboardType="number-pad"
                  returnKeyType="done"
                  editable={isEditable}
                  maxLength={4}
                  selectTextOnFocus
                />
                <Text style={{ width: 36, fontSize: 13, textAlign: 'right', color: colors.textMuted, fontFamily: 'DMSans_400Regular' }}>g</Text>
              </View>

              <View style={{ height: 1, marginLeft: 38, backgroundColor: colors.borderLight }} />

              {/* Carbs */}
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 10 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#C5A55A' }} />
                <Text style={{ width: 72, fontSize: 14, color: colors.text, fontFamily: 'DMSans_500Medium' }}>Carbs</Text>
                <TextInput
                  style={getInputStyle('#C5A55A')}
                  value={carbs}
                  onChangeText={setCarbs}
                  keyboardType="number-pad"
                  returnKeyType="done"
                  editable={isEditable}
                  maxLength={4}
                  selectTextOnFocus
                />
                <Text style={{ width: 36, fontSize: 13, textAlign: 'right', color: colors.textMuted, fontFamily: 'DMSans_400Regular' }}>g</Text>
              </View>

              <View style={{ height: 1, marginLeft: 38, backgroundColor: colors.borderLight }} />

              {/* Fat */}
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 10 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#A8A9AD' }} />
                <Text style={{ width: 72, fontSize: 14, color: colors.text, fontFamily: 'DMSans_500Medium' }}>Fat</Text>
                <TextInput
                  style={getInputStyle('#A8A9AD')}
                  value={fat}
                  onChangeText={setFat}
                  keyboardType="number-pad"
                  returnKeyType="done"
                  editable={isEditable}
                  maxLength={4}
                  selectTextOnFocus
                />
                <Text style={{ width: 36, fontSize: 13, textAlign: 'right', color: colors.textMuted, fontFamily: 'DMSans_400Regular' }}>g</Text>
              </View>
            </View>

            {/* Macro calorie breakdown chips */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 24 }}>
              <View style={{ flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', backgroundColor: CHIP_BG_PROTEIN }}>
                <Text style={{ fontSize: 13, color: '#4A7FC5', fontFamily: 'Outfit_700Bold' }}>{pCal}</Text>
                <Text style={{ fontSize: 10, marginTop: 2, opacity: 0.8, color: '#4A7FC5', fontFamily: 'DMSans_400Regular' }}>P kcal</Text>
              </View>
              <View style={{ flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', backgroundColor: CHIP_BG_CARBS }}>
                <Text style={{ fontSize: 13, color: '#C5A55A', fontFamily: 'Outfit_700Bold' }}>{cCal}</Text>
                <Text style={{ fontSize: 10, marginTop: 2, opacity: 0.8, color: '#C5A55A', fontFamily: 'DMSans_400Regular' }}>C kcal</Text>
              </View>
              <View style={{ flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', backgroundColor: CHIP_BG_FAT }}>
                <Text style={{ fontSize: 13, color: '#A8A9AD', fontFamily: 'Outfit_700Bold' }}>{fCal}</Text>
                <Text style={{ fontSize: 10, marginTop: 2, opacity: 0.8, color: '#A8A9AD', fontFamily: 'DMSans_400Regular' }}>F kcal</Text>
              </View>
              <View style={{ flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', backgroundColor: colors.cardAlt }}>
                <Text style={{ fontSize: 13, color: colors.textMuted, fontFamily: 'Outfit_700Bold' }}>{totalMacroCal}</Text>
                <Text style={{ fontSize: 10, marginTop: 2, opacity: 0.8, color: colors.textMuted, fontFamily: 'DMSans_400Regular' }}>total</Text>
              </View>
            </View>

            {/* Save button — maroon accent */}
            <TouchableOpacity
              style={{ borderRadius: 6, paddingVertical: 16, alignItems: 'center', marginBottom: 12, backgroundColor: '#861F41', opacity: saving ? 0.6 : 1 }}
              onPress={handleSave}
              disabled={saving || recalculating}
              activeOpacity={0.85}
            >
              {saving
                ? <ActivityIndicator color="#FFFFFF" />
                : <Text style={{ color: '#FFFFFF', fontSize: 16, fontFamily: 'DMSans_700Bold' }}>Save Goals</Text>
              }
            </TouchableOpacity>

            {/* Recalculate Goals button */}
            <TouchableOpacity
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                paddingVertical: 14,
                borderRadius: 6,
                borderWidth: 1,
                borderColor: '#861F41',
                backgroundColor: 'transparent',
                opacity: recalculating ? 0.6 : 1,
              }}
              onPress={handleRecalculate}
              disabled={recalculating || saving}
              activeOpacity={0.7}
            >
              {recalculating ? (
                <ActivityIndicator size="small" color="#861F41" />
              ) : (
                <>
                  <Feather name="refresh-cw" size={16} color="#861F41" />
                  <Text style={{ fontSize: 14, color: '#861F41', fontFamily: 'DMSans_600SemiBold' }}>Recalculate Goals</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Preview card */}
            {preview && (
              <View style={{ marginTop: 16, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, padding: 16 }}>
                <Text style={{ fontSize: 13, color: colors.textMuted, fontFamily: 'DMSans_500Medium', marginBottom: 12 }}>
                  Based on your current stats:
                </Text>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 }}>
                  <View style={{ alignItems: 'center', flex: 1 }}>
                    <Text style={{ fontSize: 20, color: '#861F41', fontFamily: 'Outfit_700Bold' }}>{preview.goalCalories}</Text>
                    <Text style={{ fontSize: 11, color: colors.textMuted, fontFamily: 'DMSans_400Regular', marginTop: 2 }}>Calories</Text>
                  </View>
                  <View style={{ alignItems: 'center', flex: 1 }}>
                    <Text style={{ fontSize: 20, color: '#4A7FC5', fontFamily: 'Outfit_700Bold' }}>{preview.goalProtein}g</Text>
                    <Text style={{ fontSize: 11, color: colors.textMuted, fontFamily: 'DMSans_400Regular', marginTop: 2 }}>Protein</Text>
                  </View>
                  <View style={{ alignItems: 'center', flex: 1 }}>
                    <Text style={{ fontSize: 20, color: '#C5A55A', fontFamily: 'Outfit_700Bold' }}>{preview.goalCarbs}g</Text>
                    <Text style={{ fontSize: 11, color: colors.textMuted, fontFamily: 'DMSans_400Regular', marginTop: 2 }}>Carbs</Text>
                  </View>
                  <View style={{ alignItems: 'center', flex: 1 }}>
                    <Text style={{ fontSize: 20, color: '#A8A9AD', fontFamily: 'Outfit_700Bold' }}>{preview.goalFat}g</Text>
                    <Text style={{ fontSize: 11, color: colors.textMuted, fontFamily: 'DMSans_400Regular', marginTop: 2 }}>Fat</Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity
                    style={{ flex: 1, paddingVertical: 12, borderRadius: 6, alignItems: 'center', backgroundColor: '#861F41', opacity: saving ? 0.6 : 1 }}
                    onPress={handleApplyPreview}
                    disabled={saving}
                    activeOpacity={0.85}
                  >
                    {saving
                      ? <ActivityIndicator color="#FFFFFF" size="small" />
                      : <Text style={{ color: '#FFFFFF', fontSize: 14, fontFamily: 'DMSans_700Bold' }}>Apply</Text>
                    }
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ flex: 1, paddingVertical: 12, borderRadius: 6, alignItems: 'center', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.cardAlt }}
                    onPress={() => setPreview(null)}
                    disabled={saving}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 14, color: colors.textMuted, fontFamily: 'DMSans_600SemiBold' }}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
