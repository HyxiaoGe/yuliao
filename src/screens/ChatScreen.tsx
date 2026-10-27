import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Composer } from '../components/Composer';
import { ConversationList } from '../components/ConversationList';
import { MessageBubble } from '../components/MessageBubble';
import { useHoldToTalk } from '../hooks/useHoldToTalk';
import { assertLlmConfigured } from '../config';
import { api } from '../services/api';
import { localId, type Conversation, type Message } from '../types';

export function ChatScreen() {
  const insets = useSafeAreaInsets();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [listVisible, setListVisible] = useState(false);
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

  const refreshConversations = useCallback(async () => {
    const list = await api.listConversations();
    setConversations(list);
    return list;
  }, []);

  const openConversation = useCallback(
    async (id: string) => {
      setCurrentId(id);
      setLoadingMessages(true);
      try {
        setMessages(await api.listMessages(id));
      } catch (e: any) {
        showToast(e?.message ?? '加载消息失败');
      } finally {
        setLoadingMessages(false);
      }
    },
    [showToast],
  );

  // 启动：拉对话列表，打开最近一个
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const configError = assertLlmConfigured();
        if (configError) throw new Error(configError);
        const list = await api.listConversations();
        if (cancelled) return;
        setConversations(list);
        if (list[0]) await openConversation(list[0].id);
      } catch (e: any) {
        if (!cancelled) showToast(e?.message ?? '加载对话失败');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [openConversation, showToast]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const newConversation = useCallback(() => {
    if (sending) return;
    setCurrentId(null);
    setMessages([]);
    setListVisible(false);
  }, [sending]);

  const selectConversation = useCallback(
    (id: string) => {
      setListVisible(false);
      if (id !== currentId && !sending) openConversation(id);
    },
    [currentId, sending, openConversation],
  );

  const deleteConversation = useCallback(
    async (id: string) => {
      try {
        await api.deleteConversation(id);
        setConversations((prev) => prev.filter((c) => c.id !== id));
        if (id === currentId) {
          setCurrentId(null);
          setMessages([]);
        }
      } catch (e: any) {
        showToast(e?.message ?? '删除失败');
      }
    },
    [currentId, showToast],
  );

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    const configError = assertLlmConfigured();
    if (configError) {
      showToast(configError);
      return;
    }

    setSending(true);
    setInput('');
    const userMsg: Message = { id: localId(), role: 'user', content: text };
    const assistantId = localId();
    setMessages((prev) => [...prev, userMsg, { id: assistantId, role: 'assistant', content: '', streaming: true }]);

    const controller = new AbortController();
    abortRef.current = controller;

    // 流式增量先累积，按帧刷入 state，避免每个 token 触发一次渲染
    let pending = '';
    let flushTimer: ReturnType<typeof setTimeout> | null = null;
    const flush = () => {
      flushTimer = null;
      if (!pending) return;
      const chunk = pending;
      pending = '';
      setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + chunk } : m)));
    };
    const finish = (patch: Partial<Message>) => {
      if (flushTimer) clearTimeout(flushTimer);
      flush();
      setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, streaming: false, ...patch } : m)));
    };

    try {
      let convId = currentId;
      if (!convId) {
        const conv = await api.createConversation();
        convId = conv.id;
        setCurrentId(convId);
      }
      await api.sendMessage(
        convId,
        text,
        (delta) => {
          pending += delta;
          if (!flushTimer) flushTimer = setTimeout(flush, 40);
        },
        controller.signal,
      );
      finish({});
    } catch (err: any) {
      const aborted = controller.signal.aborted || err?.name === 'AbortError';
      finish({ error: aborted ? undefined : err?.message ?? '请求失败' });
      if (aborted) setMessages((prev) => prev.map((m) => (m.id === assistantId && !m.content ? { ...m, error: '已停止' } : m)));
    } finally {
      abortRef.current = null;
      setSending(false);
      refreshConversations().catch(() => {});
    }
  }, [input, sending, currentId, showToast, refreshConversations]);

  const stop = useCallback(() => abortRef.current?.abort(), []);

  const reversed = useMemo(() => [...messages].reverse(), [messages]);
  const currentTitle = conversations.find((c) => c.id === currentId)?.title ?? (currentId ? '对话' : '新对话');

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Pressable onPress={() => setListVisible(true)} hitSlop={12} style={styles.headerBtn}>
          <Text style={styles.headerBtnText}>历史</Text>
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          {currentTitle}
        </Text>
        <Pressable onPress={newConversation} hitSlop={12} style={[styles.headerBtn, styles.headerBtnRight]} disabled={sending}>
          <Text style={[styles.headerBtnText, sending && styles.disabledText]}>新对话</Text>
        </Pressable>
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
              {loadingMessages ? (
                <ActivityIndicator />
              ) : (
                <Text style={styles.emptyText}>按住下方按钮说话，松开后文字会填入输入框，确认后点发送。</Text>
              )}
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
      <ConversationList
        visible={listVisible}
        conversations={conversations}
        currentId={currentId}
        onSelect={selectConversation}
        onDelete={deleteConversation}
        onClose={() => setListVisible(false)}
      />
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7F7F9',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#D0D0D5',
    paddingBottom: 10,
    paddingHorizontal: 12,
  },
  headerBtn: { width: 56 },
  headerBtnRight: { alignItems: 'flex-end' },
  headerBtnText: { fontSize: 16, color: '#1E6FFF' },
  disabledText: { color: '#B9CCF5' },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600', color: '#1A1A1A' },
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
