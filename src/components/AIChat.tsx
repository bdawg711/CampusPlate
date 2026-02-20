import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { Box, Text } from '@/src/theme/restyleTheme';
import { getCurrentUserId } from '@/src/utils/auth';
import {
  sendMessage as sendAIMessage,
  getChatHistory,
  clearChatHistory,
  type ChatMessage,
  type MealItem,
} from '@/src/utils/ai';
import AIChatBubble from './AIChatBubble';
import TypingIndicator from './TypingIndicator';

// ── Types ───────────────────────────────────────────────────────────────────

interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  mealItems?: MealItem[] | null;
}

interface AIChatProps {
  mode?: 'modal' | 'tab';
  visible?: boolean;
  onClose?: () => void;
  onLogItem?: (item: MealItem) => void;
}

// ── Suggestion cards ────────────────────────────────────────────────────────

const SUGGESTIONS: { icon: keyof typeof Feather.glyphMap; title: string; subtitle: string }[] = [
  { icon: 'trending-up', title: 'Plan my meals today', subtitle: 'Based on your remaining macros' },
  { icon: 'search', title: "What's high protein?", subtitle: 'Find meals that fit your goals' },
  { icon: 'clock', title: "What's open now?", subtitle: 'See available dining halls' },
];

// ── Component ───────────────────────────────────────────────────────────────

