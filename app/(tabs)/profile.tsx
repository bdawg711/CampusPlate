import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/src/utils/supabase';
import { getUserId } from '@/src/utils/user';
import { calculateDailyGoal, type ActivityLevel } from '@/src/utils/nutrition';

type ProfileData = {
  weight_lbs: number;
  height_cm: number;
  age: number;
  is_male: boolean;
  activity_level: ActivityLevel;
  goal: string;
  goal_calories: number;
  goal_protein_g: number;
  goal_carbs_g: number;
  goal_fat_g: number;
};

const ACTIVITY_DESCRIPTIONS: Record<ActivityLevel, string> = {
  sedentary: 'Desk job',
  light: 'Walk to class',
  moderate: 'Regular exercise',
  active: 'Athlete',
};

export default function ProfileScreen() {
  const [profileExists, setProfileExists] = useState(false);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [editing, setEditing] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Form state
  const [weight, setWeight] = useState('');
  const [feet, setFeet] = useState('');
  const [inches, setInches] = useState('');
  const [age, setAge] = useState('');
  const [isMale, setIsMale] = useState(true);
  const [goal, setGoal] = useState<'cut' | 'maintain' | 'bulk'>('maintain');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('light');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ calories: number; protein: number; carbs: number; fat: number } | null>(null);

  const fetchProfile = useCallback(async () => {
    try {
      const userId = await getUserId();
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      if (error) throw error;
      if (data && data.goal_calories) {
        setProfileExists(true);
        const p: ProfileData = {
          weight_lbs: data.weight_lbs || 0,
          height_cm: data.height_cm || 0,
          age: data.age || 0,
          is_male: data.is_male !== false,
          activity_level: data.activity_level || 'light',
          goal: data.goal || 'maintain',
          goal_calories: data.goal_calories,
          goal_protein_g: data.goal_protein_g || Math.round((data.goal_calories * 0.3) / 4),
          goal_carbs_g: data.goal_carbs_g || Math.round((data.goal_calories * 0.45) / 4),
          goal_fat_g: data.goal_fat_g || Math.round((data.goal_calories * 0.25) / 9),
        };
        setProfileData(p);
        // Pre-fill form
        setWeight(p.weight_lbs ? p.weight_lbs.toString() : '');
        const totalInches = Math.round(p.height_cm / 2.54);
        setFeet(Math.floor(totalInches / 12).toString());
        setInches((totalInches % 12).toString());
        setAge(p.age ? p.age.toString() : '');
        setIsMale(p.is_male);
        setGoal((p.goal as any) || 'maintain');
        setActivityLevel((p.activity_level as ActivityLevel) || 'light');
      } else {
        setEditing(true);
      }
    } catch (e: any) {
      setEditing(true);
    } finally {
      setLoadingProfile(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleSave = async () => {
    const w = Number(weight);
    const f = Number(feet);
    const i = Number(inches) || 0;
    const a = Number(age);
    if (!w || !f || !a || w <= 0 || f <= 0 || a <= 0) {
      alert('Please fill in all fields with valid numbers.');
      return;
    }

    setSaving(true);
    setResult(null);
    try {
      const weightKg = w * 0.453592;
      const totalInch = f * 12 + i;
      const heightCm = totalInch * 2.54;
      const dailyCalories = calculateDailyGoal(weightKg, heightCm, a, isMale, goal, activityLevel);
      const proteinG = Math.round((dailyCalories * 0.3) / 4);
      const carbsG = Math.round((dailyCalories * 0.45) / 4);
      const fatG = Math.round((dailyCalories * 0.25) / 9);

      const userId = await getUserId();
      const { error } = await supabase.from('profiles').upsert({
        id: userId,
        weight_lbs: w,
        height_cm: heightCm,
        age: a,
        is_male: isMale,
        activity_level: activityLevel,
        goal,
        goal_calories: dailyCalories,
        goal_protein_g: proteinG,
        goal_carbs_g: carbsG,
        goal_fat_g: fatG,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;

      setResult({ calories: dailyCalories, protein: proteinG, carbs: carbsG, fat: fatG });
      setProfileData({
        weight_lbs: w,
        height_cm: heightCm,
        age: a,
        is_male: isMale,
        activity_level: activityLevel,
        goal,
        goal_calories: dailyCalories,
        goal_protein_g: proteinG,
        goal_carbs_g: carbsG,
        goal_fat_g: fatG,
      });
      setProfileExists(true);
      setEditing(false);
    } catch (e: any) {
      alert(e.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  if (loadingProfile) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  // Show profile view
  if (profileExists && !editing && profileData) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.title}>Your Profile</Text>

          <View style={styles.card}>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Weight</Text>
              <Text style={styles.statValue}>{profileData.weight_lbs} lbs</Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Height</Text>
              <Text style={styles.statValue}>
                {Math.floor(Math.round(profileData.height_cm / 2.54) / 12)}'{Math.round(profileData.height_cm / 2.54) % 12}"
              </Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Age</Text>
              <Text style={styles.statValue}>{profileData.age}</Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Gender</Text>
              <Text style={styles.statValue}>{profileData.is_male ? 'Male' : 'Female'}</Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Activity</Text>
              <Text style={styles.statValue}>
                {profileData.activity_level.charAt(0).toUpperCase() + profileData.activity_level.slice(1)}
              </Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Goal</Text>
              <Text style={styles.statValue}>
                {profileData.goal === 'cut' ? 'Cut (-500)' : profileData.goal === 'bulk' ? 'Bulk (+500)' : 'Maintain'}
              </Text>
            </View>
          </View>

          <View style={styles.goalCard}>
            <Text style={styles.goalTitle}>Daily Target</Text>
            <Text style={styles.goalCalories}>{profileData.goal_calories.toLocaleString()} cal</Text>
            <View style={styles.macroSummary}>
              <View style={styles.macroItem}>
                <Text style={[styles.macroValue, { color: Colors.protein }]}>{profileData.goal_protein_g}g</Text>
                <Text style={styles.macroLabel}>Protein</Text>
              </View>
              <View style={styles.macroItem}>
                <Text style={[styles.macroValue, { color: Colors.carbs }]}>{profileData.goal_carbs_g}g</Text>
                <Text style={styles.macroLabel}>Carbs</Text>
              </View>
              <View style={styles.macroItem}>
                <Text style={[styles.macroValue, { color: Colors.fat }]}>{profileData.goal_fat_g}g</Text>
                <Text style={styles.macroLabel}>Fat</Text>
              </View>
            </View>
          </View>

          {result && (
            <View style={styles.resultCard}>
              <Text style={styles.resultTitle}>Updated!</Text>
              <Text style={styles.resultText}>
                Your daily target: {result.calories.toLocaleString()} calories
              </Text>
              <Text style={styles.resultMacros}>
                Protein: {result.protein}g | Carbs: {result.carbs}g | Fat: {result.fat}g
              </Text>
            </View>
          )}

          <TouchableOpacity style={styles.editButton} onPress={() => setEditing(true)}>
            <Text style={styles.editButtonText}>Recalculate</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Show form
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>{profileExists ? 'Edit Profile' : 'Set Up Your Profile'}</Text>
        {!profileExists && (
          <Text style={styles.subtitle}>Let's calculate your daily nutrition targets</Text>
        )}

        <Text style={styles.label}>Weight (lbs)</Text>
        <TextInput
          placeholder="e.g. 180"
          placeholderTextColor="#999"
          style={styles.input}
          value={weight}
          onChangeText={setWeight}
          keyboardType="numeric"
        />

        <Text style={styles.label}>Height</Text>
        <View style={styles.row}>
          <TextInput
            placeholder="Feet"
            placeholderTextColor="#999"
            style={[styles.input, { flex: 1, marginRight: 10 }]}
            value={feet}
            onChangeText={setFeet}
            keyboardType="numeric"
          />
          <TextInput
            placeholder="Inches"
            placeholderTextColor="#999"
            style={[styles.input, { flex: 1 }]}
            value={inches}
            onChangeText={setInches}
            keyboardType="numeric"
          />
        </View>

        <Text style={styles.label}>Age</Text>
        <TextInput
          placeholder="e.g. 20"
          placeholderTextColor="#999"
          style={styles.input}
          value={age}
          onChangeText={setAge}
          keyboardType="numeric"
        />

        <Text style={styles.label}>Gender</Text>
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleButton, isMale && styles.toggleActive]}
            onPress={() => setIsMale(true)}
          >
            <Text style={[styles.toggleText, isMale && styles.toggleTextActive]}>Male</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, !isMale && styles.toggleActive]}
            onPress={() => setIsMale(false)}
          >
            <Text style={[styles.toggleText, !isMale && styles.toggleTextActive]}>Female</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Activity Level</Text>
        {(['sedentary', 'light', 'moderate', 'active'] as const).map((level) => (
          <TouchableOpacity
            key={level}
            style={[styles.activityOption, activityLevel === level && styles.activityOptionActive]}
            onPress={() => setActivityLevel(level)}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.activityTitle, activityLevel === level && { color: '#fff' }]}>
                {level.charAt(0).toUpperCase() + level.slice(1)}
              </Text>
              <Text style={[styles.activityDesc, activityLevel === level && { color: 'rgba(255,255,255,0.8)' }]}>
                {ACTIVITY_DESCRIPTIONS[level]}
              </Text>
            </View>
          </TouchableOpacity>
        ))}

        <Text style={[styles.label, { marginTop: 8 }]}>Goal</Text>
        <View style={styles.toggleRow}>
          {([
            { key: 'cut' as const, label: 'Cut (-500)' },
            { key: 'maintain' as const, label: 'Maintain' },
            { key: 'bulk' as const, label: 'Bulk (+500)' },
          ]).map((g) => (
            <TouchableOpacity
              key={g.key}
              style={[styles.toggleButton, goal === g.key && styles.toggleActive]}
              onPress={() => setGoal(g.key)}
            >
              <Text style={[styles.toggleText, goal === g.key && styles.toggleTextActive]}>{g.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.saveButton, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveButtonText}>{saving ? 'Calculating...' : 'Calculate & Save'}</Text>
        </TouchableOpacity>

        {profileExists && (
          <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditing(false)}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 16 },
  title: { fontSize: 24, fontWeight: 'bold', color: Colors.textPrimary },
  subtitle: { fontSize: 14, color: Colors.textSecondary, marginTop: 4, marginBottom: 16 },
  label: {
    color: Colors.textPrimary,
    fontWeight: '600',
    fontSize: 14,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  row: { flexDirection: 'row' },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  toggleButton: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    backgroundColor: Colors.card,
  },
  toggleActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  toggleText: { color: Colors.textSecondary, fontWeight: '600', fontSize: 14 },
  toggleTextActive: { color: '#fff' },
  activityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  activityOptionActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  activityTitle: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  activityDesc: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  cancelBtn: { padding: 14, alignItems: 'center', marginTop: 8 },
  cancelBtnText: { color: Colors.textSecondary, fontSize: 15 },

  // Profile view
  card: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  statLabel: { fontSize: 15, color: Colors.textSecondary },
  statValue: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  goalCard: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    padding: 20,
    marginTop: 16,
    alignItems: 'center',
  },
  goalTitle: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '600' },
  goalCalories: { color: '#fff', fontSize: 36, fontWeight: 'bold', marginTop: 4 },
  macroSummary: { flexDirection: 'row', marginTop: 16, gap: 24 },
  macroItem: { alignItems: 'center' },
  macroValue: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  macroLabel: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  resultCard: {
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    alignItems: 'center',
  },
  resultTitle: { fontSize: 16, fontWeight: 'bold', color: Colors.success },
  resultText: { fontSize: 14, color: Colors.textPrimary, marginTop: 4 },
  resultMacros: { fontSize: 13, color: Colors.textSecondary, marginTop: 4 },
  editButton: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  editButtonText: { color: Colors.primary, fontWeight: 'bold', fontSize: 16 },
});
