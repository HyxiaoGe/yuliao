import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { VoiceBar, type TalkZone } from './VoiceBar';
import type { TalkIntent, TalkState } from '../hooks/useHoldToTalk';

export type InputMode = 'keyboard' | 'voice';

type Props = {
  mode: InputMode;
  onModeChange: (m: InputMode) => void;
  value: string;
  onChangeText: (t: string) => void;
  onSend: () => void;
  onStop: () => void;
  sending: boolean;
  talk: {
    state: TalkState;
    pressIn: () => void;
    pressOut: (intent: TalkIntent) => void;
    cancel: () => void;
  };
  onZoneChange: (zone: TalkZone) => void;
  bottomInset: number;
};

/**
 * 输入区：左侧切换键在"键盘 / 语音"两种模式间切换，中间是输入框或"按住说话"长条。
 * 录音浮层由页面层渲染（需要盖住整屏）。
 */
export function Composer({ mode, onModeChange, value, onChangeText, onSend, onStop, sending, talk, onZoneChange, bottomInset }: Props) {
  const talking = talk.state !== 'idle';
  const canSend = value.trim().length > 0 && !sending && !talking;
  const hasDraft = value.trim().length > 0;

  return (
    <View style={[styles.container, { paddingBottom: Math.max(bottomInset, 8) }]}>
      <View style={styles.inputRow}>
        <Pressable
          onPress={() => onModeChange(mode === 'voice' ? 'keyboard' : 'voice')}
          disabled={talking}
          hitSlop={8}
          style={[styles.modeBtn, talking && styles.disabled]}
          accessibilityLabel={mode === 'voice' ? '切换到键盘输入' : '切换到语音输入'}
        >
          <Text style={styles.modeIcon}>{mode === 'voice' ? '⌨️' : '🎤'}</Text>
        </Pressable>

        {mode === 'voice' ? (
          <VoiceBar
            state={talk.state}
            disabled={sending}
            onPressIn={talk.pressIn}
            onPressOut={talk.pressOut}
            onCancel={talk.cancel}
            onZoneChange={onZoneChange}
          />
        ) : (
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={onChangeText}
            placeholder="输入消息"
            placeholderTextColor="#9A9AA0"
            multiline
            autoFocus
            maxLength={2000}
          />
        )}

        {sending ? (
          <Pressable onPress={onStop} style={[styles.sendBtn, styles.stopBtn]} accessibilityLabel="停止生成">
            <Text style={styles.sendText}>停止</Text>
          </Pressable>
        ) : mode === 'keyboard' || hasDraft ? (
          <Pressable onPress={onSend} disabled={!canSend} style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]} accessibilityLabel="发送">
            <Text style={styles.sendText}>发送</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingTop: 8,
    backgroundColor: '#F7F7F9',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#D0D0D5',
  },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  modeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D0D0D5',
  },
  modeIcon: { fontSize: 20 },
  disabled: { opacity: 0.5 },
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
