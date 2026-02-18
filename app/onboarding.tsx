import React, { useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/src/context/ThemeContext';
import { requireUserId } from '@/src/utils/auth';
import { supabase } from '@/src/utils/supabase';
import {
  ActivityLevel,
  GoalType,
  calculateDailyGoal,
  calculateTDEE,
  getWeeklyProjection,
} from '@/src/utils/nutrition';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Props {
  onComplete: () => void;
}

const DINING_HALLS = [
  { id: 1, emoji: '🏛️', name: 'D2 at Dietrick', sub: 'Gauchos, Olives, Edens, Mangia' },
  { id: 2, emoji: '🍔', name: 'West End at Cochrane', sub: "JP's, London Broil, Leaf & Ladle" },
  { id: 3, emoji: '🍗', name: 'Food Court / Hokie Grill', sub: "Chick-fil-A, Origami, Fire Grill" },
  { id: 4, emoji: '🌮', name: 'Turner Place at Lavery', sub: 'Qdoba, Jamba Juice, Bruegger\'s' },
  { id: 5, emoji: '🎓', name: 'Squires Food Court', sub: "Burger '37, BBQ, ABP" },
  { id: 6, emoji: '🏢', name: 'Perry Place at HITT', sub: 'Newest dining location' },
];

// ─── Sub-components (defined outside to prevent TextInput remount on re-render) ──

function OptionCard({ emoji, label, desc, selected, onPress }: {
  emoji: string; label: string; desc: string; selected: boolean; onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      style={[s.optionCard, { backgroundColor: colors.card, borderColor: selected ? colors.maroon : colors.border, borderWidth: selected ? 2 : 1 }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[s.optionEmoji, { backgroundColor: selected ? 'rgba(139,30,63,0.12)' : 'rgba(255,255,255,0.05)' }]}>
        <Text style={{ fontSize: 22 }}>{emoji}</Text>
      </View>
      <View style={s.optionText}>
        <Text style={[s.optionLabel, { color: colors.text, fontFamily: 'DMSans_600SemiBold' }]}>{label}</Text>
        <Text style={[s.optionDesc, { color: colors.textMuted, fontFamily: 'DMSans_400Regular' }]}>{desc}</Text>
      </View>
      <View style={[s.radio, { borderColor: selected ? colors.maroon : colors.textDim }]}>
        {selected && <View style={[s.radioFill, { backgroundColor: colors.maroon }]} />}
      </View>
    </TouchableOpacity>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      style={[s.chip, { backgroundColor: selected ? colors.maroon : colors.card, borderColor: selected ? colors.maroon : colors.border, borderWidth: 1 }]}
      onPress={onPress}
    >
      <Text style={[s.chipText, { color: selected ? '#fff' : colors.text, fontFamily: 'DMSans_600SemiBold' }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function ContinueBtn({ disabled, onPress, label }: { disabled?: boolean; onPress: () => void; label?: string }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      style={[s.continueBtn, { backgroundColor: colors.maroon, opacity: disabled ? 0.4 : 1 }]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={[s.continueBtnText, { fontFamily: 'DMSans_700Bold' }]}>{label || 'Continue'}</Text>
    </TouchableOpacity>
  );
}

function Title({ text }: { text: string }) {
  const { colors } = useTheme();
  return (
    <Text style={[s.title, { color: colors.text, fontFamily: 'Outfit_700Bold' }]}>{text}</Text>
  );
}

function Subtitle({ text }: { text: string }) {
  const { colors } = useTheme();
  return (
    <Text style={[s.subtitle, { color: colors.textMuted, fontFamily: 'DMSans_400Regular' }]}>{text}</Text>
  );
}

function InputField({ label, value, onChangeText, placeholder, keyboardType, style: extraStyle }: {
  label: string; value: string; onChangeText: (t: string) => void; placeholder: string;
  keyboardType?: 'numeric' | 'default'; style?: any;
}) {
  const { colors } = useTheme();
  return (
    <View style={[{ marginBottom: 16 }, extraStyle]}>
      <Text style={[s.inputLabel, { color: colors.textMuted, fontFamily: 'DMSans_500Medium' }]}>{label}</Text>
      <TextInput
        style={[s.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text, fontFamily: 'DMSans_400Regular' }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textDim}
        keyboardType={keyboardType || 'default'}
      />
    </View>
  );
}

export default function OnboardingScreen({ onComplete }: Props) {
  const { colors } = useTheme();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Step 2
  const [goal, setGoal] = useState<'lose' | 'maintain' | 'build' | null>(null);
  // Step 3
  const [followUp, setFollowUp] = useState<number | null>(null);
  // Step 4
  const [activityLevel, setActivityLevel] = useState<number | null>(null);
  const activityKeys: ActivityLevel[] = ['sedentary', 'light', 'moderate', 'active'];
  // Step 5
  const [weight, setWeight] = useState('');
  const [heightFt, setHeightFt] = useState('');
  const [heightIn, setHeightIn] = useState('');
  // Step 6
  const [age, setAge] = useState('');
  const [isMale, setIsMale] = useState<boolean | null>(null);
  // Step 7
  const [dietary, setDietary] = useState<string[]>(['No restrictions']);
  // Step 8
  const [homeHall, setHomeHall] = useState<number | null>(null);
  // Step 9
  const [name, setName] = useState('');
  const [year, setYear] = useState('');
  const [dorm, setDorm] = useState('');
  const [mealsPerDay, setMealsPerDay] = useState<number | null>(null);

  const totalSteps = 10;
  const progress = (step + 1) / totalSteps;

  const next = () => setStep((s) => Math.min(s + 1, totalSteps - 1));

  const getHeightCm = () => {
    const ft = parseInt(heightFt) || 0;
    const inc = parseInt(heightIn) || 0;
    return Math.round((ft * 12 + inc) * 2.54);
  };

  const getWeightKg = () => Math.round((parseFloat(weight) || 150) * 0.453592);

  const getGoalType = (): GoalType => {
    if (goal === 'lose') return 'moderate_cut';
    if (goal === 'build') return 'lean_bulk';
    return 'maintain';
  };

  const getActivityKey = (): ActivityLevel => activityKeys[activityLevel ?? 1];

  const calcGoalCalories = () => {
    const wKg = getWeightKg();
    const hCm = getHeightCm();
    const a = parseInt(age) || 20;
    const male = isMale ?? true;
    return calculateDailyGoal(wKg, hCm, a, male, getGoalType(), getActivityKey());
  };

  const calcTDEE = () => {
    const wKg = getWeightKg();
    const hCm = getHeightCm();
    const a = parseInt(age) || 20;
    const male = isMale ?? true;
    return calculateTDEE(wKg, hCm, a, male, getActivityKey());
  };

  const calcMacros = (cals: number) => {
    const wLbs = parseFloat(weight) || 150;
    const proteinG = Math.round(wLbs * 0.8);
    const fatCals = cals * 0.25;
    const fatG = Math.round(fatCals / 9);
    const carbCals = cals - (proteinG * 4) - (fatG * 9);
    const carbsG = Math.round(carbCals / 4);
    return { proteinG, carbsG, fatG };
  };

  const toggleDietary = (item: string) => {
    if (item === 'No restrictions') {
      setDietary(['No restrictions']);
      return;
    }
    let next = dietary.filter((d) => d !== 'No restrictions');
    if (next.includes(item)) {
      next = next.filter((d) => d !== item);
    } else {
      next.push(item);
    }
    if (next.length === 0) next = ['No restrictions'];
    setDietary(next);
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      const userId = await requireUserId();
      const goalCals = calcGoalCalories();
      const macros = calcMacros(goalCals);
      const dietaryNeeds = dietary.includes('No restrictions') ? [] : dietary;

      const { data: upsertData, error: upsertError } = await supabase.from('profiles').upsert({
        id: userId,
        name: name.trim() || 'Student',
        year,
        dorm: dorm.trim(),
        weight: parseFloat(weight) || 150,
        height: getHeightCm(),
        age: parseInt(age) || 20,
        is_male: isMale ?? true,
        activity_level: getActivityKey(),
        goal: getGoalType(),
        goal_calories: goalCals,
        goal_protein_g: macros.proteinG,
        goal_carbs_g: macros.carbsG,
        goal_fat_g: macros.fatG,
        home_hall_id: homeHall ?? 1,
        dietary_needs: dietaryNeeds,
        high_protein: false,
        meals_per_day: mealsPerDay ?? 2,
        onboarding_complete: true,
      }).select();
      if (upsertError) {
        console.error('[AuthFlow] Onboarding upsert failed:', upsertError.message);
        return;
      }
      console.log('[AuthFlow] Onboarding upsert succeeded:', JSON.stringify(upsertData));
      onComplete();
    } catch (e: any) {
      console.error('Onboarding save error:', e.message);
    } finally {
      setSaving(false);
    }
  };

  // ─── Steps ──────────────────────────────────────────

  const renderStep = () => {
    switch (step) {
      // ── Step 0: Welcome ──
      case 0:
        return (
          <View style={s.centered}>
            <Text style={{ fontSize: 64, marginBottom: 16 }}>🍽️</Text>
            <Text style={[{ fontSize: 36, color: colors.text, fontFamily: 'Outfit_800ExtraBold', textAlign: 'center' }]}>
              CampusPlate
            </Text>
            <Text style={[s.subtitle, { color: colors.textMuted, fontFamily: 'DMSans_400Regular', textAlign: 'center', marginTop: 12, paddingHorizontal: 20 }]}>
              Track what you eat on campus. Hit your goals without the guesswork.
            </Text>
            <ContinueBtn onPress={next} label="Get Started" />
            <Text style={[{ color: colors.textDim, fontSize: 12, marginTop: 24, fontFamily: 'DMSans_400Regular' }]}>
              Built for Virginia Tech
            </Text>
          </View>
        );

      // ── Step 1: Goal ──
      case 1:
        return (
          <View>
            <Title text="What's your goal?" />
            <Subtitle text="This helps us personalize your daily targets." />
            <View style={{ marginTop: 20 }}>
              <OptionCard emoji="⬇️" label="Lose weight" desc="Shed fat while keeping energy up" selected={goal === 'lose'} onPress={() => setGoal('lose')} />
              <OptionCard emoji="⚖️" label="Maintain" desc="Stay where I am, eat smarter" selected={goal === 'maintain'} onPress={() => setGoal('maintain')} />
              <OptionCard emoji="💪" label="Build muscle" desc="Gain size and strength" selected={goal === 'build'} onPress={() => setGoal('build')} />
            </View>
            <ContinueBtn onPress={next} disabled={!goal} />
          </View>
        );

      // ── Step 2: Goal follow-up ──
      case 2: {
        let title = '';
        let sub = '';
        let options: { emoji: string; label: string }[] = [];
        if (goal === 'lose') {
          title = "What's held you back?";
          sub = 'No judgment — most students feel the same way.';
          options = [
            { emoji: '⏰', label: 'Busy schedule' },
            { emoji: '🤷', label: "Don't know what to eat" },
            { emoji: '📊', label: 'Hard to track consistently' },
            { emoji: '🚀', label: 'Just getting started' },
          ];
        } else if (goal === 'build') {
          title = "What's your training focus?";
          sub = '';
          options = [
            { emoji: '🏋️', label: 'Hypertrophy' },
            { emoji: '💪', label: 'Strength' },
            { emoji: '⚡', label: 'Sport performance' },
            { emoji: '🏃', label: 'General fitness' },
          ];
        } else {
          title = 'What matters most to you?';
          sub = '';
          options = [
            { emoji: '🧠', label: 'Eating balanced meals' },
            { emoji: '💰', label: 'Making the most of my meal plan' },
            { emoji: '🏃', label: 'Fueling for activity' },
            { emoji: '😊', label: 'Just being mindful' },
          ];
        }
        return (
          <View>
            <Title text={title} />
            {sub ? <Subtitle text={sub} /> : null}
            <View style={{ marginTop: 20 }}>
              {options.map((o, i) => (
                <OptionCard key={i} emoji={o.emoji} label={o.label} desc="" selected={followUp === i} onPress={() => setFollowUp(i)} />
              ))}
            </View>
            <ContinueBtn onPress={next} disabled={followUp === null} />
          </View>
        );
      }

      // ── Step 3: Activity level ──
      case 3:
        return (
          <View>
            <Title text="How active are you?" />
            <Subtitle text="Be honest — this directly affects your calorie target." />
            <View style={{ marginTop: 20 }}>
              {[
                { emoji: '🛋️', label: 'Sedentary', desc: 'Desk all day, minimal walking' },
                { emoji: '🚶', label: 'Lightly active', desc: 'Walk to class, light daily movement' },
                { emoji: '🏋️', label: 'Moderately active', desc: 'Exercise 3-4 days per week' },
                { emoji: '🔥', label: 'Very active', desc: 'Train 5+ days, athlete or heavy labor' },
              ].map((o, i) => (
                <OptionCard key={i} emoji={o.emoji} label={o.label} desc={o.desc} selected={activityLevel === i} onPress={() => setActivityLevel(i)} />
              ))}
            </View>
            <ContinueBtn onPress={next} disabled={activityLevel === null} />
          </View>
        );

      // ── Step 4: Body stats ──
      case 4:
        return (
          <View>
            <Title text="About your body" />
            <Subtitle text="Used to calculate your metabolism. We keep this private." />
            <View style={{ marginTop: 20 }}>
              <InputField label="Weight (lbs)" value={weight} onChangeText={setWeight} placeholder="165" keyboardType="numeric" />
              <Text style={[s.inputLabel, { color: colors.textMuted, fontFamily: 'DMSans_500Medium' }]}>Height</Text>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <TextInput
                    style={[s.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text, fontFamily: 'DMSans_400Regular' }]}
                    value={heightFt}
                    onChangeText={setHeightFt}
                    placeholder="5"
                    placeholderTextColor={colors.textDim}
                    keyboardType="numeric"
                  />
                  <Text style={[{ fontSize: 11, color: colors.textDim, marginTop: 4, textAlign: 'center', fontFamily: 'DMSans_400Regular' }]}>Feet</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <TextInput
                    style={[s.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text, fontFamily: 'DMSans_400Regular' }]}
                    value={heightIn}
                    onChangeText={setHeightIn}
                    placeholder="10"
                    placeholderTextColor={colors.textDim}
                    keyboardType="numeric"
                  />
                  <Text style={[{ fontSize: 11, color: colors.textDim, marginTop: 4, textAlign: 'center', fontFamily: 'DMSans_400Regular' }]}>Inches</Text>
                </View>
              </View>
            </View>
            <ContinueBtn onPress={next} disabled={!weight || !heightFt} />
          </View>
        );

      // ── Step 5: Age + Gender ──
      case 5:
        return (
          <View>
            <Title text="A few more details" />
            <Subtitle text="Age and sex affect your metabolic rate." />
            <View style={{ marginTop: 20 }}>
              <InputField label="Age" value={age} onChangeText={setAge} placeholder="20" keyboardType="numeric" />
              <Text style={[s.inputLabel, { color: colors.textMuted, fontFamily: 'DMSans_500Medium', marginBottom: 10 }]}>Sex</Text>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {(['Male', 'Female'] as const).map((sex) => (
                  <TouchableOpacity
                    key={sex}
                    style={[s.genderCard, {
                      flex: 1,
                      backgroundColor: colors.card,
                      borderColor: (sex === 'Male' ? isMale === true : isMale === false) ? colors.maroon : colors.border,
                      borderWidth: (sex === 'Male' ? isMale === true : isMale === false) ? 2 : 1,
                    }]}
                    onPress={() => setIsMale(sex === 'Male')}
                  >
                    <Text style={{ fontSize: 28, marginBottom: 8 }}>{sex === 'Male' ? '👨' : '👩'}</Text>
                    <Text style={[{ fontSize: 16, color: colors.text, fontFamily: 'DMSans_600SemiBold' }]}>{sex}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <ContinueBtn onPress={next} disabled={!age || isMale === null} />
          </View>
        );

      // ── Step 6: Dietary needs ──
      case 6: {
        const dietaryOptions = [
          '🌱 Vegan', '🥬 Vegetarian', '☪️ Halal', '🌾 Gluten-free',
          '🥛 Dairy-free', '🥜 Nut allergy', '✅ No restrictions',
        ];
        return (
          <View>
            <Title text="Any dietary needs?" />
            <Subtitle text="Select all that apply. We'll flag matching items on menus." />
            <View style={[s.chipWrap, { marginTop: 20 }]}>
              {dietaryOptions.map((opt) => {
                const key = opt.slice(2).trim();
                return (
                  <Chip key={opt} label={opt} selected={dietary.includes(key)} onPress={() => toggleDietary(key)} />
                );
              })}
            </View>
            <ContinueBtn onPress={next} />
          </View>
        );
      }

      // ── Step 7: Home dining hall ──
      case 7:
        return (
          <View>
            <Title text="Where do you eat most?" />
            <Subtitle text="We'll default to this hall when you open the app." />
            <View style={{ marginTop: 20 }}>
              {DINING_HALLS.map((hall) => (
                <TouchableOpacity
                  key={hall.id}
                  style={[s.optionCard, {
                    backgroundColor: colors.card,
                    borderColor: homeHall === hall.id ? colors.maroon : colors.border,
                    borderWidth: homeHall === hall.id ? 2 : 1,
                  }]}
                  onPress={() => setHomeHall(hall.id)}
                >
                  <View style={[s.optionEmoji, { backgroundColor: homeHall === hall.id ? 'rgba(139,30,63,0.12)' : 'rgba(255,255,255,0.05)' }]}>
                    <Text style={{ fontSize: 22 }}>{hall.emoji}</Text>
                  </View>
                  <View style={s.optionText}>
                    <Text style={[s.optionLabel, { color: colors.text, fontFamily: 'DMSans_600SemiBold' }]}>{hall.name}</Text>
                    <Text style={[s.optionDesc, { color: colors.textMuted, fontFamily: 'DMSans_400Regular' }]}>{hall.sub}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
            <ContinueBtn onPress={next} disabled={homeHall === null} />
          </View>
        );

      // ── Step 8: Campus life ──
      case 8:
        return (
          <View>
            <Title text="Almost done!" />
            <Subtitle text="Just a couple quick things about your campus life." />
            <View style={{ marginTop: 20 }}>
              <InputField label="Name" value={name} onChangeText={setName} placeholder="Cameron" />
              <Text style={[s.inputLabel, { color: colors.textMuted, fontFamily: 'DMSans_500Medium', marginBottom: 10 }]}>Year</Text>
              <View style={[s.chipRow, { marginBottom: 20 }]}>
                {['Freshman', 'Sophomore', 'Junior', 'Senior'].map((y) => (
                  <Chip key={y} label={y} selected={year === y} onPress={() => setYear(y)} />
                ))}
              </View>
              <InputField label="Dorm / Residence" value={dorm} onChangeText={setDorm} placeholder="Slusher Hall" />
              <Text style={[s.inputLabel, { color: colors.textMuted, fontFamily: 'DMSans_500Medium', marginBottom: 10 }]}>Meals on campus per day</Text>
              <View style={s.chipRow}>
                {[1, 2, 3].map((n) => (
                  <Chip key={n} label={n === 3 ? '3+' : String(n)} selected={mealsPerDay === n} onPress={() => setMealsPerDay(n)} />
                ))}
              </View>
            </View>
            <ContinueBtn onPress={next} disabled={!name.trim()} />
          </View>
        );

      // ── Step 9: Your plan ──
      case 9: {
        const goalCals = calcGoalCalories();
        const tdee = calcTDEE();
        const macros = calcMacros(goalCals);
        const projection = getWeeklyProjection(goalCals, tdee);
        const hallName = DINING_HALLS.find((h) => h.id === homeHall)?.name || 'your hall';
        return (
          <View style={s.centered}>
            <Title text="Your plan is ready 🎉" />
            <View style={[s.planCard, { backgroundColor: colors.maroon }]}>
              <Text style={[{ fontSize: 52, color: '#fff', fontFamily: 'Outfit_800ExtraBold', textAlign: 'center' }]}>
                {goalCals.toLocaleString()}
              </Text>
              <Text style={[{ fontSize: 14, color: 'rgba(255,255,255,0.7)', fontFamily: 'DMSans_400Regular', textAlign: 'center', marginTop: 4 }]}>
                calories per day
              </Text>
              <View style={s.macroRow}>
                <View style={s.macroItem}>
                  <Text style={[s.macroVal, { color: '#8BB8FF' }]}>{macros.proteinG}g</Text>
                  <Text style={s.macroLabel}>Protein</Text>
                </View>
                <View style={s.macroItem}>
                  <Text style={[s.macroVal, { color: '#FFB366' }]}>{macros.carbsG}g</Text>
                  <Text style={s.macroLabel}>Carbs</Text>
                </View>
                <View style={s.macroItem}>
                  <Text style={[s.macroVal, { color: '#FFE066' }]}>{macros.fatG}g</Text>
                  <Text style={s.macroLabel}>Fat</Text>
                </View>
              </View>
            </View>

            <View style={[s.infoCard, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
              <Text style={[{ fontSize: 14, color: colors.text, fontFamily: 'DMSans_500Medium', textAlign: 'center' }]}>
                {projection}
              </Text>
            </View>

            <View style={[s.infoCard, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
              <Text style={[{ fontSize: 13, color: colors.textMuted, fontFamily: 'DMSans_400Regular', textAlign: 'center' }]}>
                We'll highlight the best options at {hallName} every day based on your macros.
              </Text>
            </View>

            <TouchableOpacity
              style={[s.continueBtn, { backgroundColor: colors.orange, opacity: saving ? 0.6 : 1, marginTop: 24 }]}
              onPress={handleFinish}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={[s.continueBtnText, { fontFamily: 'DMSans_700Bold' }]}>Let's Go →</Text>
              )}
            </TouchableOpacity>
          </View>
        );
      }

      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.background }]}>
      {/* Progress bar */}
      {step > 0 && (
        <View style={[s.progressTrack, { backgroundColor: colors.border }]}>
          <View style={[s.progressFill, { width: `${progress * 100}%` }]} />
        </View>
      )}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {renderStep()}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  progressTrack: { height: 3, marginHorizontal: 20, borderRadius: 2, marginTop: 8 },
  progressFill: { height: 3, borderRadius: 2, backgroundColor: '#8B1E3F' },
  scrollContent: { padding: 20, paddingBottom: 40, flexGrow: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 26, marginBottom: 8 },
  subtitle: { fontSize: 15, lineHeight: 22 },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    marginBottom: 12,
  },
  optionEmoji: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  optionText: { flex: 1 },
  optionLabel: { fontSize: 16, marginBottom: 2 },
  optionDesc: { fontSize: 13 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  radioFill: { width: 12, height: 12, borderRadius: 6 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24, marginRight: 8, marginBottom: 8 },
  chipText: { fontSize: 14 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap' },
  continueBtn: { width: '100%', padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 28 },
  continueBtnText: { color: '#fff', fontSize: 16 },
  inputLabel: { fontSize: 13, marginBottom: 6 },
  input: { borderRadius: 12, padding: 14, fontSize: 16, borderWidth: 1, marginBottom: 4 },
  genderCard: { padding: 20, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  planCard: { width: '100%', padding: 28, borderRadius: 20, marginTop: 20, marginBottom: 16 },
  macroRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 20 },
  macroItem: { alignItems: 'center' },
  macroVal: { fontSize: 20, fontFamily: 'Outfit_700Bold' },
  macroLabel: { fontSize: 12, color: 'rgba(255,255,255,0.6)', fontFamily: 'DMSans_400Regular', marginTop: 2 },
  infoCard: { width: '100%', padding: 16, borderRadius: 14, marginBottom: 10 },
});
