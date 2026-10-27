import React, { useEffect, useState } from 'react';
import { Animated, Dimensions, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { TalkState } from '../hooks/useHoldToTalk';
import type { TalkZone } from './VoiceBar';

type Props = {
  state: TalkState;
  transcript: string;
  /** 0..1 */
  volume: number;
  zone: TalkZone;
};

const BARS = [0.45, 0.7, 0.9, 1, 0.9, 0.7, 0.45];
const ARC_HEIGHT = 150;

/**
 * 按住说话时的全屏浮层：顶部左右两个"取消 / 编辑"区，中间实时识别气泡，底部一道弧形区域提示松手动作。
 * 松开直接发送；上滑到左上取消，右上转文字编辑。
 */
export function VoiceOverlay({ state, transcript, volume, zone }: Props) {
  const insets = useSafeAreaInsets();
  const [anims] = useState(() => BARS.map(() => new Animated.Value(0)));
  const { width } = Dimensions.get('window');

  useEffect(() => {
    if (state !== 'listening') return;
    Animated.parallel(
      anims.map((a, i) =>
        Animated.spring(a, {
          toValue: Math.min(1, volume * BARS[i] * 1.6 + (volume > 0.05 ? Math.random() * 0.15 : 0)),
          useNativeDriver: false,
          speed: 40,
          bounciness: 6,
        }),
      ),
    ).start();
  }, [volume, state, anims]);

  if (state === 'idle') return null;
  const listening = state === 'listening';
  const arcLabel = !listening ? '识别中…' : zone === 'cancel' ? '松开 取消' : zone === 'edit' ? '松开 编辑' : '松开 发送';

  return (
    <View pointerEvents="none" style={styles.root}>
      {listening ? (
        <View style={[styles.zones, { top: insets.top + 64 }]}>
          <View style={[styles.zone, styles.zoneLeft, zone === 'cancel' && styles.zoneActive]}>
            <Text style={[styles.zoneText, zone === 'cancel' && styles.zoneTextActive]}>取消</Text>
          </View>
          <View style={[styles.zone, styles.zoneRight, zone === 'edit' && styles.zoneActive]}>
            <Text style={[styles.zoneText, zone === 'edit' && styles.zoneTextActive]}>编辑</Text>
          </View>
        </View>
      ) : null}

      <View style={[styles.bubbleWrap, { bottom: ARC_HEIGHT + 56 }]}>
        <View style={[styles.bubble, zone === 'cancel' && styles.bubbleCancel, zone === 'edit' && styles.bubbleEdit]}>
          {listening && zone === 'none' ? (
            <View style={styles.bars}>
              {anims.map((a, i) => (
                <Animated.View key={i} style={[styles.barItem, { height: a.interpolate({ inputRange: [0, 1], outputRange: [6, 32] }) }]} />
              ))}
            </View>
          ) : null}
          <Text style={[styles.transcript, !transcript && styles.placeholder]} numberOfLines={5}>
            {transcript || (listening ? '正在聆听…' : '识别中…')}
          </Text>
        </View>
      </View>

      {/* 底部弧形：一个超大圆只露出顶部一段 */}
      <View
        style={[
          styles.arc,
          zone === 'cancel' && styles.arcCancel,
          { width: width * 2.4, height: width * 2.4, borderRadius: width * 1.2, left: -width * 0.7, bottom: -(width * 2.4 - ARC_HEIGHT) },
        ]}
      >
        <Text style={[styles.arcLabel, { marginTop: 36 }]}>{arcLabel}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(28,28,30,0.88)', overflow: 'hidden' },
  zones: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 28 },
  zone: {
    width: 108,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoneLeft: { transform: [{ rotate: '-10deg' }] },
  zoneRight: { transform: [{ rotate: '10deg' }] },
  zoneActive: { backgroundColor: '#FFFFFF', transform: [{ scale: 1.08 }] },
  zoneText: { color: 'rgba(255,255,255,0.85)', fontSize: 17, fontWeight: '500' },
  zoneTextActive: { color: '#1A1A1A' },
  bubbleWrap: { position: 'absolute', left: 24, right: 24, alignItems: 'center' },
  bubble: {
    minWidth: 160,
    maxWidth: '100%',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#1E6FFF',
    alignItems: 'center',
  },
  bubbleCancel: { backgroundColor: '#D7263D' },
  bubbleEdit: { backgroundColor: '#2C9A5B' },
  bars: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 34, marginBottom: 8 },
  barItem: { width: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.9)' },
  transcript: { color: '#FFFFFF', fontSize: 16, lineHeight: 22, textAlign: 'center' },
  placeholder: { color: 'rgba(255,255,255,0.75)' },
  arc: { position: 'absolute', backgroundColor: '#B8B8BC', alignItems: 'center' },
  arcCancel: { backgroundColor: '#8E8E93' },
  arcLabel: { color: '#1A1A1A', fontSize: 16, fontWeight: '600' },
});
