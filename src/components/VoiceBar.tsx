import React, { useRef, useState } from 'react';
import { Dimensions, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { TalkIntent, TalkState } from '../hooks/useHoldToTalk';

/** 手指上滑超过这个距离进入顶部的取消 / 编辑区 */
const ZONE_DISTANCE = 90;

/** 手指当前所在区域：none = 松开发送 */
export type TalkZone = 'none' | 'cancel' | 'edit';

type Props = {
  state: TalkState;
  disabled?: boolean;
  onPressIn: () => void;
  onPressOut: (intent: TalkIntent) => void;
  onCancel: () => void;
  onZoneChange: (zone: TalkZone) => void;
};

/**
 * 输入行里的"按住说话"长条。
 * 上滑到屏幕上半区后：左半边是取消，右半边是编辑；不滑直接松手就是发送。
 * 直接用响应者系统而不是 Pressable：手指滑出按钮范围后仍要持续跟踪，直到松开。
 */
export function VoiceBar({ state, disabled, onPressIn, onPressOut, onCancel, onZoneChange }: Props) {
  const startYRef = useRef(0);
  const zoneRef = useRef<TalkZone>('none');
  const [pressed, setPressed] = useState(false);

  const setZone = (z: TalkZone) => {
    if (z === zoneRef.current) return;
    zoneRef.current = z;
    onZoneChange(z);
    Haptics.selectionAsync().catch(() => {});
  };

  const handleGrant = (e: GestureResponderEvent) => {
    startYRef.current = e.nativeEvent.pageY;
    setZone('none');
    setPressed(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onPressIn();
  };

  const handleMove = (e: GestureResponderEvent) => {
    if (state !== 'listening') return;
    const { pageX, pageY } = e.nativeEvent;
    if (startYRef.current - pageY < ZONE_DISTANCE) return setZone('none');
    setZone(pageX < Dimensions.get('window').width / 2 ? 'cancel' : 'edit');
  };

  /** 松手或被系统打断（来电等）都走这里，避免卡在录音状态 */
  const handleRelease = () => {
    const zone = zoneRef.current;
    setZone('none');
    setPressed(false);
    if (zone === 'cancel') onCancel();
    else onPressOut(zone === 'edit' ? 'edit' : 'send');
  };

  return (
    <View
      onStartShouldSetResponder={() => !disabled}
      onResponderTerminationRequest={() => false}
      onResponderGrant={handleGrant}
      onResponderMove={handleMove}
      onResponderRelease={handleRelease}
      onResponderTerminate={handleRelease}
      accessible
      accessibilityRole="button"
      accessibilityLabel="按住说话，松开发送"
      style={[styles.bar, (pressed || state !== 'idle') && styles.pressed, disabled && styles.disabled]}
    >
      <Text style={styles.label}>{state === 'idle' ? '按住 说话' : '松开 发送'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D0D0D5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { backgroundColor: '#E4E4E8' },
  disabled: { opacity: 0.5 },
  label: { fontSize: 16, fontWeight: '600', color: '#1A1A1A' },
});
