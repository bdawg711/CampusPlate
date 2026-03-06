import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
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
import { calculateWaterGoal } from '@/src/utils/goals';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Props {
  onComplete: () => void;
}

interface DiningHall {
  id: number;
  name: string;
}

// ─── Sub-components (defined outside to prevent TextInput remount on re-render) ──

function OptionCard({ icon, label, desc, selected, onPress }: {
  icon: string; label: string; desc: string; selected: boolean; onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 14, marginBottom: 12, backgroundColor: colors.card, borderColor: selected ? colors.maroon : colors.border, borderWidth: selected ? 2 : 1 }}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={{ width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 14, backgroundColor: selected ? 'rgba(139,30,63,0.12)' : 'rgba(168,169,173,0.10)' }}>
        <Feather name={icon as any} size={22} color={selected ? '#861F41' : '#A8A9AD'} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, marginBottom: 2, color: colors.text, fontFamily: 'DMSans_600SemiBold' }}>{label}</Text>
        <Text style={{ fontSize: 13, color: colors.textMuted, fontFamily: 'DMSans_400Regular' }}>{desc}</Text>
      </View>
      <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, justifyContent: 'center', alignItems: 'center', borderColor: selected ? colors.maroon : colors.textDim }}>
        {selected && <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colors.maroon }} />}
      </View>
    </TouchableOpacity>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24, marginRight: 8, marginBottom: 8, backgroundColor: selected ? colors.maroon : colors.card, borderColor: selected ? colors.maroon : colors.border, borderWidth: 1 }}
      onPress={onPress}
    >
      <Text style={{ fontSize: 14, color: selected ? '#fff' : colors.text, fontFamily: 'DMSans_600SemiBold' }}>{label}</Text>
    </TouchableOpacity>
  );
}

function ContinueBtn({ disabled, onPress, label }: { disabled?: boolean; onPress: () => void; label?: string }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      style={{ width: '100%', padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 28, backgroundColor: colors.maroon, opacity: disabled ? 0.4 : 1 }}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={{ color: '#fff', fontSize: 16, fontFamily: 'DMSans_700Bold' }}>{label || 'Continue'}</Text>
    </TouchableOpacity>
  );
}

function Title({ text }: { text: string }) {
  const { colors } = useTheme();
  return (
    <Text style={{ fontSize: 26, marginBottom: 8, color: colors.text, fontFamily: 'Outfit_700Bold' }}>{text}</Text>
  );
}

function Subtitle({ text }: { text: string }) {
  const { colors } = useTheme();
  return (
    <Text style={{ fontSize: 15, lineHeight: 22, color: colors.textMuted, fontFamily: 'DMSans_400Regular' }}>{text}</Text>
  );
}

