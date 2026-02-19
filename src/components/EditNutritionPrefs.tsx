import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { requireUserId } from '@/src/utils/auth';
import { supabase } from '@/src/utils/supabase';

export interface EditNutritionPrefsProps {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const DIETARY_OPTIONS = [
  'Vegetarian',
  'Vegan',
  'Gluten-Free',
  'Halal',
  'Kosher',
  'Dairy-Free',
  'Nut-Free',
];

const MEALS_OPTIONS = [1, 2, 3, 4, 5];

// ── Defined outside component to prevent remount ──

function SectionHeader({ title }: { title: string }) {
  const { colors } = useTheme();
  return (
    <Text style={[st.sectionHeader, { color: colors.textMuted, fontFamily: 'DMSans_600SemiBold' }]}>
      {title}
    </Text>
  );
}

export default function EditNutritionPrefs({ visible, onClose, onSaved }: EditNutritionPrefsProps) {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [dietaryNeeds, setDietaryNeeds] = useState<string[]>([]);
  const [highProtein, setHighProtein] = useState(false);
  const [mealsPerDay, setMealsPerDay] = useState(2);

  useEffect(() => {
    if (visible) {
      loadPrefs();
    }
  }, [visible]);

  const loadPrefs = async () => {
    setLoading(true);
    try {
      const userId = await requireUserId();
      const { data } = await supabase
        .from('profiles')
        .select('dietary_needs, high_protein, meals_per_day')
        .eq('id', userId)
        .single();

      if (data) {
        setDietaryNeeds(data.dietary_needs || []);
        setHighProtein(data.high_protein || false);
        setMealsPerDay(data.meals_per_day || 2);
      }
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  };

  const toggleDietary = (item: string) => {
    setDietaryNeeds((prev) => {
      if (prev.includes(item)) return prev.filter((d) => d !== item);
      return [...prev, item];
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const userId = await requireUserId();
      const { error } = await supabase.from('profiles').update({
        dietary_needs: dietaryNeeds,
        high_protein: highProtein,
        meals_per_day: mealsPerDay,
      }).eq('id', userId);
      if (error) { console.error('Save prefs failed:', error.message); Alert.alert('Error', 'Failed to save. Please try again.'); return; }
      onSaved();
      onClose();
    } catch {
      Alert.alert('Error', 'Failed to save preferences. Please try again.');
    } finally {
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
      <View style={[st.container, { backgroundColor: colors.background }]}>

        {/* Header */}
        <View style={[st.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} style={st.headerSide} activeOpacity={0.6}>
            <Text style={[{ fontSize: 15, color: colors.textMuted, fontFamily: 'DMSans_500Medium' }]}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[st.headerTitle, { color: colors.text, fontFamily: 'Outfit_700Bold' }]}>Nutrition Preferences</Text>
          <View style={st.headerSide} />
        </View>

        {loading ? (
          <View style={st.loadingWrap}>
            <ActivityIndicator size="large" color={colors.maroon} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={st.content} showsVerticalScrollIndicator={false}>

            {/* ── Dietary Needs ── */}
            <SectionHeader title="DIETARY NEEDS" />
            <View style={[st.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[st.cardHint, { color: colors.textMuted, fontFamily: 'DMSans_400Regular' }]}>
                Select all that apply. These will be highlighted on menus.
              </Text>
              <View style={st.chipWrap}>
                {DIETARY_OPTIONS.map((opt) => {
                  const selected = dietaryNeeds.includes(opt);
                  return (
                    <TouchableOpacity
                      key={opt}
                      style={[st.chip, {
                        backgroundColor: selected ? colors.maroon : colors.cardAlt,
                        borderColor: selected ? colors.maroon : colors.border,
                      }]}
                      onPress={() => toggleDietary(opt)}
                      activeOpacity={0.7}
                    >
                      <Text style={[st.chipText, {
                        color: selected ? '#fff' : colors.textMuted,
                        fontFamily: 'DMSans_600SemiBold',
                      }]}>
                        {opt}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* ── High Protein Toggle ── */}
            <SectionHeader title="GYM MODE" />
            <View style={[st.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={st.toggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[st.toggleLabel, { color: colors.text, fontFamily: 'DMSans_600SemiBold' }]}>
                    Prioritize High Protein
                  </Text>
                  <Text style={[st.toggleHint, { color: colors.textMuted, fontFamily: 'DMSans_400Regular' }]}>
                    Highlights high-protein items in your collections
                  </Text>
                </View>
                <Switch
                  value={highProtein}
                  onValueChange={setHighProtein}
                  trackColor={{ false: colors.textDim, true: colors.maroon }}
                  thumbColor="#fff"
                />
              </View>
            </View>

            {/* ── Meals Per Day ── */}
            <SectionHeader title="MEALS PER DAY" />
            <View style={[st.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[st.cardHint, { color: colors.textMuted, fontFamily: 'DMSans_400Regular' }]}>
                How many campus meals do you eat daily?
              </Text>
              <View style={st.mealsRow}>
                {MEALS_OPTIONS.map((n) => (
                  <TouchableOpacity
                    key={n}
                    style={[st.mealPill, {
                      backgroundColor: mealsPerDay === n ? colors.maroon : colors.cardAlt,
                      borderColor: mealsPerDay === n ? colors.maroon : colors.border,
                    }]}
                    onPress={() => setMealsPerDay(n)}
                    activeOpacity={0.7}
                  >
                    <Text style={[st.mealPillText, {
                      color: mealsPerDay === n ? '#fff' : colors.textMuted,
                      fontFamily: 'DMSans_600SemiBold',
                    }]}>
                      {n === 5 ? '5+' : String(n)}
                    </Text>
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
                : <Text style={[st.saveBtnText, { fontFamily: 'DMSans_700Bold' }]}>Save Preferences</Text>
              }
            </TouchableOpacity>

          </ScrollView>
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
  card: { borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 4 },
  cardHint: { fontSize: 13, lineHeight: 18, marginBottom: 14 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 24, borderWidth: 1 },
  chipText: { fontSize: 13 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleLabel: { fontSize: 15, marginBottom: 2 },
  toggleHint: { fontSize: 12, lineHeight: 16 },
  mealsRow: { flexDirection: 'row', gap: 8 },
  mealPill: { flex: 1, paddingVertical: 12, borderRadius: 24, borderWidth: 1, alignItems: 'center' },
  mealPillText: { fontSize: 15 },
  saveBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 24 },
  saveBtnText: { color: '#fff', fontSize: 16 },
});
