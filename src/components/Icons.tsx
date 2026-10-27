import React from 'react';
import { StyleSheet, View } from 'react-native';

type Props = { color?: string; size?: number };

/** 三横线：打开历史对话抽屉 */
export function MenuIcon({ color = '#1A1A1A', size = 22 }: Props) {
  const bar = { width: size, height: 2, borderRadius: 1, backgroundColor: color };
  return (
    <View style={{ width: size, height: size, justifyContent: 'space-evenly' }}>
      <View style={bar} />
      <View style={bar} />
      <View style={bar} />
    </View>
  );
}

/** 圆角方框里的加号：新对话 */
export function NewChatIcon({ color = '#1A1A1A', size = 22 }: Props) {
  const len = size * 0.5;
  return (
    <View style={[styles.box, { width: size, height: size, borderRadius: size * 0.28, borderColor: color }]}>
      <View style={{ position: 'absolute', width: len, height: 2, borderRadius: 1, backgroundColor: color }} />
      <View style={{ position: 'absolute', width: 2, height: len, borderRadius: 1, backgroundColor: color }} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
