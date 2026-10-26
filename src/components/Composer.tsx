import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { HoldToTalkButton } from './HoldToTalkButton';
import type { TalkState } from '../hooks/useHoldToTalk';

type Props = {
  value: string;
  onChangeText: (t: string) => void;
  onSend: () => void;
  onStop: () => void;
  sending: boolean;
  talkState: TalkState;
  onTalkPressIn: () => void;
  onTalkPressOut: () => void;
  bottomInset: number;
};

export function Composer(props: Props) {
  const { value, onChangeText, onSend, onStop, sending, talkState, onTalkPressIn, onTalkPressOut, bottomInset } = props;
  const canSend = value.trim().length > 0 && !sending && talkState === 'idle';
  const listening = talkState !== 'idle';

  return (
    <View style={[styles.container, { paddingBottom: Math.max(bottomInset, 8) }]}>
      <View style={styles.inputRow}>
        <TextInput
          style={[styles.input, listening && styles.inputListening]}
          value={value}
          onChangeText={onChangeText}
          placeholder={listening ? '正在聆听…' : '输入消息，或按住下方按钮说话'}
          placeholderTextColor="#9A9AA0"
          multiline
          editable={!listening}
          maxLength={2000}
        />
        {sending ? (
          <Pressable onPress={onStop} style={[styles.sendBtn, styles.stopBtn]} accessibilityLabel="停止生成">
            <Text style={styles.sendText}>停止</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={onSend}
            disabled={!canSend}
            style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
            accessibilityLabel="发送"
          >
            <Text style={styles.sendText}>发送</Text>
          </Pressable>
        )}
      </View>
      <HoldToTalkButton state={talkState} disabled={sending} onPressIn={onTalkPressIn} onPressOut={onTalkPressOut} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingTop: 8,
    gap: 8,
    backgroundColor: '#F7F7F9',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#D0D0D5',
  },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D0D0D5',
    color: '#1A1A1A',
  },
  inputListening: { borderColor: '#1E6FFF', borderWidth: 1 },
  sendBtn: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#1E6FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#B9CCF5' },
  stopBtn: { backgroundColor: '#D7263D' },
  sendText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
});
