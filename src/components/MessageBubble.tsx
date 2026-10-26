import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Message } from '../types';

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
});
