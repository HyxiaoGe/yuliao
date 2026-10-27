import React from 'react';
import { Alert, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Conversation } from '../types';

type Props = {
  visible: boolean;
  conversations: Conversation[];
  currentId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
};

export function ConversationList({ visible, conversations, currentId, onSelect, onDelete, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const confirmDelete = (c: Conversation) =>
    Alert.alert('删除对话', `确定删除「${c.title ?? '未命名'}」？`, [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: () => onDelete(c.id) },
    ]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.title}>历史对话</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.close}>关闭</Text>
          </Pressable>
        </View>
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
                {item.title ?? '未命名对话'}
              </Text>
              <Text style={styles.rowPreview} numberOfLines={1}>
                {item.last_message ?? ' '}
              </Text>
              <Text style={styles.rowTime}>{formatTime(item.updated_at)}</Text>
            </Pressable>
          )}
        />
        <Text style={[styles.hint, { paddingBottom: insets.bottom + 8 }]}>长按可删除</Text>
      </View>
    </Modal>
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
  root: { flex: 1, backgroundColor: '#F7F7F9' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#D0D0D5',
  },
  title: { fontSize: 17, fontWeight: '600', color: '#1A1A1A' },
  close: { fontSize: 16, color: '#1E6FFF' },
  empty: { textAlign: 'center', color: '#8A8A8E', marginTop: 48, fontSize: 15 },
  row: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E0E0E5', backgroundColor: '#FFFFFF' },
  rowActive: { backgroundColor: '#EAF1FF' },
  rowTitle: { fontSize: 16, color: '#1A1A1A', fontWeight: '500' },
  rowPreview: { fontSize: 14, color: '#6E6E73', marginTop: 4 },
  rowTime: { fontSize: 12, color: '#9A9AA0', marginTop: 4 },
  hint: { textAlign: 'center', color: '#9A9AA0', fontSize: 12, paddingTop: 8 },
});
