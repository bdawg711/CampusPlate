import React, { useState } from 'react';
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
import { signIn, signUp } from '@/src/utils/auth';

export default function AuthScreen() {
  const { colors } = useTheme();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError('Please enter email and password.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (mode === 'signup') {
        await signUp(trimmedEmail, password);
      } else {
        await signIn(trimmedEmail, password);
      }
    } catch (e: any) {
      setError(e.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
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
            {mode === 'signin' ? 'Sign In' : 'Create Account'}
          </Text>

          {error && (
            <View style={[styles.errorBanner, { backgroundColor: 'rgba(255,69,58,0.1)' }]}>
              <Text style={[styles.errorText, { color: colors.red }]}>{error}</Text>
            </View>
          )}

          <Text style={[styles.label, { color: colors.text, fontFamily: 'DMSans_600SemiBold' }]}>Email</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
            placeholder="you@example.com"
            placeholderTextColor={colors.textDim}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />

          <Text style={[styles.label, { color: colors.text, fontFamily: 'DMSans_600SemiBold' }]}>Password</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
            placeholder="Password"
            placeholderTextColor={colors.textDim}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          />

          <TouchableOpacity
            style={[styles.submitButton, { backgroundColor: colors.maroon }, loading && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={[styles.submitText, { fontFamily: 'DMSans_700Bold' }]}>
                {mode === 'signin' ? 'Sign In' : 'Sign Up'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.toggleLink}
            onPress={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); }}
          >
            <Text style={[styles.toggleText, { color: colors.maroon, fontFamily: 'DMSans_500Medium' }]}>
              {mode === 'signin'
                ? "Don't have an account? Sign Up"
                : 'Already have an account? Sign In'}
            </Text>
          </TouchableOpacity>
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
  errorBanner: { padding: 10, borderRadius: 8, marginBottom: 12 },
  errorText: { fontSize: 13, textAlign: 'center' },
  label: { fontSize: 14, marginBottom: 6, marginTop: 12 },
  input: { borderRadius: 12, padding: 14, fontSize: 16, borderWidth: 1 },
  submitButton: { borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 24 },
  submitText: { color: '#fff', fontSize: 16 },
  toggleLink: { padding: 12, alignItems: 'center', marginTop: 8 },
  toggleText: { fontSize: 14 },
});
