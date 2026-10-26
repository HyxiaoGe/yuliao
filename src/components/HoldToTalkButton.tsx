import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { TalkState } from '../hooks/useHoldToTalk';

type Props = {
  state: TalkState;
  disabled?: boolean;
  onPressIn: () => void;
  onPressOut: () => void;
};

const LABEL: Record<TalkState, string> = {
  idle: '按住 说话',
  listening: '松开 结束',
  finishing: '识别中…',
};

export function HoldToTalkButton({ state, disabled, onPressIn, onPressOut }: Props) {
  return (
    <Pressable
      disabled={disabled}
      onPressIn={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        onPressIn();
      }}
      onPressOut={onPressOut}
      // 手指滑出按钮范围也视为松开，避免卡在录音状态
      onTouchCancel={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={LABEL[state]}
      style={({ pressed }) => [
        styles.button,
        state === 'listening' && styles.listening,
        state === 'finishing' && styles.finishing,
        disabled && styles.disabled,
        pressed && state === 'idle' && styles.pressed,
      ]}
    >
      <Text style={[styles.label, state === 'listening' && styles.labelActive]}>{LABEL[state]}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D0D0D5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { backgroundColor: '#F0F0F3' },
  listening: { backgroundColor: '#1E6FFF', borderColor: '#1E6FFF' },
  finishing: { backgroundColor: '#E8EEFB', borderColor: '#B9CCF5' },
  disabled: { opacity: 0.5 },
  label: { fontSize: 16, fontWeight: '600', color: '#1A1A1A' },
  labelActive: { color: '#FFFFFF' },
});
