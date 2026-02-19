import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';
import type { Goals } from '@/src/utils/goals';

// Approved accent rgba backgrounds for macro chips
const CHIP_BG_PROTEIN = 'rgba(91,127,255,0.12)';
const CHIP_BG_CARBS   = 'rgba(232,119,34,0.12)';
const CHIP_BG_FAT     = 'rgba(255,214,10,0.12)';

interface EditGoalsProps {
  visible: boolean;
  currentGoals: Goals;
  onSave: (goals: Goals) => Promise<void>;
  onRecalculate: () => Promise<Goals>;
  onClose: () => void;
}

export default function EditGoals({
  visible,
  currentGoals,
  onSave,
  onRecalculate,
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

  // Sync inputs whenever the modal opens with fresh goal data
  useEffect(() => {
    if (visible) {
      setCalories(String(currentGoals.goalCalories));
      setProtein(String(currentGoals.goalProtein));
      setCarbs(String(currentGoals.goalCarbs));
      setFat(String(currentGoals.goalFat));
      setMode('custom');
      setSaving(false);
      setRecalculating(false);
    }
  }, [visible, currentGoals]);

  const isEditable = mode === 'custom';

  // Returns style array for each TextInput — called during render, does NOT create new components
  const getInputStyle = (accent: string) => [
    st.fieldInput,
    {
      backgroundColor: isEditable ? colors.inputBg : colors.cardAlt,
      borderColor: isEditable ? accent : colors.border,
      color: isEditable ? colors.text : colors.textMuted,
    },
  ];

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
      const newGoals = await onRecalculate();
      setCalories(String(newGoals.goalCalories));
      setProtein(String(newGoals.goalProtein));
      setCarbs(String(newGoals.goalCarbs));
      setFat(String(newGoals.goalFat));
    } catch {
      // parent already logs; swallow here
    } finally {
      setRecalculating(false);
    }
  };

  // Macro calorie breakdown — derived, no extra state needed
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
      <View style={[st.container, { backgroundColor: colors.background }]}>

        {/* ── Header ── */}
        <View style={[st.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} style={st.headerSide} activeOpacity={0.6}>
            <Text style={[st.cancelText, { color: colors.textMuted, fontFamily: 'DMSans_500Medium' }]}>
              Cancel
            </Text>
          </TouchableOpacity>
          <Text style={[st.headerTitle, { color: colors.text, fontFamily: 'Outfit_700Bold' }]}>
            Nutrition Goals
          </Text>
          {/* Spacer keeps title centred */}
          <View style={st.headerSide} />
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            contentContainerStyle={st.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >

            {/* ── Mode toggle: Custom | Calculated ── */}
            <View style={[st.toggleWrap, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}>
              <TouchableOpacity
                style={[st.toggleBtn, mode === 'custom' && { backgroundColor: colors.maroon }]}
                onPress={() => setMode('custom')}
                activeOpacity={0.7}
              >
                <Text style={[
                  st.toggleText,
                  { color: mode === 'custom' ? '#fff' : colors.textMuted, fontFamily: 'DMSans_600SemiBold' },
                ]}>
                  Custom
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[st.toggleBtn, mode === 'calculated' && { backgroundColor: colors.maroon }]}
                onPress={() => setMode('calculated')}
                activeOpacity={0.7}
              >
                <Text style={[
                  st.toggleText,
                  { color: mode === 'calculated' ? '#fff' : colors.textMuted, fontFamily: 'DMSans_600SemiBold' },
                ]}>
                  Calculated
                </Text>
              </TouchableOpacity>
            </View>

            {mode === 'calculated' && (
              <Text style={[st.hintText, { color: colors.textMuted, fontFamily: 'DMSans_400Regular' }]}>
                Goals are computed from your body stats and fitness goal. Tap "Recalculate" below to refresh, then Save.
              </Text>
            )}

            {/* ── Goal fields — each TextInput defined explicitly, NOT in .map() ── */}
            <View style={[st.card, { backgroundColor: colors.card, borderColor: colors.border }]}>

              {/* Calories */}
              <View style={st.fieldRow}>
                <View style={[st.dot, { backgroundColor: colors.maroon }]} />
                <Text style={[st.fieldLabel, { color: colors.text, fontFamily: 'DMSans_500Medium' }]}>
                  Calories
                </Text>
                <TextInput
                  style={getInputStyle(colors.maroon)}
                  value={calories}
                  onChangeText={setCalories}
                  keyboardType="number-pad"
                  returnKeyType="done"
                  editable={isEditable}
                  maxLength={5}
                  selectTextOnFocus
                />
                <Text style={[st.unit, { color: colors.textMuted, fontFamily: 'DMSans_400Regular' }]}>
                  kcal
                </Text>
              </View>

              <View style={[st.sep, { backgroundColor: colors.border }]} />

              {/* Protein */}
              <View style={st.fieldRow}>
                <View style={[st.dot, { backgroundColor: colors.blue }]} />
                <Text style={[st.fieldLabel, { color: colors.text, fontFamily: 'DMSans_500Medium' }]}>
                  Protein
                </Text>
                <TextInput
                  style={getInputStyle(colors.blue)}
                  value={protein}
                  onChangeText={setProtein}
                  keyboardType="number-pad"
                  returnKeyType="done"
                  editable={isEditable}
                  maxLength={4}
                  selectTextOnFocus
                />
                <Text style={[st.unit, { color: colors.textMuted, fontFamily: 'DMSans_400Regular' }]}>
                  g
                </Text>
              </View>

              <View style={[st.sep, { backgroundColor: colors.border }]} />

              {/* Carbs */}
              <View style={st.fieldRow}>
                <View style={[st.dot, { backgroundColor: colors.orange }]} />
                <Text style={[st.fieldLabel, { color: colors.text, fontFamily: 'DMSans_500Medium' }]}>
                  Carbs
                </Text>
                <TextInput
                  style={getInputStyle(colors.orange)}
                  value={carbs}
                  onChangeText={setCarbs}
                  keyboardType="number-pad"
                  returnKeyType="done"
                  editable={isEditable}
                  maxLength={4}
                  selectTextOnFocus
                />
                <Text style={[st.unit, { color: colors.textMuted, fontFamily: 'DMSans_400Regular' }]}>
                  g
                </Text>
              </View>

              <View style={[st.sep, { backgroundColor: colors.border }]} />

              {/* Fat */}
              <View style={st.fieldRow}>
                <View style={[st.dot, { backgroundColor: colors.yellow }]} />
                <Text style={[st.fieldLabel, { color: colors.text, fontFamily: 'DMSans_500Medium' }]}>
                  Fat
                </Text>
                <TextInput
                  style={getInputStyle(colors.yellow)}
                  value={fat}
                  onChangeText={setFat}
                  keyboardType="number-pad"
                  returnKeyType="done"
                  editable={isEditable}
                  maxLength={4}
                  selectTextOnFocus
                />
                <Text style={[st.unit, { color: colors.textMuted, fontFamily: 'DMSans_400Regular' }]}>
                  g
                </Text>
              </View>

            </View>

            {/* ── Macro calorie breakdown chips ── */}
            <View style={st.macroRow}>
              <View style={[st.macroChip, { backgroundColor: CHIP_BG_PROTEIN }]}>
                <Text style={[st.macroChipVal, { color: colors.blue, fontFamily: 'Outfit_700Bold' }]}>
                  {pCal}
                </Text>
                <Text style={[st.macroChipLabel, { color: colors.blue, fontFamily: 'DMSans_400Regular' }]}>
                  P kcal
                </Text>
              </View>
              <View style={[st.macroChip, { backgroundColor: CHIP_BG_CARBS }]}>
                <Text style={[st.macroChipVal, { color: colors.orange, fontFamily: 'Outfit_700Bold' }]}>
                  {cCal}
                </Text>
                <Text style={[st.macroChipLabel, { color: colors.orange, fontFamily: 'DMSans_400Regular' }]}>
                  C kcal
                </Text>
              </View>
              <View style={[st.macroChip, { backgroundColor: CHIP_BG_FAT }]}>
                <Text style={[st.macroChipVal, { color: colors.yellow, fontFamily: 'Outfit_700Bold' }]}>
                  {fCal}
                </Text>
                <Text style={[st.macroChipLabel, { color: colors.yellow, fontFamily: 'DMSans_400Regular' }]}>
                  F kcal
                </Text>
              </View>
              <View style={[st.macroChip, { backgroundColor: colors.cardAlt }]}>
                <Text style={[st.macroChipVal, { color: colors.textMuted, fontFamily: 'Outfit_700Bold' }]}>
                  {totalMacroCal}
                </Text>
                <Text style={[st.macroChipLabel, { color: colors.textMuted, fontFamily: 'DMSans_400Regular' }]}>
                  total
                </Text>
              </View>
            </View>

            {/* ── Save button ── */}
            <TouchableOpacity
              style={[st.saveBtn, { backgroundColor: colors.maroon, opacity: saving ? 0.6 : 1 }]}
              onPress={handleSave}
              disabled={saving || recalculating}
              activeOpacity={0.85}
            >
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={[st.saveBtnText, { fontFamily: 'DMSans_700Bold' }]}>Save Goals</Text>
              }
            </TouchableOpacity>

            {/* ── Recalculate from Profile (subtle) ── */}
            <TouchableOpacity
              style={st.recalcBtn}
              onPress={handleRecalculate}
              disabled={recalculating || saving}
              activeOpacity={0.7}
            >
              {recalculating
                ? <ActivityIndicator size="small" color={colors.textMuted} />
                : (
                  <Text style={[st.recalcText, { color: colors.textMuted, fontFamily: 'DMSans_500Medium' }]}>
                    ↺  Recalculate from Profile
                  </Text>
                )
              }
            </TouchableOpacity>

          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerSide: { width: 64 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17 },
  cancelText: { fontSize: 15 },

  // Content
  content: { padding: 20, paddingBottom: 48 },

  // Toggle
  toggleWrap: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 4,
    marginBottom: 16,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 9,
    alignItems: 'center',
  },
  toggleText: { fontSize: 14 },

  hintText: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: -8,
    marginBottom: 16,
  },

  // Fields card
  card: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 12,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  fieldLabel: { width: 64, fontSize: 15 },
  fieldInput: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 20,
    textAlign: 'center',
    fontFamily: 'Outfit_700Bold',
  },
  unit: { width: 36, fontSize: 13, textAlign: 'right' },
  sep: { height: 1, marginLeft: 38 },

  // Macro chips
  macroRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  macroChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  macroChipVal: { fontSize: 13 },
  macroChipLabel: { fontSize: 10, marginTop: 2, opacity: 0.8 },

  // Buttons
  saveBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  saveBtnText: { color: '#fff', fontSize: 16 },
  recalcBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  recalcText: { fontSize: 14 },
});