function InputField({ label, value, onChangeText, placeholder, keyboardType, style: extraStyle }: {
  label: string; value: string; onChangeText: (t: string) => void; placeholder: string;
  keyboardType?: 'numeric' | 'default'; style?: any;
}) {
  const { colors } = useTheme();
  return (
    <View style={[{ marginBottom: 16 }, extraStyle]}>
      <Text style={{ fontSize: 13, marginBottom: 6, color: colors.textMuted, fontFamily: 'DMSans_500Medium' }}>{label}</Text>
      <TextInput
        style={{ borderRadius: 12, padding: 14, fontSize: 16, borderWidth: 1, marginBottom: 4, backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text, fontFamily: 'DMSans_400Regular' }}
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

  // Dining halls fetched from Supabase
  const [diningHalls, setDiningHalls] = useState<DiningHall[]>([]);
  const [hallsLoading, setHallsLoading] = useState(true);

  useEffect(() => {
    const fetchHalls = async () => {
      try {
        const { data, error } = await supabase
          .from('dining_halls')
          .select('id, name');
        if (error) {
          if (__DEV__) console.error('[Onboarding] Failed to fetch dining halls:', error.message);
          return;
        }
        setDiningHalls(data ?? []);
      } catch (e: any) {
        if (__DEV__) console.error('[Onboarding] Error fetching dining halls:', e.message);
      } finally {
        setHallsLoading(false);
      }
    };
    fetchHalls();
  }, []);

  // Step 2
  const [goal, setGoal] = useState<'lose' | 'maintain' | 'build' | null>(null);
  // Step 2 — intensity (only for lose/build)
  const [intensity, setIntensity] = useState<'steady' | 'aggressive' | 'lean' | null>(null);
  // Step 3
  const [activityLevel, setActivityLevel] = useState<number | null>(null);
  const activityKeys: ActivityLevel[] = ['sedentary', 'light', 'moderate', 'very_active', 'extra_active'];
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
  // Water goal
  const [waterGoalOz, setWaterGoalOz] = useState<number>(64);

  const hasIntensityStep = goal === 'lose' || goal === 'build';
  const totalVisibleSteps = hasIntensityStep ? 10 : 9;
  const displayStep = (!hasIntensityStep && step > 1) ? step - 1 : step;

  const next = () => setStep((s) => {
    if (s === 1 && goal === 'maintain') return 3;
    return Math.min(s + 1, 9);
  });

  const getHeightCm = () => {
    const ft = parseInt(heightFt) || 0;
    const inc = parseInt(heightIn) || 0;
    return Math.round((ft * 12 + inc) * 2.54);
  };

  const getWeightKg = () => Math.round((parseFloat(weight) || 150) * 0.453592);

  const getGoalType = (): GoalType => {
    if (goal === 'lose') return intensity === 'aggressive' ? 'aggressive_cut' : 'moderate_cut';
    if (goal === 'build') return intensity === 'aggressive' ? 'aggressive_bulk' : 'lean_bulk';
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
        home_hall_id: homeHall,
        dietary_needs: dietaryNeeds,
        high_protein: false,
        meals_per_day: mealsPerDay ?? 2,
        water_goal_oz: waterGoalOz,
        onboarding_complete: true,
      }).select();
      if (upsertError) {
        if (__DEV__) console.error('[AuthFlow] Onboarding upsert failed:', upsertError.message);
        return;
      }
      onComplete();
    } catch (e: any) {
      if (__DEV__) console.error('Onboarding save error:', e.message);
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
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Image
              source={require('@/assets/images/logo-simplified.png')}
              style={{ width: 120, height: 120, marginBottom: 16 }}
              resizeMode="contain"
            />
            <Text style={{ fontSize: 28, color: colors.text, fontFamily: 'Outfit_700Bold', textAlign: 'center' }}>
              Welcome to CampusPlate
            </Text>
            <Text style={{ fontSize: 16, lineHeight: 24, color: colors.textMuted, fontFamily: 'DMSans_400Regular', textAlign: 'center', marginTop: 12, paddingHorizontal: 20 }}>
              Track your nutrition across Virginia Tech dining halls
            </Text>
            <ContinueBtn onPress={next} label="Get Started" />
            <Text style={{ color: colors.textDim, fontSize: 12, marginTop: 24, fontFamily: 'DMSans_400Regular' }}>
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
              <OptionCard icon="trending-down" label="Lose weight" desc="Shed fat while keeping energy up" selected={goal === 'lose'} onPress={() => setGoal('lose')} />
              <OptionCard icon="minus-circle" label="Maintain" desc="Stay where I am, eat smarter" selected={goal === 'maintain'} onPress={() => setGoal('maintain')} />
              <OptionCard icon="arrow-up-circle" label="Build muscle" desc="Gain size and strength" selected={goal === 'build'} onPress={() => setGoal('build')} />
            </View>
            <ContinueBtn onPress={next} disabled={!goal} />
          </View>
        );

      // ── Step 2: Intensity (lose/build only — maintain skips via next()) ──
      case 2: {
        const isLose = goal === 'lose';
        return (
          <View>
            <Title text={isLose ? 'How fast do you want to lose?' : 'How fast do you want to build?'} />
            <View style={{ marginTop: 20 }}>
              {isLose ? (
                <>
                  <OptionCard icon="trending-down" label="Steady" desc="~0.6 lb/week · -300 cal/day" selected={intensity === 'steady'} onPress={() => setIntensity('steady')} />
                  <OptionCard icon="zap" label="Aggressive" desc="~1 lb/week · -500 cal/day" selected={intensity === 'aggressive'} onPress={() => setIntensity('aggressive')} />
                </>
              ) : (
                <>
                  <OptionCard icon="trending-up" label="Lean" desc="~0.6 lb/week · +300 cal/day" selected={intensity === 'lean'} onPress={() => setIntensity('lean')} />
                  <OptionCard icon="zap" label="Aggressive" desc="~1 lb/week · +500 cal/day" selected={intensity === 'aggressive'} onPress={() => setIntensity('aggressive')} />
                </>
              )}
            </View>
            <ContinueBtn onPress={next} disabled={!intensity} />
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
                { icon: 'monitor', label: 'Sedentary', desc: 'Desk all day, minimal walking' },
                { icon: 'navigation', label: 'Lightly active', desc: 'Walk to class, light daily movement' },
                { icon: 'target', label: 'Moderately active', desc: 'Exercise 3-4 days per week' },
                { icon: 'zap', label: 'Very active', desc: 'Train 5+ days, athlete or heavy labor' },
                { icon: 'award', label: 'Extra Active', desc: 'Physical job or 2x daily training' },
              ].map((o, i) => (
                <OptionCard key={i} icon={o.icon} label={o.label} desc={o.desc} selected={activityLevel === i} onPress={() => setActivityLevel(i)} />
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
              <Text style={{ fontSize: 13, marginBottom: 6, color: colors.textMuted, fontFamily: 'DMSans_500Medium' }}>Height</Text>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <TextInput
                    style={{ borderRadius: 12, padding: 14, fontSize: 16, borderWidth: 1, marginBottom: 4, backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text, fontFamily: 'DMSans_400Regular' }}
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
                    style={{ borderRadius: 12, padding: 14, fontSize: 16, borderWidth: 1, marginBottom: 4, backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text, fontFamily: 'DMSans_400Regular' }}
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
            <ContinueBtn onPress={() => {
              const chips = [48, 64, 80, 96, 128];
              const computed = calculateWaterGoal(parseFloat(weight) || 150);
              setWaterGoalOz(chips.reduce((prev, curr) => Math.abs(curr - computed) < Math.abs(prev - computed) ? curr : prev));
              next();
            }} disabled={!weight || !heightFt} />
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
              <Text style={{ fontSize: 13, marginBottom: 10, color: colors.textMuted, fontFamily: 'DMSans_500Medium' }}>Sex</Text>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {(['Male', 'Female'] as const).map((sex) => (
                  <TouchableOpacity
                    key={sex}
                    style={{
                      padding: 20, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
                      flex: 1,
                      backgroundColor: colors.card,
                      borderColor: (sex === 'Male' ? isMale === true : isMale === false) ? colors.maroon : colors.border,
                      borderWidth: (sex === 'Male' ? isMale === true : isMale === false) ? 2 : 1,
                    }}
                    onPress={() => setIsMale(sex === 'Male')}
                  >
                    <Feather name="user" size={28} color={isMale === (sex === 'Male') ? '#861F41' : '#A8A9AD'} style={{ marginBottom: 8 }} />
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
          'Vegan', 'Vegetarian', 'Halal', 'Gluten-free',
          'Dairy-free', 'Nut allergy', 'No restrictions',
        ];
        return (
          <View>
            <Title text="Any dietary needs?" />
            <Subtitle text="Select all that apply. We'll flag matching items on menus." />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 20 }}>
              {dietaryOptions.map((opt) => {
                return (
                  <Chip key={opt} label={opt} selected={dietary.includes(opt)} onPress={() => toggleDietary(opt)} />
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
              {hallsLoading ? (
                <ActivityIndicator size="large" color={colors.maroon} style={{ marginTop: 40 }} />
              ) : diningHalls.length === 0 ? (
                <View style={{ alignItems: 'center', marginTop: 40 }}>
                  <Feather name="alert-circle" size={32} color="#A8A9AD" />
                  <Text style={[{ color: colors.textMuted, textAlign: 'center', marginTop: 8, fontFamily: 'DMSans_400Regular' }]}>
                    No dining halls found. Please try again later.
                  </Text>
                </View>
              ) : (
                diningHalls.map((hall) => (
                  <TouchableOpacity
                    key={hall.id}
                    style={{
                      flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 14, marginBottom: 12,
                      backgroundColor: colors.card,
                      borderColor: homeHall === hall.id ? colors.maroon : colors.border,
                      borderWidth: homeHall === hall.id ? 2 : 1,
                    }}
                    onPress={() => setHomeHall(hall.id)}
                  >
                    <View style={{ width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 14, backgroundColor: homeHall === hall.id ? 'rgba(139,30,63,0.12)' : 'rgba(255,255,255,0.05)' }}>
                      <Feather name="coffee" size={22} color={homeHall === hall.id ? '#861F41' : '#A8A9AD'} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, marginBottom: 2, color: colors.text, fontFamily: 'DMSans_600SemiBold' }}>{hall.name}</Text>
                    </View>
                  </TouchableOpacity>
                ))
              )}
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
              <Text style={{ fontSize: 13, marginBottom: 10, color: colors.textMuted, fontFamily: 'DMSans_500Medium' }}>Year</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 20 }}>
                {['Freshman', 'Sophomore', 'Junior', 'Senior'].map((y) => (
                  <Chip key={y} label={y} selected={year === y} onPress={() => setYear(y)} />
                ))}
              </View>
              <InputField label="Dorm / Residence" value={dorm} onChangeText={setDorm} placeholder="Slusher Hall" />
              <Text style={{ fontSize: 13, marginBottom: 10, color: colors.textMuted, fontFamily: 'DMSans_500Medium' }}>Meals on campus per day</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 20 }}>
                {[1, 2, 3].map((n) => (
                  <Chip key={n} label={n === 3 ? '3+' : String(n)} selected={mealsPerDay === n} onPress={() => setMealsPerDay(n)} />
                ))}
              </View>
              <Text style={{ fontSize: 13, marginBottom: 10, color: colors.textMuted, fontFamily: 'DMSans_500Medium' }}>Daily water goal</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {[48, 64, 80, 96, 128].map((oz) => (
                  <Chip key={oz} label={`${oz} oz`} selected={waterGoalOz === oz} onPress={() => setWaterGoalOz(oz)} />
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
        const hallName = diningHalls.find((h) => h.id === homeHall)?.name || 'your hall';
        return (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Title text="Your plan is ready" />
            <View style={{ width: '100%', padding: 28, borderRadius: 20, marginTop: 20, marginBottom: 16, backgroundColor: colors.maroon }}>
              <Text style={[{ fontSize: 52, color: '#fff', fontFamily: 'Outfit_800ExtraBold', textAlign: 'center' }]}>
                {goalCals.toLocaleString()}
              </Text>
              <Text style={[{ fontSize: 14, color: 'rgba(255,255,255,0.7)', fontFamily: 'DMSans_400Regular', textAlign: 'center', marginTop: 4 }]}>
                calories per day
              </Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: 20 }}>
                <View style={{ alignItems: 'center' }}>
                  <Text style={[{ fontSize: 20, fontFamily: 'Outfit_700Bold' }, { color: '#5B7FFF' }]}>{macros.proteinG}g</Text>
                  <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', fontFamily: 'DMSans_400Regular', marginTop: 2 }}>Protein</Text>
                </View>
                <View style={{ alignItems: 'center' }}>
                  <Text style={[{ fontSize: 20, fontFamily: 'Outfit_700Bold' }, { color: '#C5A55A' }]}>{macros.carbsG}g</Text>
                  <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', fontFamily: 'DMSans_400Regular', marginTop: 2 }}>Carbs</Text>
                </View>
                <View style={{ alignItems: 'center' }}>
                  <Text style={[{ fontSize: 20, fontFamily: 'Outfit_700Bold' }, { color: '#FFD60A' }]}>{macros.fatG}g</Text>
                  <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', fontFamily: 'DMSans_400Regular', marginTop: 2 }}>Fat</Text>
                </View>
              </View>
            </View>

            <View style={{ width: '100%', padding: 16, borderRadius: 14, marginBottom: 10, backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }}>
              <Text style={[{ fontSize: 14, color: colors.text, fontFamily: 'DMSans_500Medium', textAlign: 'center' }]}>
                {projection}
              </Text>
            </View>

            <View style={{ width: '100%', padding: 16, borderRadius: 14, marginBottom: 10, backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }}>
              <Text style={{ fontSize: 13, color: colors.textMuted, fontFamily: 'DMSans_400Regular', textAlign: 'center' }}>
                We'll highlight the best options at {hallName} every day based on your macros.
              </Text>
            </View>

            <Text style={{ fontSize: 12, color: colors.textDim, fontFamily: 'DMSans_400Regular', textAlign: 'center', marginBottom: 4 }}>
              These can be changed anytime in Settings
            </Text>

            <TouchableOpacity
              style={{ width: '100%', padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 24, backgroundColor: colors.orange, opacity: saving ? 0.6 : 1 }}
              onPress={handleFinish}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: '#fff', fontSize: 16, fontFamily: 'DMSans_700Bold' }}>Start Tracking</Text>
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
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Dot indicators */}
      {step > 0 && step < 9 && (
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 12 }}>
          {Array.from({ length: totalVisibleSteps }, (_, i) => (
            <View
              key={i}
              style={{
                width: i === displayStep ? 20 : 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: i <= displayStep ? colors.maroon : colors.border,
              }}
            />
          ))}
        </View>
      )}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 40, flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {renderStep()}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

