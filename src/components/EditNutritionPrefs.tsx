import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Switch,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text } from '@/src/theme/restyleTheme';
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

export default function EditNutritionPrefs({ visible, onClose, onSaved }: EditNutritionPrefsProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dietaryNeeds, setDietaryNeeds] = useState<string[]>([]);
  const [highProtein, setHighProtein] = useState(false);
  const [mealsPerDay, setMealsPerDay] = useState(2);

  useEffect(() => {
    if (visible) loadPrefs();
  }, [visible]);

  const loadPrefs = async () => {
    setLoading(true);
    try {
      const userId = await requireUserId();
      const { data } = await supabase.from('profiles').select('dietary_needs, high_protein, meals_per_day').eq('id', userId).single();
      if (data) {
        setDietaryNeeds(data.dietary_needs || []);
        setHighProtein(data.high_protein || false);
        setMealsPerDay(data.meals_per_day || 2);
      }
    } catch { /* silently ignore */ } finally { setLoading(false); }
  };

  const toggleDietary = (item: string) => {
    setDietaryNeeds((prev) => prev.includes(item) ? prev.filter((d) => d !== item) : [...prev, item]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const userId = await requireUserId();
      const { error } = await supabase.from('profiles').update({ dietary_needs: dietaryNeeds, high_protein: highProtein, meals_per_day: mealsPerDay }).eq('id', userId);
      if (error) { if (__DEV__) console.error('Save prefs failed:', error.message); Alert.alert('Error', 'Failed to save. Please try again.'); return; }
      onSaved();
      onClose();
    } catch { Alert.alert('Error', 'Failed to save preferences. Please try again.'); } finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        {/* Modal handle */}
        <View style={{ alignItems: 'center', paddingTop: 8, paddingBottom: 4 }}>
          <View style={{ width: 36, height: 4, borderRadius: 9999, backgroundColor: '#A8A9AD' }} />
        </View>

        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#E8E8EA' }}>
          <TouchableOpacity onPress={onClose} style={{ width: 64 }} activeOpacity={0.6}>
            <Text style={{ fontSize: 15, color: '#A8A9AD', fontFamily: 'DMSans_500Medium' }}>Cancel</Text>
          </TouchableOpacity>
          <Text style={{ flex: 1, textAlign: 'center', fontSize: 17, color: '#1A1A1A', fontFamily: 'Outfit_700Bold' }}>Nutrition Preferences</Text>
          <View style={{ width: 64 }} />
        </View>

        {loading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#861F41" />
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>

            {/* Dietary Needs */}
            <Text style={{ fontSize: 11, fontFamily: 'DMSans_600SemiBold', textTransform: 'uppercase', letterSpacing: 1.5, color: '#A8A9AD', marginBottom: 8, marginTop: 4 }}>DIETARY NEEDS</Text>
            <View style={{ borderRadius: 12, borderWidth: 1, borderColor: '#E8E8EA', backgroundColor: '#FFFFFF', padding: 16, marginBottom: 4 }}>
              <Text style={{ fontSize: 13, lineHeight: 18, marginBottom: 14, color: '#6B6B6F', fontFamily: 'DMSans_400Regular' }}>
                Select all that apply. These will be highlighted on menus.
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {DIETARY_OPTIONS.map((opt) => {
                  const selected = dietaryNeeds.includes(opt);
                  return (
                    <TouchableOpacity
                      key={opt}
                      style={{
                        paddingHorizontal: 14, paddingVertical: 9, borderRadius: 6, borderWidth: 1,
                        backgroundColor: selected ? '#861F41' : '#FAFAFA',
                        borderColor: selected ? '#861F41' : '#E8E8EA',
                      }}
                      onPress={() => toggleDietary(opt)}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontSize: 13, color: selected ? '#FFFFFF' : '#6B6B6F', fontFamily: 'DMSans_600SemiBold' }}>{opt}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* High Protein Toggle */}
            <Text style={{ fontSize: 11, fontFamily: 'DMSans_600SemiBold', textTransform: 'uppercase', letterSpacing: 1.5, color: '#A8A9AD', marginBottom: 8, marginTop: 20 }}>GYM MODE</Text>
            <View style={{ borderRadius: 12, borderWidth: 1, borderColor: '#E8E8EA', backgroundColor: '#FFFFFF', padding: 16, marginBottom: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, marginBottom: 2, color: '#1A1A1A', fontFamily: 'DMSans_600SemiBold' }}>Prioritize High Protein</Text>
                  <Text style={{ fontSize: 12, lineHeight: 16, color: '#6B6B6F', fontFamily: 'DMSans_400Regular' }}>Highlights high-protein items in your collections</Text>
                </View>
                <Switch value={highProtein} onValueChange={setHighProtein} trackColor={{ false: '#9A9A9E', true: '#861F41' }} thumbColor="#FFFFFF" />
              </View>
            </View>

            {/* Meals Per Day */}
            <Text style={{ fontSize: 11, fontFamily: 'DMSans_600SemiBold', textTransform: 'uppercase', letterSpacing: 1.5, color: '#A8A9AD', marginBottom: 8, marginTop: 20 }}>MEALS PER DAY</Text>
            <View style={{ borderRadius: 12, borderWidth: 1, borderColor: '#E8E8EA', backgroundColor: '#FFFFFF', padding: 16, marginBottom: 4 }}>
              <Text style={{ fontSize: 13, lineHeight: 18, marginBottom: 14, color: '#6B6B6F', fontFamily: 'DMSans_400Regular' }}>
                How many campus meals do you eat daily?
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {MEALS_OPTIONS.map((n) => (
                  <TouchableOpacity
                    key={n}
                    style={{
                      flex: 1, paddingVertical: 12, borderRadius: 6, borderWidth: 1, alignItems: 'center',
                      backgroundColor: mealsPerDay === n ? '#861F41' : '#FAFAFA',
                      borderColor: mealsPerDay === n ? '#861F41' : '#E8E8EA',
                    }}
                    onPress={() => setMealsPerDay(n)}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 15, color: mealsPerDay === n ? '#FFFFFF' : '#6B6B6F', fontFamily: 'DMSans_600SemiBold' }}>
                      {n === 5 ? '5+' : String(n)}
                    </Text>
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
                : <Text style={{ color: '#FFFFFF', fontSize: 16, fontFamily: 'DMSans_700Bold' }}>Save Preferences</Text>
              }
            </TouchableOpacity>

          </ScrollView>
        )}
      </View>
    </Modal>
  );
}
