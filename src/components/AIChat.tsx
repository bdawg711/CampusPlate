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
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
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

// ── Types ───────────────────────────────────────────────────────────────────

interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  mealItems?: MealItem[] | null;
}

interface AIChatProps {
  visible: boolean;
  onClose: () => void;
  onLogItem?: (item: MealItem) => void;
}

// ── Quick suggestion chips ──────────────────────────────────────────────────

const SUGGESTIONS = [
  'Plan my meals today',
  'High protein lunch',
  'What should I eat next?',
  'Low cal dinner',
];

// ── Component ───────────────────────────────────────────────────────────────

export default function AIChat({ visible, onClose, onLogItem }: AIChatProps) {
  const { colors } = useTheme();

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

      // Pass history WITHOUT the current message — sendMessage sends it separately
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
      // Remove the user message we optimistically added since the call failed
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

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* ── Header ── */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} style={styles.headerSide} activeOpacity={0.6}>
            <Text style={[styles.headerAction, { color: colors.textMuted, fontFamily: 'DMSans_500Medium' }]}>
              Close
            </Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text, fontFamily: 'Outfit_700Bold' }]}>
            AI Assistant
          </Text>
          <TouchableOpacity
            onPress={handleClear}
            style={[styles.headerSide, { alignItems: 'flex-end' }]}
            activeOpacity={0.6}
          >
            <Text style={[styles.headerAction, { color: colors.red, fontFamily: 'DMSans_500Medium' }]}>
              Clear
            </Text>
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 24}
        >
          {/* ── Messages ── */}
          {initialLoading ? (
            <View style={styles.centerFill}>
              <ActivityIndicator size="large" color={colors.maroon} />
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              style={{ flex: 1 }}
              data={messages}
              keyExtractor={(item) => item.id}
              contentContainerStyle={[
                styles.listContent,
                messages.length === 0 && styles.listEmpty,
              ]}
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
                  <View style={styles.chipsSection}>
                    <Text style={[styles.chipsLabel, { color: colors.textMuted, fontFamily: 'DMSans_400Regular' }]}>
                      Ask me anything about today's dining options
                    </Text>
                    <View style={styles.chipsWrap}>
                      {SUGGESTIONS.map((s) => (
                        <Pressable
                          key={s}
                          style={[styles.chip, { backgroundColor: colors.card, borderColor: colors.border }]}
                          onPress={() => handleSend(s)}
                        >
                          <Text style={[styles.chipText, { color: colors.text, fontFamily: 'DMSans_500Medium' }]}>
                            {s}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ) : null
              }
              ListFooterComponent={
                <>
                  {loading && <TypingIndicator color={colors.textMuted} bgColor={colors.card} />}
                  {errorMsg && !loading && (
                    <View style={styles.errorRow}>
                      <Text style={[styles.errorText, { color: colors.red, fontFamily: 'DMSans_400Regular' }]}>
                        {errorMsg}
                      </Text>
                      {lastFailedMessage && (
                        <TouchableOpacity
                          style={[styles.retryBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                          onPress={handleRetry}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.retryText, { color: colors.maroon, fontFamily: 'DMSans_600SemiBold' }]}>
                            Retry
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </>
              }
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            />
          )}

          {/* ── Input row (TextInput is explicit, never inside .map or conditional re-create) ── */}
          <View style={[styles.inputRow, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: colors.inputBorder,
                  color: colors.text,
                  fontFamily: 'DMSans_400Regular',
                },
              ]}
              value={input}
              onChangeText={setInput}
              placeholder="Ask about today's menu..."
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={500}
              returnKeyType="default"
              editable={!loading}
            />
            <TouchableOpacity
              style={[
                styles.sendBtn,
                { backgroundColor: input.trim() && !loading ? colors.maroon : colors.cardAlt },
              ]}
              onPress={() => handleSend()}
              disabled={!input.trim() || loading}
              activeOpacity={0.7}
            >
              <Text style={styles.sendIcon}>
                {loading ? '...' : '↑'}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ── Typing indicator (3 bouncing dots) ──────────────────────────────────────

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

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerSide: { width: 64 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17 },
  headerAction: { fontSize: 15 },

  // Center fill for loading
  centerFill: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // FlatList
  listContent: { paddingTop: 16, paddingBottom: 8 },
  listEmpty: { flexGrow: 1 },

  // Suggestion chips
  chipsSection: { paddingHorizontal: 20, paddingTop: 40, paddingBottom: 16, alignItems: 'center' },
  chipsLabel: { fontSize: 14, textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
  },
  chipText: { fontSize: 14 },

  // Error + retry
  errorRow: { alignItems: 'center', paddingHorizontal: 20, paddingVertical: 8, gap: 8 },
  errorText: { fontSize: 13, textAlign: 'center' },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
  },
  retryText: { fontSize: 14 },

  // Typing indicator
  typingRow: { paddingHorizontal: 12, marginBottom: 10, alignItems: 'flex-start' },
  typingBubble: {
    flexDirection: 'row',
    gap: 5,
    borderRadius: 14,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },

  // Input row
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    gap: 8,
  },
  textInput: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 15,
    maxHeight: 100,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  sendIcon: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
});
