import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { signIn, signUp, resetPassword } from '@/src/utils/auth';

type AuthMode = 'signin' | 'signup' | 'forgot';

export default function AuthScreen() {
  const { colors } = useTheme();
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  useEffect(() => {
    const timer = setTimeout(() => emailRef.current?.focus(), 300);
    return () => clearTimeout(timer);
  }, []);

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setError(null);
    setEmailError(null);
    setPasswordError(null);
    setSuccessMessage(null);
  };

  const validate = (): boolean => {
    let valid = true;
    setEmailError(null);
    setPasswordError(null);

    const trimmed = email.trim();
    if (!trimmed) {
      setEmailError('Email is required');
      valid = false;
    } else if (!trimmed.includes('@')) {
      setEmailError('Please enter a valid email');
      valid = false;
    }

    if (mode !== 'forgot') {
      if (!password) {
        setPasswordError('Password is required');
        valid = false;
      } else if (password.length < 6) {
        setPasswordError('Password must be at least 6 characters');
        valid = false;
      }
    }

    return valid;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    const trimmedEmail = email.trim();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      if (mode === 'forgot') {
        await resetPassword(trimmedEmail);
        setSuccessMessage('Check your email for a reset link');
      } else if (mode === 'signup') {
        await signUp(trimmedEmail, password);
        setSuccessMessage('Account created! You can now sign in.');
        setPassword('');
        setMode('signin');
      } else {
        await signIn(trimmedEmail, password);
      }
    } catch (e: any) {
      const msg = e.message || 'Something went wrong';
      if (msg.toLowerCase().includes('rate limit')) {
        setError('Too many attempts. Please wait a moment and try again.');
      } else if (msg.toLowerCase().includes('invalid') && mode === 'forgot') {
        setError('Please check your email address and try again.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    if (mode === 'forgot') return 'Reset Password';
    if (mode === 'signup') return 'Create Account';
    return 'Sign In';
  };

  const getButtonLabel = () => {
    if (mode === 'forgot') return 'Send Reset Link';
    if (mode === 'signup') return 'Sign Up';
    return 'Sign In';
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
        <View style={{ alignItems: 'center', marginBottom: 32 }}>
          <Image
            source={require('@/assets/images/logo-simplified.png')}
            style={{ width: 180, height: 180, marginBottom: 8 }}
            resizeMode="contain"
          />
          <Text style={{ fontSize: 32, color: colors.text, fontFamily: 'Outfit_800ExtraBold' }}>
            CampusPlate
          </Text>
          <Text style={{ fontSize: 14, marginTop: 4, color: colors.textMuted }}>
            Track your dining hall nutrition
          </Text>
        </View>

        <View style={{ borderRadius: 16, padding: 24, backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }}>
          <Text style={{ fontSize: 22, marginBottom: 16, textAlign: 'center', color: colors.text, fontFamily: 'Outfit_700Bold' }}>
            {getTitle()}
          </Text>

          {successMessage && (
            <View style={{ padding: 10, borderRadius: 8, marginBottom: 12, backgroundColor: 'rgba(52,199,89,0.1)' }}>
              <Text style={{ fontSize: 13, textAlign: 'center', fontFamily: 'DMSans_500Medium', color: colors.green }}>{successMessage}</Text>
            </View>
          )}

          {error && (
            <View style={{ padding: 10, borderRadius: 8, marginBottom: 12, backgroundColor: 'rgba(255,69,58,0.1)' }}>
              <Text style={{ fontSize: 13, textAlign: 'center', color: colors.red }}>{error}</Text>
            </View>
          )}

          <Text style={{ fontSize: 14, marginBottom: 6, marginTop: 12, color: colors.text, fontFamily: 'DMSans_600SemiBold' }}>Email</Text>
          <TextInput
            ref={emailRef}
            style={{ borderRadius: 12, padding: 14, fontSize: 16, borderWidth: 1, backgroundColor: colors.inputBg, borderColor: emailError ? colors.red : colors.inputBorder, color: colors.text }}
            placeholder="you@example.com"
            placeholderTextColor={colors.textDim}
            value={email}
            onChangeText={(t) => { setEmail(t); setEmailError(null); }}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            returnKeyType={mode === 'forgot' ? 'done' : 'next'}
            onSubmitEditing={() => {
              if (mode === 'forgot') {
                handleSubmit();
              } else {
                passwordRef.current?.focus();
              }
            }}
            blurOnSubmit={mode === 'forgot'}
          />
          {emailError && (
            <Text style={{ fontSize: 12, marginTop: 4, fontFamily: 'DMSans_400Regular', color: colors.red }}>{emailError}</Text>
          )}

          {mode !== 'forgot' && (
            <>
              <Text style={{ fontSize: 14, marginBottom: 6, marginTop: 12, color: colors.text, fontFamily: 'DMSans_600SemiBold' }}>Password</Text>
              <View>
                <TextInput
                  ref={passwordRef}
                  style={{ borderRadius: 12, padding: 14, fontSize: 16, borderWidth: 1, backgroundColor: colors.inputBg, borderColor: passwordError ? colors.red : colors.inputBorder, color: colors.text, paddingRight: 56 }}
                  placeholder="Password"
                  placeholderTextColor={colors.textDim}
                  value={password}
                  onChangeText={(t) => { setPassword(t); setPasswordError(null); }}
                  secureTextEntry={!showPassword}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
                />
                <TouchableOpacity
                  style={{ position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' }}
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={{ fontSize: 13, color: colors.textMuted, fontFamily: 'DMSans_500Medium' }}>
                    {showPassword ? 'Hide' : 'Show'}
                  </Text>
                </TouchableOpacity>
              </View>
              {passwordError && (
                <Text style={{ fontSize: 12, marginTop: 4, fontFamily: 'DMSans_400Regular', color: colors.red }}>{passwordError}</Text>
              )}
            </>
          )}

          <TouchableOpacity
            style={{ borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 24, backgroundColor: colors.maroon, opacity: loading ? 0.6 : 1 }}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: '#fff', fontSize: 16, fontFamily: 'DMSans_700Bold' }}>
                {getButtonLabel()}
              </Text>
            )}
          </TouchableOpacity>

          {mode === 'signin' && (
            <TouchableOpacity
              style={{ padding: 8, alignItems: 'center', marginTop: 8 }}
              onPress={() => switchMode('forgot')}
            >
              <Text style={{ fontSize: 13, color: colors.textMuted, fontFamily: 'DMSans_500Medium' }}>
                Forgot password?
              </Text>
            </TouchableOpacity>
          )}

          {mode === 'forgot' ? (
            <TouchableOpacity
              style={{ padding: 12, alignItems: 'center', marginTop: 4 }}
              onPress={() => switchMode('signin')}
            >
              <Text style={{ fontSize: 14, color: colors.maroon, fontFamily: 'DMSans_500Medium' }}>
                Back to Sign In
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={{ padding: 12, alignItems: 'center', marginTop: 4 }}
              onPress={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}
            >
              <Text style={{ fontSize: 14, color: colors.maroon, fontFamily: 'DMSans_500Medium' }}>
                {mode === 'signin'
                  ? "Don't have an account? Sign Up"
                  : 'Already have an account? Sign In'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
