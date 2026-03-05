import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/src/context/ThemeContext';
import { supabase } from '@/src/utils/supabase';

interface ScheduleEditorProps {
  visible: boolean;
  onClose: () => void;
}

interface ClassEntry {
  id: string;
  class_name: string;
  start_time: string;
  end_time: string;
  location: string | null;
  day_of_week: number;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Convert "H:MM AM/PM" to minutes since midnight for correct sorting. */
function timeToMinutes(time: string | null): number {
  if (!time) return Infinity;
  const match = time.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return Infinity;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3].toUpperCase();
  if (period === 'AM' && hours === 12) hours = 0;
  else if (period === 'PM' && hours !== 12) hours += 12;
  return hours * 60 + minutes;
}

export default function ScheduleEditor({ visible, onClose }: ScheduleEditorProps) {
  const { colors } = useTheme();

  const [selectedDay, setSelectedDay] = useState(new Date().getDay());
  const [classes, setClasses] = useState<ClassEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [formName, setFormName] = useState('');
  const [formStart, setFormStart] = useState('');
  const [formEnd, setFormEnd] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  // Generate time slots from 7:00 AM to 10:00 PM in 15-min increments
  const timeSlots = React.useMemo(() => {
    const slots: string[] = [];
    for (let h = 7; h <= 22; h++) {
      for (let m = 0; m < 60; m += 15) {
        const hour12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
        const period = h >= 12 ? 'PM' : 'AM';
        slots.push(`${hour12}:${String(m).padStart(2, '0')} ${period}`);
      }
    }
    return slots;
  }, []);

  const resetForm = () => {
    setFormName('');
    setFormStart('');
    setFormEnd('');
    setFormLocation('');
    setShowForm(false);
  };

  const fetchClasses = useCallback(async (day: number) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('class_schedules')
        .select('*')
        .eq('user_id', user.id)
        .eq('day_of_week', day)
        .order('start_time', { ascending: true });

      if (error) throw error;
      const sorted = (data ?? []).sort(
        (a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time)
      );
      setClasses(sorted);
    } catch (e: any) {
      Alert.alert('Error', 'Could not load your classes. Please try again.');
      if (__DEV__) console.error('[ScheduleEditor] fetch error:', e?.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      fetchClasses(selectedDay);
      resetForm();
    }
  }, [visible, selectedDay, fetchClasses]);

  const handleSave = async () => {
    if (!formName.trim()) {
      Alert.alert('Missing Field', 'Please enter a class name.');
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.from('class_schedules').insert({
        user_id: user.id,
        day_of_week: selectedDay,
        class_name: formName.trim(),
        start_time: formStart.trim() || null,
        end_time: formEnd.trim() || null,
        location: formLocation.trim() || null,
      });

      if (error) throw error;
      resetForm();
      fetchClasses(selectedDay);
    } catch (e: any) {
      Alert.alert('Error', 'Could not save class. Please try again.');
      if (__DEV__) console.error('[ScheduleEditor] save error:', e?.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    Alert.alert('Delete Class', 'Are you sure you want to remove this class?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { error } = await supabase
              .from('class_schedules')
              .delete()
              .eq('id', id)
              .eq('user_id', user.id);

            if (error) throw error;
            fetchClasses(selectedDay);
          } catch (e: any) {
            Alert.alert('Error', 'Could not delete class. Please try again.');
            if (__DEV__) console.error('[ScheduleEditor] delete error:', e?.message);
          }
        },
      },
    ]);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 20,
            paddingVertical: 16,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <Text
            style={{
              fontSize: 22,
              color: colors.text,
              fontFamily: 'Outfit_700Bold',
            }}
          >
            Class Schedule
          </Text>
          <Pressable
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: colors.inputBg,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Feather name="x" size={18} color={colors.textMuted} />
          </Pressable>
        </View>

        {/* Day Tabs */}
        <View
          style={{
            flexDirection: 'row',
            paddingHorizontal: 12,
            paddingVertical: 12,
            gap: 4,
          }}
        >
          {DAY_LABELS.map((label, index) => {
            const isActive = selectedDay === index;
            return (
              <TouchableOpacity
                key={label}
                onPress={() => setSelectedDay(index)}
                activeOpacity={0.7}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 10,
                  alignItems: 'center',
                  backgroundColor: isActive ? colors.maroon : colors.inputBg,
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontFamily: isActive ? 'DMSans_700Bold' : 'DMSans_500Medium',
                    color: isActive ? '#fff' : colors.textMuted,
                  }}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Class List */}
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {loading ? (
            <ActivityIndicator
              color={colors.maroon}
              size="large"
              style={{ marginTop: 40 }}
            />
          ) : classes.length === 0 && !showForm ? (
            <View style={{ alignItems: 'center', marginTop: 60 }}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>📚</Text>
              <Text
                style={{
                  fontSize: 16,
                  color: colors.textMuted,
                  fontFamily: 'DMSans_500Medium',
                  textAlign: 'center',
                }}
              >
                No classes on {DAY_LABELS[selectedDay]}
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  color: colors.textDim,
                  fontFamily: 'DMSans_400Regular',
                  textAlign: 'center',
                  marginTop: 4,
                }}
              >
                Tap "Add Class" below to get started
              </Text>
            </View>
          ) : (
            classes.map((cls) => (
              <View
                key={cls.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 16,
                  marginBottom: 10,
                  borderRadius: 14,
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 16,
                      color: colors.text,
                      fontFamily: 'Outfit_700Bold',
                      marginBottom: 4,
                    }}
                  >
                    {cls.class_name}
                  </Text>
                  {(cls.start_time || cls.end_time) && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                      <Feather name="clock" size={13} color={colors.textMuted} style={{ marginRight: 6 }} />
                      <Text
                        style={{
                          fontSize: 13,
                          color: colors.textMuted,
                          fontFamily: 'DMSans_400Regular',
                        }}
                      >
                        {cls.start_time || '—'} – {cls.end_time || '—'}
                      </Text>
                    </View>
                  )}
                  {cls.location ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Feather name="map-pin" size={13} color={colors.textMuted} style={{ marginRight: 6 }} />
                      <Text
                        style={{
                          fontSize: 13,
                          color: colors.textMuted,
                          fontFamily: 'DMSans_400Regular',
                        }}
                      >
                        {cls.location}
                      </Text>
                    </View>
                  ) : null}
                </View>

                <TouchableOpacity
                  onPress={() => handleDelete(cls.id)}
                  activeOpacity={0.6}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: colors.errorTint,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginLeft: 12,
                  }}
                >
                  <Feather name="trash-2" size={16} color={colors.red} />
                </TouchableOpacity>
              </View>
            ))
          )}

          {/* Inline Add Form */}
          {showForm && (
            <View
              style={{
                padding: 16,
                borderRadius: 14,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.maroon,
                marginBottom: 10,
              }}
            >
              <Text
                style={{
                  fontSize: 15,
                  color: colors.text,
                  fontFamily: 'Outfit_700Bold',
                  marginBottom: 14,
                }}
              >
                New Class
              </Text>

              {/* Class Name */}
              <Text style={labelStyle(colors)}>Class Name *</Text>
              <TextInput
                value={formName}
                onChangeText={setFormName}
                placeholder="e.g. CS 2114"
                placeholderTextColor={colors.textDim}
                style={inputStyle(colors)}
              />

              {/* Times Row */}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={labelStyle(colors)}>Start Time</Text>
                  <Pressable onPress={() => setShowStartPicker(true)} style={inputStyle(colors)}>
                    <Text
                      style={{
                        fontSize: 15,
                        color: formStart ? colors.text : colors.textDim,
                        fontFamily: 'DMSans_400Regular',
                      }}
                    >
                      {formStart || 'Select time'}
                    </Text>
                  </Pressable>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={labelStyle(colors)}>End Time</Text>
                  <Pressable onPress={() => setShowEndPicker(true)} style={inputStyle(colors)}>
                    <Text
                      style={{
                        fontSize: 15,
                        color: formEnd ? colors.text : colors.textDim,
                        fontFamily: 'DMSans_400Regular',
                      }}
                    >
                      {formEnd || 'Select time'}
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* Location */}
              <Text style={labelStyle(colors)}>Location</Text>
              <TextInput
                value={formLocation}
                onChangeText={setFormLocation}
                placeholder="McBryde 100"
                placeholderTextColor={colors.textDim}
                style={inputStyle(colors)}
              />

              {/* Form Buttons */}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                <TouchableOpacity
                  onPress={resetForm}
                  activeOpacity={0.7}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: 10,
                    alignItems: 'center',
                    backgroundColor: colors.inputBg,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      color: colors.textMuted,
                      fontFamily: 'DMSans_600SemiBold',
                    }}
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSave}
                  disabled={saving}
                  activeOpacity={0.7}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: 10,
                    alignItems: 'center',
                    backgroundColor: colors.maroon,
                    opacity: saving ? 0.6 : 1,
                  }}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text
                      style={{
                        fontSize: 14,
                        color: '#fff',
                        fontFamily: 'DMSans_600SemiBold',
                      }}
                    >
                      Save
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Add Class Button */}
          {!showForm && (
            <TouchableOpacity
              onPress={() => setShowForm(true)}
              activeOpacity={0.7}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 14,
                borderRadius: 14,
                backgroundColor: colors.maroonTint,
                marginTop: 8,
                gap: 8,
              }}
            >
              <Feather name="plus" size={18} color={colors.maroon} />
              <Text
                style={{
                  fontSize: 15,
                  color: colors.maroon,
                  fontFamily: 'DMSans_600SemiBold',
                }}
              >
                Add Class
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        {/* Start Time Picker Modal */}
        <Modal
          visible={showStartPicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowStartPicker(false)}
        >
          <Pressable
            onPress={() => setShowStartPicker(false)}
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}
          >
            <Pressable
              onPress={() => {}}
              style={{
                width: '80%',
                maxHeight: '60%',
                borderRadius: 14,
                backgroundColor: colors.card,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}
              >
                <Text style={{ fontSize: 16, color: colors.text, fontFamily: 'Outfit_700Bold' }}>
                  Start Time
                </Text>
                <Pressable onPress={() => setShowStartPicker(false)} hitSlop={8}>
                  <Feather name="x" size={18} color={colors.textMuted} />
                </Pressable>
              </View>
              <FlatList
                data={timeSlots}
                keyExtractor={(item) => `start-${item}`}
                renderItem={({ item }) => {
                  const isSelected = formStart === item;
                  return (
                    <TouchableOpacity
                      onPress={() => {
                        setFormStart(item);
                        setShowStartPicker(false);
                      }}
                      activeOpacity={0.6}
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 14,
                        backgroundColor: isSelected ? colors.maroonTint : 'transparent',
                        borderBottomWidth: 1,
                        borderBottomColor: colors.border,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 15,
                          color: isSelected ? colors.maroon : colors.text,
                          fontFamily: isSelected ? 'DMSans_600SemiBold' : 'DMSans_400Regular',
                        }}
                      >
                        {item}
                      </Text>
                    </TouchableOpacity>
                  );
                }}
              />
            </Pressable>
          </Pressable>
        </Modal>

        {/* End Time Picker Modal */}
        <Modal
          visible={showEndPicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowEndPicker(false)}
        >
          <Pressable
            onPress={() => setShowEndPicker(false)}
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}
          >
            <Pressable
              onPress={() => {}}
              style={{
                width: '80%',
                maxHeight: '60%',
                borderRadius: 14,
                backgroundColor: colors.card,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}
              >
                <Text style={{ fontSize: 16, color: colors.text, fontFamily: 'Outfit_700Bold' }}>
                  End Time
                </Text>
                <Pressable onPress={() => setShowEndPicker(false)} hitSlop={8}>
                  <Feather name="x" size={18} color={colors.textMuted} />
                </Pressable>
              </View>
              <FlatList
                data={timeSlots}
                keyExtractor={(item) => `end-${item}`}
                renderItem={({ item }) => {
                  const isSelected = formEnd === item;
                  return (
                    <TouchableOpacity
                      onPress={() => {
                        setFormEnd(item);
                        setShowEndPicker(false);
                      }}
                      activeOpacity={0.6}
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 14,
                        backgroundColor: isSelected ? colors.maroonTint : 'transparent',
                        borderBottomWidth: 1,
                        borderBottomColor: colors.border,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 15,
                          color: isSelected ? colors.maroon : colors.text,
                          fontFamily: isSelected ? 'DMSans_600SemiBold' : 'DMSans_400Regular',
                        }}
                      >
                        {item}
                      </Text>
                    </TouchableOpacity>
                  );
                }}
              />
            </Pressable>
          </Pressable>
        </Modal>
      </SafeAreaView>
    </Modal>
  );
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const labelStyle = (colors: any) => ({
  fontSize: 12 as const,
  color: colors.textMuted,
  fontFamily: 'DMSans_500Medium',
  marginBottom: 6,
  marginTop: 10,
  textTransform: 'uppercase' as const,
  letterSpacing: 0.8,
});

const inputStyle = (colors: any) => ({
  backgroundColor: colors.inputBg,
  borderWidth: 1,
  borderColor: colors.inputBorder,
  borderRadius: 10,
  paddingHorizontal: 14,
  paddingVertical: 12,
  fontSize: 15,
  color: colors.text,
  fontFamily: 'DMSans_400Regular',
});
