import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Message, Source } from '../types';

const MAX_SOURCES = 3;

/** 气泡底部的引用来源：显示域名+标题，点开用系统浏览器 */
function Sources({ sources }: { sources: Source[] }) {
  return (
    <View style={styles.sources}>
      <Text style={styles.sourcesLabel}>来源</Text>
      {sources.slice(0, MAX_SOURCES).map((s, i) => (
        <Pressable key={s.url} onPress={() => Linking.openURL(s.url).catch(() => {})} hitSlop={4} accessibilityRole="link">
          <Text style={styles.sourceItem} numberOfLines={1}>
            {i + 1}. {s.title}
            <Text style={styles.sourceHost}>  {hostOf(s.url)}</Text>
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function hostOf(url: string): string {
  const m = /^https?:\/\/([^/?#]+)/i.exec(url);
  return (m?.[1] ?? '').replace(/^www\./, '');
}

export const MessageBubble = React.memo(function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  const empty = !message.content && message.streaming;
  return (
    <View style={[styles.row, isUser ? styles.rowUser : styles.rowAssistant]}>
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
        {empty ? (
          <Text style={styles.thinking}>思考中…</Text>
        ) : (
          <Text style={[styles.text, isUser && styles.textUser]}>
            {message.content}
            {message.streaming ? <Text style={styles.cursor}>▍</Text> : null}
          </Text>
        )}
        {!message.streaming && message.sources?.length ? <Sources sources={message.sources} /> : null}
        {message.error ? <Text style={styles.error}>{message.error}</Text> : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', paddingHorizontal: 12, marginVertical: 4 },
  rowUser: { justifyContent: 'flex-end' },
  rowAssistant: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '78%', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 16 },
  bubbleUser: { backgroundColor: '#1E6FFF', borderBottomRightRadius: 4 },
  bubbleAssistant: { backgroundColor: '#FFFFFF', borderBottomLeftRadius: 4 },
  text: { fontSize: 16, lineHeight: 22, color: '#1A1A1A' },
  textUser: { color: '#FFFFFF' },
  thinking: { fontSize: 15, color: '#8A8A8E' },
  cursor: { color: '#1E6FFF' },
  error: { marginTop: 6, fontSize: 13, color: '#D7263D' },
  sources: { marginTop: 8, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E0E0E5', gap: 4 },
  sourcesLabel: { fontSize: 12, color: '#8A8A8E' },
  sourceItem: { fontSize: 13, lineHeight: 18, color: '#1E6FFF' },
  sourceHost: { fontSize: 12, color: '#8A8A8E' },
});
