import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { requireUserId } from '@/src/utils/auth';
import { supabase } from '@/src/utils/supabase';
import { recalculateGoals } from '@/src/utils/goals';
import type { ActivityLevel, GoalType } from '@/src/utils/nutrition';

export interface EditProfileProps {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const YEAR_OPTIONS = ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate'];

const ACTIVITY_OPTIONS: { key: ActivityLevel; label: string }[] = [
  { key: 'sedentary', label: 'Sedentary' },
  { key: 'light', label: 'Light' },
  { key: 'moderate', label: 'Moderate' },
  { key: 'active', label: 'Active' },
];

const GOAL_OPTIONS: { key: GoalType; label: string }[] = [
  { key: 'aggressive_cut', label: 'Aggressive Cut' },
  { key: 'moderate_cut', label: 'Moderate Cut' },
  { key: 'maintain', label: 'Maintain' },
  { key: 'lean_bulk', label: 'Lean Bulk' },
  { key: 'aggressive_bulk', label: 'Aggressive Bulk' },
];

interface DiningHall {
  id: number;
  name: string;
}

// ── Sub-components defined outside to prevent TextInput remount on re-render ──

function SectionHeader({ title }: { title: string }) {
  const { colors } = useTheme();
  return (
    <Text style={[st.sectionHeader, { color: colors.textMuted, fontFamily: 'DMSans_600SemiBold' }]}>
      {title}
    </Text>
  );
}

function PillRow({ options, selected, onSelect }: {
  options: string[];
  selected: string;
  onSelect: (v: string) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={st.pillRow}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt}
          style={[st.pill, {
            backgroundColor: selected === opt ? colors.maroon : colors.cardAlt,
            borderColor: selected === opt ? colors.maroon : colors.border,
          }]}
          onPress={() => onSelect(opt)}
          activeOpacity={0.7}
        >
          <Text style={[st.pillText, {
            color: selected === opt ? '#fff' : colors.textMuted,
            fontFamily: 'DMSans_600SemiBold',
          }]}>
            {opt}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function EditProfile({ visible, onClose, onSaved }: EditProfileProps) {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [diningHalls, setDiningHalls] = useState<DiningHall[]>([]);

  // Personal Info
  const [name, setName] = useState('');
  const [year, setYear] = useState('');
  const [dorm, setDorm] = useState('');

  // Body Stats
  const [weightLbs, setWeightLbs] = useState('');
  const [heightFt, setHeightFt] = useState('');
  const [heightIn, setHeightIn] = useState('');
  const [age, setAge] = useState('');
  const [isMale, setIsMale] = useState(true);

  // Preferences
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('light');
  const [goal, setGoal] = useState<GoalType>('maintain');
  const [homeHallId, setHomeHallId] = useState<number | null>(null);

  useEffect(() => {
    if (visible) {
      loadProfile();
    }
  }, [visible]);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const userId = await requireUserId();
      const [{ data: profile }, { data: halls }] = await Promise.all([
        supabase
          .from('profiles')
          .select('name, year, dorm, weight, height, age, is_male, activity_level, goal, home_hall_id')
          .eq('id', userId)
          .single(),
        supabase.from('dining_halls').select('id, name').order('name'),
      ]);

      if (profile) {
        setName(profile.name || '');
        setYear(profile.year || '');
        setDorm(profile.dorm || '');
        setWeightLbs(profile.weight ? String(Math.round(profile.weight)) : '');
        if (profile.height) {
          const totalInches = profile.height / 2.54;
          setHeightFt(String(Math.floor(totalInches / 12)));
          setHeightIn(String(Math.round(totalInches % 12)));
        } else {
          setHeightFt('');
          setHeightIn('');
        }
        setAge(profile.age ? String(profile.age) : '');
        setIsMale(profile.is_male ?? true);
        setActivityLevel((profile.activity_level as ActivityLevel) || 'light');
        setGoal((profile.goal as GoalType) || 'maintain');
        setHomeHallId(profile.home_hall_id ?? null);
      }
      setDiningHalls(halls || []);
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const userId = await requireUserId();
      const ft = parseInt(heightFt) || 0;
      const inc = parseInt(heightIn) || 0;
      const heightCm = Math.round((ft * 12 + inc) * 2.54);

      const { error } = await supabase.from('profiles').update({
        name: name.trim() || 'Student',
        year,
        dorm: dorm.trim(),
        weight: parseFloat(weightLbs) || 0,
        height: heightCm,
        age: parseInt(age) || 0,
        is_male: isMale,
        activity_level: activityLevel,
        goal,
        home_hall_id: homeHallId,
      }).eq('id', userId);
      if (error) { console.error('Save profile failed:', error.message); Alert.alert('Error', 'Failed to save profile. Please try again.'); return; }

      Alert.alert(
        'Profile Saved',
        'Recalculate your nutrition goals based on your updated body stats?',
        [
          {
            text: 'No thanks',
            style: 'cancel',
            onPress: () => { onSaved(); onClose(); },
          },
          {
            text: 'Recalculate',
            onPress: async () => {
              try {
                await recalculateGoals(userId);
              } catch { /* ignore */ }
              onSaved();
              onClose();
            },
          },
        ],
      );
    } catch {
      Alert.alert('Error', 'Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const activityLabel = ACTIVITY_OPTIONS.find(o => o.key === activityLevel)?.label || '';
  const goalLabel = GOAL_OPTIONS.find(o => o.key === goal)?.label || '';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[st.container, { backgroundColor: colors.background }]}>

        {/* Header */}
        <View style={[st.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} style={st.headerSide} activeOpacity={0.6}>
            <Text style={[{ fontSize: 15, color: colors.textMuted, fontFamily: 'DMSans_500Medium' }]}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[st.headerTitle, { color: colors.text, fontFamily: 'Outfit_700Bold' }]}>My Profile</Text>
          <View style={st.headerSide} />
        </View>

        {loading ? (
          <View style={st.loadingWrap}>
            <ActivityIndicator size="large" color={colors.maroon} />
          </View>
        ) : (
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <ScrollView
              contentContainerStyle={st.content}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >

              {/* ── Personal Info ── */}
              <SectionHeader title="PERSONAL INFO" />
              <View style={[st.card, { backgroundColor: colors.card, borderColor: colors.border }]}>

                <View style={st.fieldRow}>
                  <Text style={[st.label, { color: colors.text, fontFamily: 'DMSans_500Medium' }]}>Name</Text>
                  <TextInput
                    style={[st.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text, fontFamily: 'DMSans_400Regular' }]}
                    value={name}
                    onChangeText={setName}
                    placeholder="Your name"
                    placeholderTextColor={colors.textDim}
                    returnKeyType="done"
                  />
                </View>

                <View style={[st.sep, { backgroundColor: colors.border }]} />

                <View style={[st.fieldRow, { flexDirection: 'column', alignItems: 'flex-start' }]}>
                  <Text style={[st.label, { color: colors.text, fontFamily: 'DMSans_500Medium', marginBottom: 10 }]}>Year</Text>
                  <PillRow options={YEAR_OPTIONS} selected={year} onSelect={setYear} />
                </View>

                <View style={[st.sep, { backgroundColor: colors.border }]} />

                <View style={st.fieldRow}>
                  <Text style={[st.label, { color: colors.text, fontFamily: 'DMSans_500Medium' }]}>Dorm</Text>
                  <TextInput
                    style={[st.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text, fontFamily: 'DMSans_400Regular' }]}
                    value={dorm}
                    onChangeText={setDorm}
                    placeholder="Slusher Hall"
                    placeholderTextColor={colors.textDim}
                    returnKeyType="done"
                  />
                </View>

              </View>

              {/* ── Body Stats ── */}
              <SectionHeader title="BODY STATS" />
              <View style={[st.card, { backgroundColor: colors.card, borderColor: colors.border }]}>

                <View style={st.fieldRow}>
                  <Text style={[st.label, { color: colors.text, fontFamily: 'DMSans_500Medium' }]}>Weight</Text>
                  <TextInput
                    style={[st.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text, fontFamily: 'DMSans_400Regular' }]}
                    value={weightLbs}
                    onChangeText={setWeightLbs}
                    placeholder="165"
                    placeholderTextColor={colors.textDim}
                    keyboardType="numeric"
                    returnKeyType="done"
                  />
                  <Text style={[st.unit, { color: colors.textMuted, fontFamily: 'DMSans_400Regular' }]}>lbs</Text>
                </View>

                <View style={[st.sep, { backgroundColor: colors.border }]} />

                <View style={st.fieldRow}>
                  <Text style={[st.label, { color: colors.text, fontFamily: 'DMSans_500Medium' }]}>Height</Text>
                  <View style={{ flex: 1, flexDirection: 'row', gap: 8 }}>
                    <View style={{ flex: 1, alignItems: 'center' }}>
                      <TextInput
                        style={[st.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text, fontFamily: 'DMSans_400Regular', width: '100%' }]}
                        value={heightFt}
                        onChangeText={setHeightFt}
                        placeholder="5"
                        placeholderTextColor={colors.textDim}
                        keyboardType="numeric"
                        returnKeyType="done"
                      />
                      <Text style={[{ fontSize: 11, color: colors.textDim, marginTop: 3, fontFamily: 'DMSans_400Regular' }]}>ft</Text>
                    </View>
                    <View style={{ flex: 1, alignItems: 'center' }}>
                      <TextInput
                        style={[st.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text, fontFamily: 'DMSans_400Regular', width: '100%' }]}
                        value={heightIn}
                        onChangeText={setHeightIn}
                        placeholder="10"
                        placeholderTextColor={colors.textDim}
                        keyboardType="numeric"
                        returnKeyType="done"
                      />
                      <Text style={[{ fontSize: 11, color: colors.textDim, marginTop: 3, fontFamily: 'DMSans_400Regular' }]}>in</Text>
                    </View>
                  </View>
                </View>

                <View style={[st.sep, { backgroundColor: colors.border }]} />

                <View style={st.fieldRow}>
                  <Text style={[st.label, { color: colors.text, fontFamily: 'DMSans_500Medium' }]}>Age</Text>
                  <TextInput
                    style={[st.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text, fontFamily: 'DMSans_400Regular' }]}
                    value={age}
                    onChangeText={setAge}
                    placeholder="20"
                    placeholderTextColor={colors.textDim}
                    keyboardType="numeric"
                    returnKeyType="done"
                  />
                  <Text style={[st.unit, { color: colors.textMuted, fontFamily: 'DMSans_400Regular' }]}>yrs</Text>
                </View>

                <View style={[st.sep, { backgroundColor: colors.border }]} />

                <View style={[st.fieldRow, { flexDirection: 'column', alignItems: 'flex-start' }]}>
                  <Text style={[st.label, { color: colors.text, fontFamily: 'DMSans_500Medium', marginBottom: 10 }]}>Gender</Text>
                  <View style={{ flexDirection: 'row', gap: 10, width: '100%' }}>
                    {[{ label: 'Male', val: true }, { label: 'Female', val: false }].map((g) => (
                      <TouchableOpacity
                        key={g.label}
                        style={[st.genderBtn, {
                          flex: 1,
                          backgroundColor: isMale === g.val ? colors.maroon : colors.cardAlt,
                          borderColor: isMale === g.val ? colors.maroon : colors.border,
                        }]}
                        onPress={() => setIsMale(g.val)}
                        activeOpacity={0.7}
                      >
                        <Text style={[{ fontSize: 14, fontFamily: 'DMSans_600SemiBold', color: isMale === g.val ? '#fff' : colors.textMuted }]}>
                          {g.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

              </View>

              {/* ── Preferences ── */}
              <SectionHeader title="PREFERENCES" />
              <View style={[st.card, { backgroundColor: colors.card, borderColor: colors.border }]}>

                <View style={[st.fieldRow, { flexDirection: 'column', alignItems: 'flex-start' }]}>
                  <Text style={[st.label, { color: colors.text, fontFamily: 'DMSans_500Medium', marginBottom: 10 }]}>Activity Level</Text>
                  <PillRow
                    options={ACTIVITY_OPTIONS.map(o => o.label)}
                    selected={activityLabel}
                    onSelect={(label) => {
                      const found = ACTIVITY_OPTIONS.find(o => o.label === label);
                      if (found) setActivityLevel(found.key);
                    }}
                  />
                </View>

                <View style={[st.sep, { backgroundColor: colors.border }]} />

                <View style={[st.fieldRow, { flexDirection: 'column', alignItems: 'flex-start' }]}>
                  <Text style={[st.label, { color: colors.text, fontFamily: 'DMSans_500Medium', marginBottom: 10 }]}>Goal</Text>
                  <PillRow
                    options={GOAL_OPTIONS.map(o => o.label)}
                    selected={goalLabel}
                    onSelect={(label) => {
                      const found = GOAL_OPTIONS.find(o => o.label === label);
                      if (found) setGoal(found.key);
                    }}
                  />
                </View>

                <View style={[st.sep, { backgroundColor: colors.border }]} />

                <View style={[st.fieldRow, { flexDirection: 'column', alignItems: 'flex-start' }]}>
                  <Text style={[st.label, { color: colors.text, fontFamily: 'DMSans_500Medium', marginBottom: 10 }]}>Home Dining Hall</Text>
                  {diningHalls.map((hall) => (
                    <TouchableOpacity
                      key={hall.id}
                      style={[st.hallRow, {
                        backgroundColor: homeHallId === hall.id ? colors.maroon + '22' : colors.cardAlt,
                        borderColor: homeHallId === hall.id ? colors.maroon : colors.border,
                      }]}
                      onPress={() => setHomeHallId(hall.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={[{ fontSize: 14, fontFamily: 'DMSans_500Medium', color: homeHallId === hall.id ? colors.maroon : colors.text, flex: 1 }]}>
                        {hall.name}
                      </Text>
                      {homeHallId === hall.id && (
                        <Text style={{ fontSize: 14, color: colors.maroon }}>✓</Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>

              </View>

              {/* ── Save ── */}
              <TouchableOpacity
                style={[st.saveBtn, { backgroundColor: colors.maroon, opacity: saving ? 0.6 : 1 }]}
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.85}
              >
                {saving
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={[st.saveBtnText, { fontFamily: 'DMSans_700Bold' }]}>Save Profile</Text>
                }
              </TouchableOpacity>

            </ScrollView>
          </KeyboardAvoidingView>
        )}
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerSide: { width: 64 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 20, paddingBottom: 48 },
  sectionHeader: {
    fontSize: 12,
    letterSpacing: 1.5,
    marginBottom: 8,
    marginTop: 20,
    opacity: 0.7,
  },
  card: { borderRadius: 14, borderWidth: 1, overflow: 'hidden', marginBottom: 4 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
  label: { fontSize: 14, width: 80 },
  input: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
  },
  unit: { fontSize: 13, width: 30, textAlign: 'right' },
  sep: { height: 1, marginHorizontal: 14 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 24, borderWidth: 1 },
  pillText: { fontSize: 13 },
  genderBtn: { padding: 12, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  hallRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
    width: '100%',
  },
  saveBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 24 },
  saveBtnText: { color: '#fff', fontSize: 16 },
});
