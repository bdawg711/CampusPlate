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

function SectionHeader({ title }: { title: string }) {
  const { colors } = useTheme();
  return (
    <Text style={{ fontSize: 11, fontFamily: 'DMSans_600SemiBold', textTransform: 'uppercase', letterSpacing: 1.5, color: colors.textDim, marginBottom: 8, marginTop: 20 }}>
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
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt}
          style={{
            paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6, borderWidth: 1,
            backgroundColor: selected === opt ? '#861F41' : colors.cardAlt,
            borderColor: selected === opt ? '#861F41' : colors.border,
          }}
          onPress={() => onSelect(opt)}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 13, color: selected === opt ? '#FFFFFF' : colors.textMuted, fontFamily: 'DMSans_600SemiBold' }}>{opt}</Text>
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

  const [name, setName] = useState('');
  const [year, setYear] = useState('');
  const [dorm, setDorm] = useState('');
  const [weightLbs, setWeightLbs] = useState('');
  const [heightFt, setHeightFt] = useState('');
  const [heightIn, setHeightIn] = useState('');
  const [age, setAge] = useState('');
  const [isMale, setIsMale] = useState(true);
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('light');
  const [goal, setGoal] = useState<GoalType>('maintain');
  const [homeHallId, setHomeHallId] = useState<number | null>(null);

  useEffect(() => { if (visible) loadProfile(); }, [visible]);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const userId = await requireUserId();
      const [{ data: profile }, { data: halls }] = await Promise.all([
        supabase.from('profiles').select('name, year, dorm, weight, height, age, is_male, activity_level, goal, home_hall_id').eq('id', userId).single(),
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
        } else { setHeightFt(''); setHeightIn(''); }
        setAge(profile.age ? String(profile.age) : '');
        setIsMale(profile.is_male ?? true);
        setActivityLevel((profile.activity_level as ActivityLevel) || 'light');
        setGoal((profile.goal as GoalType) || 'maintain');
        setHomeHallId(profile.home_hall_id ?? null);
      }
      setDiningHalls(halls || []);
    } catch { /* silently ignore */ } finally { setLoading(false); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const userId = await requireUserId();
      const ft = parseInt(heightFt) || 0;
      const inc = parseInt(heightIn) || 0;
      const heightCm = Math.round((ft * 12 + inc) * 2.54);

      const { error } = await supabase.from('profiles').update({
        name: name.trim() || 'Student', year, dorm: dorm.trim(),
        weight: parseFloat(weightLbs) || 0, height: heightCm,
        age: parseInt(age) || 0, is_male: isMale,
        activity_level: activityLevel, goal, home_hall_id: homeHallId,
      }).eq('id', userId);
      if (error) { if (__DEV__) console.error('Save profile failed:', error.message); Alert.alert('Error', 'Failed to save profile. Please try again.'); return; }

      Alert.alert('Profile Saved', 'Recalculate your nutrition goals based on your updated body stats?', [
        { text: 'No thanks', style: 'cancel', onPress: () => { onSaved(); onClose(); } },
        { text: 'Recalculate', onPress: async () => { try { await recalculateGoals(userId); } catch { /* ignore */ } onSaved(); onClose(); } },
      ]);
    } catch { Alert.alert('Error', 'Failed to save profile. Please try again.'); } finally { setSaving(false); }
  };

  const activityLabel = ACTIVITY_OPTIONS.find(o => o.key === activityLevel)?.label || '';
  const goalLabel = GOAL_OPTIONS.find(o => o.key === goal)?.label || '';

  const inputStyle = {
    flex: 1, borderRadius: 6, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, fontSize: 15,
    backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text, fontFamily: 'DMSans_400Regular',
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
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
          <Text style={{ flex: 1, textAlign: 'center', fontSize: 17, color: colors.text, fontFamily: 'Outfit_700Bold' }}>My Profile</Text>
          <View style={{ width: 64 }} />
        </View>

        {loading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#861F41" />
          </View>
        ) : (
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

              {/* Personal Info */}
              <SectionHeader title="PERSONAL INFO" />
              <View style={{ borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, overflow: 'hidden', marginBottom: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 }}>
                  <Text style={{ fontSize: 14, width: 80, color: colors.text, fontFamily: 'DMSans_500Medium' }}>Name</Text>
                  <TextInput style={inputStyle} value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor={colors.textDim} returnKeyType="done" />
                </View>
                <View style={{ height: 1, marginHorizontal: 14, backgroundColor: colors.borderLight }} />
                <View style={{ flexDirection: 'column', alignItems: 'flex-start', padding: 14 }}>
                  <Text style={{ fontSize: 14, color: colors.text, fontFamily: 'DMSans_500Medium', marginBottom: 10 }}>Year</Text>
                  <PillRow options={YEAR_OPTIONS} selected={year} onSelect={setYear} />
                </View>
                <View style={{ height: 1, marginHorizontal: 14, backgroundColor: colors.borderLight }} />
                <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 }}>
                  <Text style={{ fontSize: 14, width: 80, color: colors.text, fontFamily: 'DMSans_500Medium' }}>Dorm</Text>
                  <TextInput style={inputStyle} value={dorm} onChangeText={setDorm} placeholder="Slusher Hall" placeholderTextColor={colors.textDim} returnKeyType="done" />
                </View>
              </View>

              {/* Body Stats */}
              <SectionHeader title="BODY STATS" />
              <View style={{ borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, overflow: 'hidden', marginBottom: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 }}>
                  <Text style={{ fontSize: 14, width: 80, color: colors.text, fontFamily: 'DMSans_500Medium' }}>Weight</Text>
                  <TextInput style={inputStyle} value={weightLbs} onChangeText={setWeightLbs} placeholder="165" placeholderTextColor={colors.textDim} keyboardType="numeric" returnKeyType="done" />
                  <Text style={{ fontSize: 13, width: 30, textAlign: 'right', color: colors.textMuted, fontFamily: 'DMSans_400Regular' }}>lbs</Text>
                </View>
                <View style={{ height: 1, marginHorizontal: 14, backgroundColor: colors.borderLight }} />
                <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 }}>
                  <Text style={{ fontSize: 14, width: 80, color: colors.text, fontFamily: 'DMSans_500Medium' }}>Height</Text>
                  <View style={{ flex: 1, flexDirection: 'row', gap: 8 }}>
                    <View style={{ flex: 1, alignItems: 'center' }}>
                      <TextInput style={{ ...inputStyle, width: '100%' }} value={heightFt} onChangeText={setHeightFt} placeholder="5" placeholderTextColor={colors.textDim} keyboardType="numeric" returnKeyType="done" />
                      <Text style={{ fontSize: 11, color: colors.textDim, marginTop: 3, fontFamily: 'DMSans_400Regular' }}>ft</Text>
                    </View>
                    <View style={{ flex: 1, alignItems: 'center' }}>
                      <TextInput style={{ ...inputStyle, width: '100%' }} value={heightIn} onChangeText={setHeightIn} placeholder="10" placeholderTextColor={colors.textDim} keyboardType="numeric" returnKeyType="done" />
                      <Text style={{ fontSize: 11, color: colors.textDim, marginTop: 3, fontFamily: 'DMSans_400Regular' }}>in</Text>
                    </View>
                  </View>
                </View>
                <View style={{ height: 1, marginHorizontal: 14, backgroundColor: colors.borderLight }} />
                <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 }}>
                  <Text style={{ fontSize: 14, width: 80, color: colors.text, fontFamily: 'DMSans_500Medium' }}>Age</Text>
                  <TextInput style={inputStyle} value={age} onChangeText={setAge} placeholder="20" placeholderTextColor={colors.textDim} keyboardType="numeric" returnKeyType="done" />
                  <Text style={{ fontSize: 13, width: 30, textAlign: 'right', color: colors.textMuted, fontFamily: 'DMSans_400Regular' }}>yrs</Text>
                </View>
                <View style={{ height: 1, marginHorizontal: 14, backgroundColor: colors.borderLight }} />
                <View style={{ flexDirection: 'column', alignItems: 'flex-start', padding: 14 }}>
                  <Text style={{ fontSize: 14, color: colors.text, fontFamily: 'DMSans_500Medium', marginBottom: 10 }}>Gender</Text>
                  <View style={{ flexDirection: 'row', gap: 10, width: '100%' }}>
                    {[{ label: 'Male', val: true }, { label: 'Female', val: false }].map((g) => (
                      <TouchableOpacity
                        key={g.label}
                        style={{
                          flex: 1, padding: 12, borderRadius: 6, borderWidth: 1, alignItems: 'center',
                          backgroundColor: isMale === g.val ? '#861F41' : colors.cardAlt,
                          borderColor: isMale === g.val ? '#861F41' : colors.border,
                        }}
                        onPress={() => setIsMale(g.val)}
                        activeOpacity={0.7}
                      >
                        <Text style={{ fontSize: 14, fontFamily: 'DMSans_600SemiBold', color: isMale === g.val ? '#FFFFFF' : colors.textMuted }}>{g.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              {/* Preferences */}
              <SectionHeader title="PREFERENCES" />
              <View style={{ borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, overflow: 'hidden', marginBottom: 4 }}>
                <View style={{ flexDirection: 'column', alignItems: 'flex-start', padding: 14 }}>
                  <Text style={{ fontSize: 14, color: colors.text, fontFamily: 'DMSans_500Medium', marginBottom: 10 }}>Activity Level</Text>
                  <PillRow
                    options={ACTIVITY_OPTIONS.map(o => o.label)}
                    selected={activityLabel}
                    onSelect={(label) => { const found = ACTIVITY_OPTIONS.find(o => o.label === label); if (found) setActivityLevel(found.key); }}
                  />
                </View>
                <View style={{ height: 1, marginHorizontal: 14, backgroundColor: colors.borderLight }} />
                <View style={{ flexDirection: 'column', alignItems: 'flex-start', padding: 14 }}>
                  <Text style={{ fontSize: 14, color: colors.text, fontFamily: 'DMSans_500Medium', marginBottom: 10 }}>Goal</Text>
                  <PillRow
                    options={GOAL_OPTIONS.map(o => o.label)}
                    selected={goalLabel}
                    onSelect={(label) => { const found = GOAL_OPTIONS.find(o => o.label === label); if (found) setGoal(found.key); }}
                  />
                </View>
                <View style={{ height: 1, marginHorizontal: 14, backgroundColor: colors.borderLight }} />
                <View style={{ flexDirection: 'column', alignItems: 'flex-start', padding: 14 }}>
                  <Text style={{ fontSize: 14, color: colors.text, fontFamily: 'DMSans_500Medium', marginBottom: 10 }}>Home Dining Hall</Text>
                  {diningHalls.map((hall) => (
                    <TouchableOpacity
                      key={hall.id}
                      style={{
                        flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 8, borderWidth: 1, marginBottom: 8, width: '100%',
                        backgroundColor: homeHallId === hall.id ? 'rgba(134,31,65,0.08)' : colors.cardAlt,
                        borderColor: homeHallId === hall.id ? '#861F41' : colors.border,
                      }}
                      onPress={() => setHomeHallId(hall.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontSize: 14, fontFamily: 'DMSans_500Medium', color: homeHallId === hall.id ? '#861F41' : colors.text, flex: 1 }}>{hall.name}</Text>
                      {homeHallId === hall.id && <Feather name="check" size={14} color="#861F41" />}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Save — maroon accent */}
              <TouchableOpacity
                style={{ borderRadius: 6, paddingVertical: 16, alignItems: 'center', marginTop: 24, backgroundColor: '#861F41', opacity: saving ? 0.6 : 1 }}
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.85}
              >
                {saving
                  ? <ActivityIndicator color="#FFFFFF" />
                  : <Text style={{ color: '#FFFFFF', fontSize: 16, fontFamily: 'DMSans_700Bold' }}>Save Profile</Text>
                }
              </TouchableOpacity>

            </ScrollView>
          </KeyboardAvoidingView>
        )}
      </View>
    </Modal>
  );
}
