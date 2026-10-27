import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Animated, Dimensions, FlatList, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Conversation } from '../types';

const WINDOW_W = Dimensions.get('window').width;
const DRAWER_W = Math.min(320, Math.round(WINDOW_W * 0.8));
/** 屏幕左缘多宽的区域响应"右滑拉出"手势 */
const EDGE_W = 24;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversations: Conversation[];
  currentId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
};

const clamp = (v: number) => Math.max(-DRAWER_W, Math.min(0, v));

/**
 * 左侧历史对话抽屉。从屏幕左缘右滑跟手拉出，松手过 1/3 或甩得够快就展开；
 * 抽屉上左滑或点暗区收起。open 由父组件控制（顶部按钮也能打开）。
 */
export function ConversationDrawer({ open, onOpenChange, conversations, currentId, onSelect, onDelete }: Props) {
  const insets = useSafeAreaInsets();
  const [x] = useState(() => new Animated.Value(-DRAWER_W));
  /** 拖动中也要渲染面板与暗区 */
  const [dragging, setDragging] = useState(false);

  /** 松手后归位；同步告知父组件（父组件 setState 同值是空操作，无需比较） */
  const settle = useCallback(
    (toOpen: boolean) => {
      Animated.spring(x, { toValue: toOpen ? 0 : -DRAWER_W, useNativeDriver: true, speed: 18, bounciness: 2 }).start(() => setDragging(false));
      onOpenChange(toOpen);
    },
    [x, onOpenChange],
  );

  useEffect(() => {
    Animated.spring(x, { toValue: open ? 0 : -DRAWER_W, useNativeDriver: true, speed: 18, bounciness: 2 }).start();
  }, [open, x]);

  const edgePan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, g) => g.dx > 4 && Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderGrant: () => setDragging(true),
        onPanResponderMove: (_, g) => x.setValue(clamp(-DRAWER_W + g.dx)),
        onPanResponderRelease: (_, g) => settle(g.dx > DRAWER_W / 3 || g.vx > 0.5),
        onPanResponderTerminate: () => settle(false),
      }),
    [x, settle],
  );
  const panelPan = useMemo(
    () =>
      PanResponder.create({
        // 用 capture：行是 Pressable，按下即成为响应者，父级要在移动阶段抢过来
        onMoveShouldSetPanResponderCapture: (_, g) => g.dx < -8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
        onPanResponderGrant: () => setDragging(true),
        onPanResponderMove: (_, g) => x.setValue(clamp(g.dx)),
        onPanResponderRelease: (_, g) => settle(!(g.dx < -DRAWER_W / 3 || g.vx < -0.5)),
        onPanResponderTerminate: () => settle(true),
      }),
    [x, settle],
  );

  const confirmDelete = (c: Conversation) =>
    Alert.alert('删除对话', `确定删除「${c.title ?? '未命名'}」？`, [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: () => onDelete(c.id) },
    ]);

  const mounted = open || dragging;
  const backdropOpacity = x.interpolate({ inputRange: [-DRAWER_W, 0], outputRange: [0, 1] });

  return (
    <View style={styles.root} pointerEvents="box-none">
      {mounted ? (
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <Pressable style={styles.flex} onPress={() => settle(false)} accessibilityLabel="关闭历史对话" />
        </Animated.View>
      ) : null}
      {mounted ? (
        <Animated.View style={[styles.panel, { width: DRAWER_W, paddingTop: insets.top, transform: [{ translateX: x }] }]} {...panelPan.panHandlers}>
          <Text style={styles.title}>历史对话</Text>
          <FlatList
            data={conversations}
            keyExtractor={(c) => c.id}
            contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
            ListEmptyComponent={<Text style={styles.empty}>还没有对话</Text>}
            renderItem={({ item }) => (
              <Pressable onPress={() => onSelect(item.id)} onLongPress={() => confirmDelete(item)} style={[styles.row, item.id === currentId && styles.rowActive]}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {item.title ?? '未命名对话'}
                </Text>
                <Text style={styles.rowPreview} numberOfLines={1}>
                  {item.last_message ?? ' '}
                </Text>
                <Text style={styles.rowTime}>{formatTime(item.updated_at)}</Text>
              </Pressable>
            )}
          />
          <Text style={[styles.hint, { paddingBottom: insets.bottom + 8 }]}>长按可删除 · 左滑收起</Text>
        </Animated.View>
      ) : (
        // 避开顶部按钮和底部输入区，否则左缘那一条会吃掉它们的点击
        <View style={[styles.edge, { width: EDGE_W, top: insets.top + 48, bottom: insets.bottom + 64 }]} {...edgePan.panHandlers} />
      )}
    </View>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const hh = `${d.getHours()}`.padStart(2, '0');
  const mm = `${d.getMinutes()}`.padStart(2, '0');
  return sameDay ? `${hh}:${mm}` : `${d.getMonth() + 1}/${d.getDate()} ${hh}:${mm}`;
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  flex: { flex: 1 },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)' },
  edge: { position: 'absolute', left: 0 },
  panel: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: '#F7F7F9',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 2, height: 0 },
  },
  title: { fontSize: 17, fontWeight: '600', color: '#1A1A1A', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#D0D0D5' },
  empty: { textAlign: 'center', color: '#8A8A8E', marginTop: 48, fontSize: 15 },
  row: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E0E0E5', backgroundColor: '#FFFFFF' },
  rowActive: { backgroundColor: '#EAF1FF' },
  rowTitle: { fontSize: 16, color: '#1A1A1A', fontWeight: '500' },
  rowPreview: { fontSize: 14, color: '#6E6E73', marginTop: 4 },
  rowTime: { fontSize: 12, color: '#9A9AA0', marginTop: 4 },
  hint: { textAlign: 'center', color: '#9A9AA0', fontSize: 12, paddingTop: 8 },
});
