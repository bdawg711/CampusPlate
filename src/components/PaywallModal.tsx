import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/src/context/ThemeContext';
import { useSubscription } from '@/src/context/SubscriptionContext';

interface PaywallModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const FEATURES = [
  {
    icon: 'message-circle' as const,
    title: 'Unlimited AI Chat',
    description: 'Get personalized meal advice and recommendations',
  },
  {
    icon: 'calendar' as const,
    title: 'Smart Meal Planning',
    description: 'AI builds your daily meal plan around your class schedule and nutrition goals',
  },
  {
    icon: 'cpu' as const,
    title: 'AI Meal Plans',
    description: 'Daily meal plans built around your schedule and nutrition goals',
  },
];

export default function PaywallModal({ visible, onClose, onSuccess }: PaywallModalProps) {
  const { colors, mode } = useTheme();
  const { purchase, restore } = useSubscription();
  const insets = useSafeAreaInsets();
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const handlePurchase = async () => {
    setPurchasing(true);
    try {
      const success = await purchase();
      if (success) {
        onClose();
        onSuccess?.();
        Alert.alert('Welcome to Premium!', 'You now have access to all premium features.');
      }
    } catch (e: any) {
      Alert.alert('Purchase Failed', 'Something went wrong. Please try again.');
      if (__DEV__) console.error('[Paywall] Purchase error:', e?.message);
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      const success = await restore();
      if (success) {
        onClose();
        onSuccess?.();
        Alert.alert('Restored!', 'Your premium subscription has been restored.');
      } else {
        Alert.alert('No Subscription Found', 'We couldn\'t find an active subscription for this account.');
      }
    } catch (e: any) {
      Alert.alert('Restore Failed', 'Something went wrong. Please try again.');
      if (__DEV__) console.error('[Paywall] Restore error:', e?.message);
    } finally {
      setRestoring(false);
    }
  };

  const isLoading = purchasing || restoring;
  const gradientColors = mode === 'dark'
    ? ['#6B1835', '#3D0E1F', colors.background] as const
    : ['#861F41', '#6B1835', colors.background] as const;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Close button */}
        <Pressable
          onPress={() => {
            console.log('[PaywallModal] X button pressed, calling onClose');
            onClose();
          }}
          disabled={isLoading}
          style={{
            position: 'absolute',
            top: insets.top + 16,
            right: 20,
            zIndex: 50,
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: 'rgba(255,255,255,0.15)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Feather name="x" size={20} color="#fff" />
        </Pressable>

        <LinearGradient
          colors={gradientColors}
          style={{ paddingTop: 16 }}
        >
          <SafeAreaView edges={['top']} style={{ paddingBottom: 0 }}>
            {/* Logo + Title */}
            <View style={{ alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 32 }}>
              <Image
                source={require('@/assets/images/logo-simplified-small.png')}
                style={{ width: 80, height: 80, marginBottom: 16 }}
                resizeMode="contain"
              />
              <Text
                style={{
                  fontSize: 28,
                  color: '#fff',
                  fontFamily: 'Outfit_700Bold',
                  textAlign: 'center',
                  marginBottom: 6,
                }}
              >
                Upgrade to Premium
              </Text>
              <Text
                style={{
                  fontSize: 15,
                  color: 'rgba(255,255,255,0.7)',
                  fontFamily: 'DMSans_400Regular',
                  textAlign: 'center',
                }}
              >
                Unlock the full CampusPlate experience
              </Text>
            </View>
          </SafeAreaView>
        </LinearGradient>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Feature cards */}
          {FEATURES.map((feature, index) => (
            <View
              key={index}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 16,
                marginBottom: 12,
                borderRadius: 14,
                backgroundColor: colors.cardGlass,
                borderColor: colors.cardGlassBorder,
                borderWidth: 1,
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  backgroundColor: colors.maroonTint,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 14,
                }}
              >
                <Feather name={feature.icon} size={22} color={colors.maroon} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 16,
                    color: colors.text,
                    fontFamily: 'Outfit_700Bold',
                    marginBottom: 3,
                  }}
                >
                  {feature.title}
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    color: colors.textMuted,
                    fontFamily: 'DMSans_400Regular',
                    lineHeight: 18,
                  }}
                >
                  {feature.description}
                </Text>
              </View>
            </View>
          ))}

          {/* Price */}
          <View style={{ alignItems: 'center', marginTop: 20, marginBottom: 24 }}>
            <Text
              style={{
                fontSize: 40,
                color: colors.text,
                fontFamily: 'Outfit_800ExtraBold',
              }}
            >
              $10
              <Text
                style={{
                  fontSize: 18,
                  color: colors.textMuted,
                  fontFamily: 'Outfit_500Medium',
                }}
              >
                /month
              </Text>
            </Text>
          </View>

          {/* Subscribe button */}
          <TouchableOpacity
            onPress={handlePurchase}
            disabled={isLoading}
            activeOpacity={0.8}
            style={{
              borderRadius: 14,
              padding: 18,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.maroon,
              opacity: isLoading ? 0.6 : 1,
            }}
          >
            {purchasing ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text
                style={{
                  fontSize: 17,
                  color: '#fff',
                  fontFamily: 'DMSans_700Bold',
                }}
              >
                Subscribe
              </Text>
            )}
          </TouchableOpacity>

          {/* Restore purchases */}
          <TouchableOpacity
            onPress={handleRestore}
            disabled={isLoading}
            style={{
              alignItems: 'center',
              paddingVertical: 14,
              marginTop: 4,
            }}
          >
            {restoring ? (
              <ActivityIndicator color={colors.textMuted} size="small" />
            ) : (
              <Text
                style={{
                  fontSize: 14,
                  color: colors.textMuted,
                  fontFamily: 'DMSans_500Medium',
                }}
              >
                Restore Purchases
              </Text>
            )}
          </TouchableOpacity>

          {/* Terms / Privacy */}
          <View style={{ alignItems: 'center', marginTop: 16 }}>
            <Text
              style={{
                fontSize: 11,
                color: colors.textDim,
                fontFamily: 'DMSans_400Regular',
                textAlign: 'center',
                lineHeight: 16,
              }}
            >
              Subscription auto-renews monthly. Cancel anytime in Settings.{'\n'}
              Terms of Use  |  Privacy Policy
            </Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
