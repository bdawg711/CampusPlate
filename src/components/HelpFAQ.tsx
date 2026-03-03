import React, { useEffect, useState } from 'react';
import {
  Modal,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { Text } from '@/src/theme/restyleTheme';
import { useTheme } from '@/src/context/ThemeContext';

export interface HelpFAQProps {
  visible: boolean;
  onClose: () => void;
}

const FAQ_ITEMS: { q: string; a: string }[] = [
  { q: 'How are my calorie goals calculated?', a: 'CampusPlate uses the Mifflin-St Jeor equation to estimate your daily calorie needs based on your weight, height, age, gender, and activity level. Your selected goal (cut, maintain, or bulk) adjusts the target accordingly.' },
  { q: 'Where does the menu data come from?', a: "Menu data is pulled directly from Virginia Tech's official dining services website (FoodPro) and updated daily. Menus are subject to change — always check signage at the dining location." },
  { q: 'Can I track meals from off-campus restaurants?', a: "Currently, CampusPlate only supports on-campus dining locations listed on VT's official dining site. Off-campus meal tracking may be added in a future update." },
  { q: 'How do I change my nutrition goals?', a: "Go to the More tab and tap 'Nutrition Goals'. You can set custom calorie and macro targets, or recalculate based on your current body stats." },
  { q: 'What does the water tracker measure?', a: "The water tracker counts ounces of water consumed. Tap the quick-add buttons to log water throughout the day. You can customize your daily goal in the More tab under 'Water Goal'." },
  { q: 'How do I reset my password?', a: "On the login screen, tap 'Forgot Password?' and enter your email. You'll receive a password reset link." },
  { q: 'Is my data private?', a: 'Your data is stored securely and is only accessible to you. CampusPlate does not share personal information with third parties.' },
  { q: 'How do I delete my account?', a: 'Contact the development team to request account deletion. This feature will be added in a future update.' },
];

function FAQItem({ question, answer, expanded, onToggle }: {
  question: string;
  answer: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { colors } = useTheme();
  const opacity = useSharedValue(expanded ? 1 : 0);

  useEffect(() => {
    opacity.value = withTiming(expanded ? 1 : 0, {
      duration: 200,
      easing: Easing.out(Easing.quad),
    });
  }, [expanded]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <View>
      <TouchableOpacity
        style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16, gap: 10 }}
        onPress={onToggle}
        activeOpacity={0.7}
      >
        <Text style={{ fontSize: 14, lineHeight: 20, flex: 1, color: colors.text, fontFamily: 'DMSans_600SemiBold' }}>
          {question}
        </Text>
        <Feather name={expanded ? 'chevron-down' : 'chevron-right'} size={16} color={colors.textDim} />
      </TouchableOpacity>
      {expanded && (
        <Animated.View style={[{ paddingHorizontal: 16, paddingBottom: 16 }, animStyle]}>
          <Text style={{ fontSize: 13, lineHeight: 20, color: colors.textMuted, fontFamily: 'DMSans_400Regular' }}>
            {answer}
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

export default function HelpFAQ({ visible, onClose }: HelpFAQProps) {
  const { colors } = useTheme();
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const toggle = (i: number) => setExpandedIndex((prev) => (prev === i ? null : i));

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
            <Text style={{ fontSize: 15, color: colors.textDim, fontFamily: 'DMSans_500Medium' }}>Close</Text>
          </TouchableOpacity>
          <Text style={{ flex: 1, textAlign: 'center', fontSize: 17, color: colors.text, fontFamily: 'Outfit_700Bold' }}>Help & FAQ</Text>
          <View style={{ width: 64 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
          <View style={{ borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, overflow: 'hidden' }}>
            {FAQ_ITEMS.map((item, i) => (
              <View key={i}>
                <FAQItem
                  question={item.q}
                  answer={item.a}
                  expanded={expandedIndex === i}
                  onToggle={() => toggle(i)}
                />
                {i < FAQ_ITEMS.length - 1 && (
                  <View style={{ height: 1, marginHorizontal: 16, backgroundColor: colors.borderLight }} />
                )}
              </View>
            ))}
          </View>

          <Text style={{ textAlign: 'center', fontSize: 12, opacity: 0.4, marginTop: 24, color: colors.textDim, fontFamily: 'DMSans_400Regular' }}>
            CampusPlate v2.5 · Built for Hokies, by Hokies
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
}
