import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '@/src/context/ThemeContext';
import { requireUserId, signOut } from '@/src/utils/auth';
import { supabase } from '@/src/utils/supabase';

export default function MoreScreen() {
  const { mode, colors, toggleTheme } = useTheme();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState(0);

  const loadData = useCallback(async () => {
    try {
      const userId = await requireUserId();
      const { data } = await supabase
        .from('profiles')
        .select('name, year, dorm, goal_calories, high_protein')
        .eq('id', userId)
        .single();
      if (data) setProfile(data);

      // Calculate streak
      let s = 0;
      for (let i = 0; i < 30; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const { count } = await supabase
          .from('meal_logs')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('date', date);
        if ((count || 0) > 0) s++;
        else break;
      }
      setStreak(s);
    } catch (e) {
      console.error('More load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const toggleHighProtein = async () => {
    try {
      const userId = await requireUserId();
      const newVal = !profile?.high_protein;
      await supabase.from('profiles').update({ high_protein: newVal }).eq('id', userId);
      setProfile((p: any) => p ? { ...p, high_protein: newVal } : p);
    } catch (e) {
      console.error('Toggle error:', e);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  const MenuItem = ({ emoji, label, badge, badgeColor, onPress, rightContent, textColor }: {
    emoji: string; label: string; badge?: string; badgeColor?: string;
    onPress?: () => void; rightContent?: React.ReactNode; textColor?: string;
  }) => (
    <TouchableOpacity style={st.menuItem} onPress={onPress} activeOpacity={onPress ? 0.6 : 1}>
      <View style={[st.menuIcon, { backgroundColor: colors.cardAlt }]}>
        <Text style={{ fontSize: 18 }}>{emoji}</Text>
      </View>
      <Text style={[st.menuLabel, { color: textColor || colors.text, fontFamily: 'DMSans_500Medium' }]}>{label}</Text>
      {badge && (
        <View style={[st.menuBadge, { backgroundColor: badgeColor || colors.orange }]}>
          <Text style={[{ fontSize: 10, color: '#fff', fontFamily: 'DMSans_700Bold' }]}>{badge}</Text>
        </View>
      )}
      <View style={{ flex: 1 }} />
      {rightContent || <Text style={[{ fontSize: 18, color: colors.textDim }]}>›</Text>}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={[st.safe, { backgroundColor: colors.background }]}>
        <View style={st.loadingWrap}><ActivityIndicator size="large" color={colors.maroon} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[st.safe, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={st.pad} showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <View style={st.profileHeader}>
          <View style={[st.avatar, { backgroundColor: colors.maroon }]}>
            <Text style={[{ fontSize: 28, color: '#fff', fontFamily: 'Outfit_700Bold' }]}>
              {(profile?.name || 'U')[0].toUpperCase()}
            </Text>
          </View>
          <Text style={[{ fontSize: 20, color: colors.text, fontFamily: 'Outfit_700Bold', marginTop: 12 }]}>
            {profile?.name || 'Student'}
          </Text>
          <Text style={[{ fontSize: 13, color: colors.textMuted, fontFamily: 'DMSans_400Regular', marginTop: 4 }]}>
            {profile?.year || ''}{profile?.year && profile?.dorm ? ' · ' : ''}{profile?.dorm || ''}
          </Text>
          <Text style={[{ fontSize: 12, color: colors.textDim, fontFamily: 'DMSans_400Regular', marginTop: 4 }]}>
            {streak} day streak 🔥 · {profile?.goal_calories?.toLocaleString() || '2,000'} cal goal
          </Text>
        </View>

        {/* Menu Items */}
        <View style={[st.menuCard, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
          <MenuItem emoji="👤" label="My Profile" />
          <View style={[st.separator, { backgroundColor: colors.border }]} />
          <MenuItem emoji="🎯" label="Goals" />
          <View style={[st.separator, { backgroundColor: colors.border }]} />
          <MenuItem emoji="🍎" label="Nutrition Preferences" />
          <View style={[st.separator, { backgroundColor: colors.border }]} />
          <MenuItem
            emoji="💪"
            label="Gym Mode"
            badge={profile?.high_protein ? 'PRO' : undefined}
            badgeColor={colors.orange}
            rightContent={
              <Switch
                value={profile?.high_protein || false}
                onValueChange={toggleHighProtein}
                trackColor={{ false: colors.textDim, true: colors.maroon }}
                thumbColor="#fff"
              />
            }
          />
        </View>

        <View style={[st.menuCard, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, marginTop: 12 }]}>
          <MenuItem emoji="🔔" label="Reminders" />
          <View style={[st.separator, { backgroundColor: colors.border }]} />
          <MenuItem
            emoji="🌙"
            label="Appearance"
            rightContent={
              <TouchableOpacity onPress={toggleTheme} style={[st.themeChip, { backgroundColor: colors.cardAlt }]}>
                <Text style={[{ fontSize: 12, color: colors.text, fontFamily: 'DMSans_600SemiBold' }]}>
                  {mode === 'dark' ? 'Dark' : 'Light'}
                </Text>
              </TouchableOpacity>
            }
          />
          <View style={[st.separator, { backgroundColor: colors.border }]} />
          <MenuItem emoji="📊" label="Weekly Report" badge="NEW" badgeColor={colors.blue} />
          <View style={[st.separator, { backgroundColor: colors.border }]} />
          <MenuItem emoji="🏛️" label="Dining Halls" />
          <View style={[st.separator, { backgroundColor: colors.border }]} />
          <MenuItem emoji="❓" label="Help & FAQ" />
        </View>

        <View style={[st.menuCard, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, marginTop: 12 }]}>
          <MenuItem emoji="🚪" label="Sign Out" textColor={colors.red} onPress={handleSignOut} />
        </View>

        <Text style={[st.footer, { color: colors.textDim, fontFamily: 'DMSans_400Regular' }]}>
          CampusPlate v1.0 · Built for Virginia Tech
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1 },
  pad: { padding: 20, paddingBottom: 40 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  profileHeader: { alignItems: 'center', marginBottom: 28 },
  avatar: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center' },
  menuCard: { borderRadius: 14, overflow: 'hidden' },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  menuIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  menuLabel: { fontSize: 15 },
  menuBadge: { marginLeft: 8, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  separator: { height: 1, marginLeft: 64 },
  themeChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  footer: { textAlign: 'center', fontSize: 12, opacity: 0.2, marginTop: 32 },
});
