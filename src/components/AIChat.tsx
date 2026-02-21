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

// ── Time-aware helpers ───────────────────────────────────────────────────────

type MealPeriod = 'breakfast' | 'lunch' | 'dinner';

function getCurrentMealPeriod(): MealPeriod {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const timeVal = hours * 60 + minutes;
  if (timeVal < 10 * 60 + 30) return 'breakfast';
  if (timeVal < 16 * 60) return 'lunch';
  return 'dinner';
}

function getTimeSuggestions(): { icon: keyof typeof Feather.glyphMap; title: string; subtitle: string }[] {
  const period = getCurrentMealPeriod();
  if (period === 'breakfast') {
    return [
      { icon: 'sunrise', title: "What's good for breakfast right now?", subtitle: 'See what dining halls are serving' },
      { icon: 'target', title: 'High-protein breakfast options', subtitle: 'Start your day strong' },
      { icon: 'zap', title: 'Quick breakfast under 500 calories', subtitle: 'For when you\'re running late' },
    ];
  }
  if (period === 'lunch') {
    return [
      { icon: 'search', title: "What's high-protein at D2 right now?", subtitle: 'Find meals that fit your goals' },
      { icon: 'target', title: 'Plan my lunch under 800 calories', subtitle: 'Based on your remaining budget' },
      { icon: 'trending-up', title: 'What should I eat to hit my protein goal?', subtitle: 'Close your macro gaps' },
    ];
  }
  // dinner
  return [
    { icon: 'moon', title: "What's good for dinner right now?", subtitle: 'See what dining halls are serving' },
    { icon: 'target', title: 'Plan my dinner under 800 calories', subtitle: 'Based on your remaining budget' },
    { icon: 'trending-up', title: 'What should I eat to hit my protein goal?', subtitle: 'Close your macro gaps today' },
  ];
}

function getPlaceholder(): string {
  const period = getCurrentMealPeriod();
  if (period === 'breakfast') return 'Ask about breakfast...';
  if (period === 'lunch') return 'Ask about lunch...';
  return 'Ask about dinner...';
}

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
                    {getTimeSuggestions().map((s) => (
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
              placeholder={getPlaceholder()}
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