export default function AIChat({ mode = 'tab', visible = true, onClose, onLogItem }: AIChatProps) {
  const isTab = mode === 'tab';
  const insets = useSafeAreaInsets();

  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);

  const flatListRef = useRef<FlatList<DisplayMessage>>(null);
  const historyRef = useRef<ChatMessage[]>([]);

  // ── Load history on open ────────────────────────────────────────────────
  useEffect(() => {
    if (!visible) return;

    let cancelled = false;
    (async () => {
      setInitialLoading(true);
      try {
        const userId = await getCurrentUserId();
        if (!userId || cancelled) return;

        const rows = await getChatHistory(userId);
        const mapped: DisplayMessage[] = rows.map((r) => ({
          id: String(r.id),
          role: r.role,
          content: r.content,
          mealItems: r.meal_items,
        }));
        setMessages(mapped);
        historyRef.current = rows.map((r) => ({
          role: r.role,
          content: r.content,
          meal_items: r.meal_items,
        }));
      } catch (err) {
        console.error('Failed to load chat history:', (err as Error).message);
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [visible]);

  // ── Auto-scroll on new messages ─────────────────────────────────────────
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  // ── Auto-scroll when keyboard opens ───────────────────────────────────
  useEffect(() => {
    const event = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const sub = Keyboard.addListener(event, () => {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 150);
    });
    return () => sub.remove();
  }, []);

  // ── Send message ────────────────────────────────────────────────────────
  const handleSend = useCallback(async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;

    setInput('');
    setErrorMsg(null);
    setLastFailedMessage(null);

    const userMsg: DisplayMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: msg,
    };
    setMessages((prev) => [...prev, userMsg]);

    setLoading(true);
    try {
      const userId = await getCurrentUserId();
      if (!userId) {
        Alert.alert('Error', 'You must be logged in to use the AI assistant.');
        return;
      }

      const response = await sendAIMessage(userId, msg, historyRef.current);
      historyRef.current = [...historyRef.current, { role: 'user', content: msg }];

      const assistantMsg: DisplayMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: response.content,
        mealItems: response.mealItems,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      historyRef.current = [
        ...historyRef.current,
        { role: 'assistant', content: response.content, meal_items: response.mealItems },
      ];
    } catch (err) {
      const errMessage = (err as Error).message || 'Something went wrong. Please try again.';
      setErrorMsg(errMessage);
      setLastFailedMessage(msg);
      setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
    } finally {
      setLoading(false);
    }
  }, [input, loading]);

  // ── Clear chat ──────────────────────────────────────────────────────────
  const handleClear = useCallback(async () => {
    Alert.alert('Clear Chat', 'Delete all messages?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          try {
            const userId = await getCurrentUserId();
            if (!userId) return;
            await clearChatHistory(userId);
            setMessages([]);
            historyRef.current = [];
            setErrorMsg(null);
            setLastFailedMessage(null);
          } catch (err) {
            Alert.alert('Error', (err as Error).message || 'Failed to clear chat.');
          }
        },
      },
    ]);
  }, []);

  // ── Retry last failed message ───────────────────────────────────────────
  const handleRetry = useCallback(() => {
    if (lastFailedMessage) {
      handleSend(lastFailedMessage);
    }
  }, [lastFailedMessage, handleSend]);

  // ── Render ──────────────────────────────────────────────────────────────
  const showChips = messages.length === 0 && !initialLoading;

  const chatContent = (
    <Box
      flex={1}
      backgroundColor="background"
      style={isTab ? {} : undefined}
    >
      {/* ── Header ── */}
      <Box
        flexDirection="row"
        alignItems="center"
        paddingHorizontal="l"
        borderColor="border"
        style={{
          paddingVertical: 16,
          borderBottomWidth: 1,
          ...(isTab ? { paddingTop: insets.top + 8 } : {}),
        }}
      >
        {isTab ? (
          <Box flex={1}>
            <Text variant="pageTitle" style={{ fontSize: 20 }}>
              CampusPlate AI
            </Text>
          </Box>
        ) : (
          <>
            <TouchableOpacity onPress={onClose} style={{ width: 64 }} activeOpacity={0.6}>
              <Text variant="muted" style={{ fontSize: 15, fontFamily: 'DMSans_500Medium', color: '#6B6B6F' }}>
                Close
              </Text>
            </TouchableOpacity>
            <Box flex={1} alignItems="center">
              <Text variant="pageTitle" style={{ fontSize: 20 }}>
                CampusPlate AI
              </Text>
            </Box>
          </>
        )}
        <TouchableOpacity
          onPress={handleClear}
          style={{ width: 64, alignItems: 'flex-end' }}
          activeOpacity={0.6}
        >
          <Text variant="body" style={{ color: '#861F41', fontFamily: 'DMSans_500Medium' }}>
            Clear
          </Text>
        </TouchableOpacity>
      </Box>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === 'ios' ? (isTab ? 90 : 60) : 24}
      >
        {/* ── Messages ── */}
        {initialLoading ? (
          <Box flex={1} justifyContent="center" alignItems="center">
            <ActivityIndicator size="large" color="#861F41" />
          </Box>
        ) : (
          <FlatList
            ref={flatListRef}
            style={{ flex: 1 }}
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{
              paddingTop: 16,
              paddingBottom: 8,
              ...(messages.length === 0 ? { flexGrow: 1 } : {}),
            }}
            renderItem={({ item }) => (
              <AIChatBubble
                role={item.role}
                content={item.content}
                mealItems={item.mealItems}
                onLogItem={onLogItem}
              />
            )}
            ListHeaderComponent={
              showChips ? (
                <Box alignItems="center" style={{ paddingTop: 60, paddingBottom: 16 }} paddingHorizontal="l">
                  <Feather name="zap" size={64} color="#9A9A9E" style={{ opacity: 0.15 }} />
                  <Text
                    variant="cardTitle"
                    style={{ fontSize: 20, fontFamily: 'Outfit_600SemiBold', marginTop: 16 }}
                  >
                    What can I help with?
                  </Text>
                  <Text
                    variant="muted"
                    style={{ textAlign: 'center', maxWidth: 280, marginTop: 8, lineHeight: 20 }}
                  >
                    I know today's menus, your goals, and what's open right now.
                  </Text>
                  <Box width="100%" style={{ marginTop: 32, gap: 8 }}>
                    {SUGGESTIONS.map((s) => (
                      <SuggestionCard
                        key={s.title}
                        icon={s.icon}
                        title={s.title}
                        subtitle={s.subtitle}
                        onPress={() => handleSend(s.title)}
                      />
                    ))}
                  </Box>
                </Box>
              ) : null
            }
            ListFooterComponent={
              <>
                {loading && <TypingIndicator />}
                {errorMsg && !loading && (
                  <Box alignItems="center" paddingHorizontal="l" paddingVertical="s" style={{ gap: 8 }}>
                    <Text variant="muted" style={{ color: '#C0392B', textAlign: 'center' }}>
                      {errorMsg}
                    </Text>
                    {lastFailedMessage && (
                      <TouchableOpacity
                        onPress={handleRetry}
                        activeOpacity={0.7}
                        style={{
                          paddingHorizontal: 20,
                          paddingVertical: 8,
                          borderRadius: 6,
                          borderWidth: 1,
                          borderColor: '#E8E8EA',
                          backgroundColor: '#FFFFFF',
                        }}
                      >
                        <Text variant="body" style={{ color: '#861F41', fontFamily: 'DMSans_600SemiBold' }}>
                          Retry
                        </Text>
                      </TouchableOpacity>
                    )}
                  </Box>
                )}
              </>
            }
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* ── Input row ── */}
        <Box
          paddingHorizontal="s"
          style={{
            paddingVertical: 10,
            backgroundColor: '#FFFFFF',
            paddingBottom: isTab ? Math.max(insets.bottom, 10) + 100 : Math.max(insets.bottom, 10),
          }}
        >
          <Box
            flexDirection="row"
            alignItems="flex-end"
            borderRadius="s"
            style={{
              backgroundColor: '#F5F5F7',
              paddingHorizontal: 14,
              paddingVertical: 6,
              gap: 4,
            }}
          >
            <Feather
              name="camera"
              size={20}
              color="#A8A9AD"
              style={{ marginRight: 8, marginBottom: 8 }}
            />
            <TextInput
              style={{
                flex: 1,
                fontSize: 15,
                maxHeight: 100,
                paddingTop: 8,
                paddingBottom: 8,
                color: '#1A1A1A',
                fontFamily: 'DMSans_400Regular',
              }}
              value={input}
              onChangeText={setInput}
              placeholder="Ask about today's menu..."
              placeholderTextColor="#9A9A9E"
              multiline
              maxLength={500}
              returnKeyType="default"
              editable={!loading}
            />
            <Pressable
              onPress={() => handleSend()}
              disabled={!input.trim() || loading}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: '#861F41',
                justifyContent: 'center',
                alignItems: 'center',
                opacity: input.trim() && !loading ? 1 : 0.4,
              }}
            >
              <Feather name="arrow-up" size={18} color="#FFFFFF" />
            </Pressable>
          </Box>
        </Box>
      </KeyboardAvoidingView>
    </Box>
  );

  if (isTab) {
    return chatContent;
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      {chatContent}
    </Modal>
  );
}

