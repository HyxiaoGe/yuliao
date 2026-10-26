import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Composer } from '../components/Composer';
import { MessageBubble } from '../components/MessageBubble';
import { useHoldToTalk } from '../hooks/useHoldToTalk';
import { assertLlmConfigured, config } from '../config';
import { streamChat } from '../services/llm';
import { newId, type ChatTurn, type Message } from '../types';

export function ChatScreen() {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  /** 按下说话时输入框里已有的文字，识别结果追加在其后 */
  const draftBaseRef = useRef('');

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((cur) => (cur === msg ? null : cur)), 3000);
  }, []);

  const talk = useHoldToTalk({
    onInterim: (text) => setInput(joinDraft(draftBaseRef.current, text)),
    onFinal: (text) => setInput(joinDraft(draftBaseRef.current, text)),
    onError: showToast,
  });

  const { pressIn: talkPressIn } = talk;
  const onTalkPressIn = useCallback(() => {
    draftBaseRef.current = input;
    talkPressIn();
  }, [input, talkPressIn]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    const configError = assertLlmConfigured();
    if (configError) {
      showToast(configError);
      return;
    }

    const userMsg: Message = { id: newId(), role: 'user', content: text, createdAt: Date.now() };
    const assistantId = newId();
    const assistantMsg: Message = { id: assistantId, role: 'assistant', content: '', createdAt: Date.now(), streaming: true };
    const history = [...messages, userMsg];
    setMessages([...history, assistantMsg]);
    setInput('');
    setSending(true);

    const turns: ChatTurn[] = [
      { role: 'system', content: config.systemPrompt },
      ...history.filter((m) => m.content && !m.error).slice(-config.historyLimit).map((m) => ({ role: m.role, content: m.content })),
    ];

    const controller = new AbortController();
    abortRef.current = controller;

    // 流式增量先累积在 ref 里，按帧刷入 state，避免每个 token 触发一次渲染
    let pending = '';
    let flushTimer: ReturnType<typeof setTimeout> | null = null;
    const flush = () => {
      flushTimer = null;
      if (!pending) return;
      const chunk = pending;
      pending = '';
      setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + chunk } : m)));
    };

    try {
      await streamChat(
        turns,
        (delta) => {
          pending += delta;
          if (!flushTimer) flushTimer = setTimeout(flush, 40);
        },
        controller.signal,
      );
      if (flushTimer) clearTimeout(flushTimer);
      flush();
      setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, streaming: false } : m)));
    } catch (err: any) {
      if (flushTimer) clearTimeout(flushTimer);
      flush();
      const aborted = controller.signal.aborted || err?.name === 'AbortError';
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, streaming: false, error: aborted ? (m.content ? undefined : '已停止') : err?.message ?? '请求失败' }
            : m,
        ),
      );
    } finally {
      abortRef.current = null;
      setSending(false);
    }
  }, [input, sending, messages, showToast]);

  const stop = useCallback(() => abortRef.current?.abort(), []);

  const reversed = useMemo(() => [...messages].reverse(), [messages]);

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Text style={styles.title}>语聊</Text>
      </View>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          style={styles.flex}
          data={reversed}
          inverted
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => <MessageBubble message={item} />}
          contentContainerStyle={styles.listContent}
          keyboardDismissMode="interactive"
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>按住下方按钮说话，松开后文字会填入输入框，确认后点发送。</Text>
            </View>
          }
        />
        {toast ? (
          <View style={styles.toast}>
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        ) : null}
        <Composer
          value={input}
          onChangeText={setInput}
          onSend={send}
          onStop={stop}
          sending={sending}
          talkState={talk.state}
          onTalkPressIn={onTalkPressIn}
          onTalkPressOut={talk.pressOut}
          bottomInset={insets.bottom}
        />
      </KeyboardAvoidingView>
    </View>
  );
}

function joinDraft(base: string, text: string): string {
  if (!base) return text;
  if (!text) return base;
  return /\s$/.test(base) ? base + text : `${base} ${text}`;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#EDEDF0' },
  flex: { flex: 1 },
  header: {
    backgroundColor: '#F7F7F9',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#D0D0D5',
    alignItems: 'center',
    paddingBottom: 10,
  },
  title: { fontSize: 17, fontWeight: '600', color: '#1A1A1A' },
  listContent: { paddingVertical: 8, flexGrow: 1 },
  // inverted 列表里空态会被翻转，再翻回来
  empty: { flex: 1, transform: [{ scaleY: -1 }], alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyText: { color: '#8A8A8E', fontSize: 15, textAlign: 'center', lineHeight: 22 },
  toast: {
    alignSelf: 'center',
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.75)',
  },
  toastText: { color: '#FFFFFF', fontSize: 14 },
});
