import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
        <View style={styles.header}>
          <Text style={[styles.emoji]}>🍽️</Text>
          <Text style={[styles.appName, { color: colors.text, fontFamily: 'Outfit_800ExtraBold' }]}>
            CampusPlate
          </Text>
          <Text style={[styles.tagline, { color: colors.textMuted }]}>
            Track your dining hall nutrition
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
          <Text style={[styles.title, { color: colors.text, fontFamily: 'Outfit_700Bold' }]}>
            {getTitle()}
          </Text>

          {successMessage && (
            <View style={[styles.successBanner, { backgroundColor: 'rgba(52,199,89,0.1)' }]}>
              <Text style={[styles.successText, { color: colors.green }]}>{successMessage}</Text>
            </View>
          )}

          {error && (
            <View style={[styles.errorBanner, { backgroundColor: 'rgba(255,69,58,0.1)' }]}>
              <Text style={[styles.errorText, { color: colors.red }]}>{error}</Text>
            </View>
          )}

          <Text style={[styles.label, { color: colors.text, fontFamily: 'DMSans_600SemiBold' }]}>Email</Text>
          <TextInput
            ref={emailRef}
            style={[
              styles.input,
              { backgroundColor: colors.inputBg, borderColor: emailError ? colors.red : colors.inputBorder, color: colors.text },
            ]}
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
            <Text style={[styles.fieldError, { color: colors.red }]}>{emailError}</Text>
          )}

          {mode !== 'forgot' && (
            <>
              <Text style={[styles.label, { color: colors.text, fontFamily: 'DMSans_600SemiBold' }]}>Password</Text>
              <View>
                <TextInput
                  ref={passwordRef}
                  style={[
                    styles.input,
                    { backgroundColor: colors.inputBg, borderColor: passwordError ? colors.red : colors.inputBorder, color: colors.text, paddingRight: 56 },
                  ]}
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
                  style={styles.eyeToggle}
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={[styles.eyeText, { color: colors.textMuted, fontFamily: 'DMSans_500Medium' }]}>
                    {showPassword ? 'Hide' : 'Show'}
                  </Text>
                </TouchableOpacity>
              </View>
              {passwordError && (
                <Text style={[styles.fieldError, { color: colors.red }]}>{passwordError}</Text>
              )}
            </>
          )}

          <TouchableOpacity
            style={[styles.submitButton, { backgroundColor: colors.maroon, opacity: loading ? 0.6 : 1 }]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={[styles.submitText, { fontFamily: 'DMSans_700Bold' }]}>
                {getButtonLabel()}
              </Text>
            )}
          </TouchableOpacity>

          {mode === 'signin' && (
            <TouchableOpacity
              style={styles.forgotLink}
              onPress={() => switchMode('forgot')}
            >
              <Text style={[styles.forgotText, { color: colors.textMuted, fontFamily: 'DMSans_500Medium' }]}>
                Forgot password?
              </Text>
            </TouchableOpacity>
          )}

          {mode === 'forgot' ? (
            <TouchableOpacity
              style={styles.toggleLink}
              onPress={() => switchMode('signin')}
            >
              <Text style={[styles.toggleText, { color: colors.maroon, fontFamily: 'DMSans_500Medium' }]}>
                Back to Sign In
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.toggleLink}
              onPress={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}
            >
              <Text style={[styles.toggleText, { color: colors.maroon, fontFamily: 'DMSans_500Medium' }]}>
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

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  header: { alignItems: 'center', marginBottom: 32 },
  emoji: { fontSize: 48, marginBottom: 8 },
  appName: { fontSize: 32 },
  tagline: { fontSize: 14, marginTop: 4 },
  card: { borderRadius: 16, padding: 24 },
  title: { fontSize: 22, marginBottom: 16, textAlign: 'center' },
  successBanner: { padding: 10, borderRadius: 8, marginBottom: 12 },
  successText: { fontSize: 13, textAlign: 'center', fontFamily: 'DMSans_500Medium' },
  errorBanner: { padding: 10, borderRadius: 8, marginBottom: 12 },
  errorText: { fontSize: 13, textAlign: 'center' },
  label: { fontSize: 14, marginBottom: 6, marginTop: 12 },
  input: { borderRadius: 12, padding: 14, fontSize: 16, borderWidth: 1 },
  fieldError: { fontSize: 12, marginTop: 4, fontFamily: 'DMSans_400Regular' },
  eyeToggle: { position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' },
  eyeText: { fontSize: 13 },
  submitButton: { borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 24 },
  submitText: { color: '#fff', fontSize: 16 },
  forgotLink: { padding: 8, alignItems: 'center', marginTop: 8 },
  forgotText: { fontSize: 13 },
  toggleLink: { padding: 12, alignItems: 'center', marginTop: 4 },
  toggleText: { fontSize: 14 },
});