// ── Suggestion card with press animation ─────────────────────────────────────

function SuggestionCard({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={() => {
          scale.value = withTiming(0.97, {
            duration: 100,
            easing: Easing.out(Easing.quad),
          });
        }}
        onPressOut={() => {
          scale.value = withTiming(1, {
            duration: 150,
            easing: Easing.out(Easing.quad),
          });
        }}
      >
        <Box
          flexDirection="row"
          alignItems="center"
          borderRadius="m"
          borderWidth={1}
          borderColor="border"
          backgroundColor="card"
          padding="m"
          style={{ gap: 12 }}
        >
          <Feather name={icon} size={16} color="#6B6B6F" />
          <Box flex={1}>
            <Text variant="body" style={{ fontFamily: 'DMSans_600SemiBold' }}>{title}</Text>
            <Text variant="dim" style={{ marginTop: 1 }}>{subtitle}</Text>
          </Box>
        </Box>
      </Pressable>
    </Animated.View>
  );
}

// ── OLD CODE (commented out, do not delete) ──────────────────────────────────
/*
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/src/context/ThemeContext';
import { getCurrentUserId } from '@/src/utils/auth';
import {
  sendMessage as sendAIMessage,
  getChatHistory,
  clearChatHistory,
  type ChatMessage,
  type MealItem,
} from '@/src/utils/ai';
import AIChatBubble from './AIChatBubble';

interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  mealItems?: MealItem[] | null;
}

interface AIChatProps {
  mode?: 'modal' | 'tab';
  visible?: boolean;
  onClose?: () => void;
  onLogItem?: (item: MealItem) => void;
}

const SUGGESTIONS: { icon: keyof typeof Feather.glyphMap; title: string; subtitle: string }[] = [
  { icon: 'trending-up', title: 'Plan my meals today', subtitle: 'Based on your remaining macros' },
  { icon: 'search', title: "What's high protein?", subtitle: 'Find meals that fit your goals' },
  { icon: 'clock', title: "What's open now?", subtitle: 'See available dining halls' },
];

export default function AIChat({ mode = 'tab', visible = true, onClose, onLogItem }: AIChatProps) {
  // ... old implementation with StyleSheet.create ...
}

function TypingIndicator({ color, bgColor }: { color: string; bgColor: string }) {
  return (
    <View style={[styles.typingRow]}>
      <View style={[styles.typingBubble, { backgroundColor: bgColor }]}>
        <BouncingDot color={color} delay={0} />
        <BouncingDot color={color} delay={150} />
        <BouncingDot color={color} delay={300} />
      </View>
    </View>
  );
}

function BouncingDot({ color, delay }: { color: string; delay: number }) {
  const translateY = useSharedValue(0);

  useEffect(() => {
    translateY.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(-5, { duration: 300 }),
          withTiming(0, { duration: 300 })
        ),
        -1,
        true
      )
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[styles.dot, { backgroundColor: color }, animStyle]} />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  containerTab: { paddingBottom: 0 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerSide: { width: 64 },
  headerTitle: { fontSize: 20 },
  headerAction: { fontSize: 15 },
  centerFill: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingTop: 16, paddingBottom: 8 },
  listEmpty: { flexGrow: 1 },
  emptyState: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16 },
  emptyTitle: { fontSize: 20, fontFamily: 'Outfit_600SemiBold', marginTop: 16 },
  emptySubtitle: { fontSize: 14, fontFamily: 'DMSans_400Regular', textAlign: 'center', maxWidth: 280, marginTop: 8, lineHeight: 20 },
  suggestionsWrap: { width: '100%', marginTop: 32, gap: 8 },
  suggestionCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, borderWidth: 1, padding: 14 },
  suggestionTitle: { fontSize: 15, fontFamily: 'DMSans_600SemiBold' },
  suggestionSub: { fontSize: 13, fontFamily: 'DMSans_400Regular', marginTop: 1 },
  errorRow: { alignItems: 'center', paddingHorizontal: 20, paddingVertical: 8, gap: 8 },
  errorText: { fontSize: 13, textAlign: 'center' },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 14, borderWidth: 1 },
  retryText: { fontSize: 14 },
  typingRow: { paddingHorizontal: 12, marginBottom: 10, alignItems: 'flex-start' },
  typingBubble: { flexDirection: 'row', gap: 5, borderRadius: 18, borderBottomLeftRadius: 4, paddingHorizontal: 16, paddingVertical: 12 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  inputRow: { paddingHorizontal: 12, paddingVertical: 10 },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', borderRadius: 24, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 6, gap: 4 },
  textInput: { flex: 1, fontSize: 15, maxHeight: 100, paddingTop: 8, paddingBottom: 8 },
  sendBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: 0 },
});
*/
