import React, { useEffect, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Conversation } from "../types";

const WINDOW_W = Dimensions.get("window").width;
const DRAWER_W = Math.min(320, Math.round(WINDOW_W * 0.8));

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversations: Conversation[];
  currentId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
};

/**
 * 左侧历史对话抽屉。顶部按钮打开，点暗区收起；open 由父组件控制。
 * 曾做过左缘跟手滑动，真机上感觉卡顿，已去掉。
 */
export function ConversationDrawer({
  open,
  onOpenChange,
  conversations,
  currentId,
  onSelect,
  onDelete,
}: Props) {
  const insets = useSafeAreaInsets();
  const [x] = useState(() => new Animated.Value(-DRAWER_W));
  /** 收起动画播完再卸载面板 */
  const [mounted, setMounted] = useState(open);
  // 打开时在渲染阶段同步挂载（React 允许同组件在渲染中 setState），收起则等动画播完
  if (open && !mounted) setMounted(true);

  useEffect(() => {
    const anim = Animated.spring(x, {
      toValue: open ? 0 : -DRAWER_W,
      useNativeDriver: true,
      speed: 18,
      bounciness: 2,
    });
    anim.start(({ finished }) => {
      if (finished && !open) setMounted(false);
    });
    return () => anim.stop();
  }, [open, x]);

  const confirmDelete = (c: Conversation) =>
    Alert.alert("删除对话", `确定删除「${c.title ?? "未命名"}」？`, [
      { text: "取消", style: "cancel" },
      { text: "删除", style: "destructive", onPress: () => onDelete(c.id) },
    ]);

  const backdropOpacity = x.interpolate({
    inputRange: [-DRAWER_W, 0],
    outputRange: [0, 1],
  });

  if (!mounted) return null;

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <Pressable
          style={styles.flex}
          onPress={() => onOpenChange(false)}
          accessibilityLabel="关闭历史对话"
        />
      </Animated.View>
      <Animated.View
        style={[
          styles.panel,
          {
            width: DRAWER_W,
            paddingTop: insets.top,
            transform: [{ translateX: x }],
          },
        ]}
      >
        <Text style={styles.title}>历史对话</Text>
        <FlatList
          data={conversations}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
          ListEmptyComponent={<Text style={styles.empty}>还没有对话</Text>}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => onSelect(item.id)}
              onLongPress={() => confirmDelete(item)}
              style={[styles.row, item.id === currentId && styles.rowActive]}
            >
              <Text style={styles.rowTitle} numberOfLines={1}>
                {item.title ?? "未命名对话"}
              </Text>
              <Text style={styles.rowPreview} numberOfLines={1}>
                {item.last_message ?? " "}
              </Text>
              <Text style={styles.rowTime}>{formatTime(item.updated_at)}</Text>
            </Pressable>
          )}
        />
        <Text style={[styles.hint, { paddingBottom: insets.bottom + 8 }]}>
          长按可删除
        </Text>
      </Animated.View>
    </View>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const hh = `${d.getHours()}`.padStart(2, "0");
  const mm = `${d.getMinutes()}`.padStart(2, "0");
  return sameDay
    ? `${hh}:${mm}`
    : `${d.getMonth() + 1}/${d.getDate()} ${hh}:${mm}`;
}

const styles = StyleSheet.create({
  root: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  flex: { flex: 1 },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  panel: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: "#F7F7F9",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 2, height: 0 },
  },
  title: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1A1A1A",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#D0D0D5",
  },
  empty: { textAlign: "center", color: "#8A8A8E", marginTop: 48, fontSize: 15 },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E0E0E5",
    backgroundColor: "#FFFFFF",
  },
  rowActive: { backgroundColor: "#EAF1FF" },
  rowTitle: { fontSize: 16, color: "#1A1A1A", fontWeight: "500" },
  rowPreview: { fontSize: 14, color: "#6E6E73", marginTop: 4 },
  rowTime: { fontSize: 12, color: "#9A9AA0", marginTop: 4 },
  hint: { textAlign: "center", color: "#9A9AA0", fontSize: 12, paddingTop: 8 },
});
