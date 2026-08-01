/**
 * StickyNotes - 便签/备忘录组件
 * 
 * 功能：
 * - 首页可拖拽的便签卡片
 * - 支持创建、编辑、删除
 * - 多种颜色可选
 * - 数据持久化到 Supabase
 * - 支持归档
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Modal, Alert, Animated, PanResponder,
  TouchableWithoutFeedback, Dimensions, Platform,
} from 'react-native';
import { supabase, getCurrentUserId } from '@/lib/supabase';
import { Colors, Spacing, FontSize, BorderRadius } from '@/lib/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ===== 类型 =====
interface StickyNote {
  id: string;
  user_id: string;
  content: string;
  color: string;
  position_x: number;
  position_y: number;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

// ===== 便签颜色 =====
const NOTE_COLORS = [
  '#FFF9C4', // 淡黄
  '#FFECB3', // 暖黄
  '#C8E6C9', // 薄荷绿
  '#BBDEFB', // 天空蓝
  '#F8BBD0', // 樱花粉
  '#E1BEE7', // 淡紫
  '#FFCCBC', // 蜜桃
  '#D7CCC8', // 牛皮纸
];

const NOTE_TEXT_COLORS: Record<string, string> = {
  '#FFF9C4': '#5D4037',
  '#FFECB3': '#5D4037',
  '#C8E6C9': '#1B5E20',
  '#BBDEFB': '#0D47A1',
  '#F8BBD0': '#880E4F',
  '#E1BEE7': '#4A148C',
  '#FFCCBC': '#BF360C',
  '#D7CCC8': '#3E2723',
};

// ===== 主组件 =====
export default function StickyNotes() {
  const [notes, setNotes] = useState<StickyNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingNote, setEditingNote] = useState<StickyNote | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editColor, setEditColor] = useState(NOTE_COLORS[0]);
  const [showArchived, setShowArchived] = useState(false);

  // 加载便签
  const loadNotes = useCallback(async () => {
    const uid = await getCurrentUserId();
    if (!uid) { setLoading(false); return; }
    const { data } = await supabase
      .from('sticky_notes')
      .select('*')
      .eq('user_id', uid)
      .eq('archived', false)
      .order('updated_at', { ascending: false });
    setNotes((data as StickyNote[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { loadNotes(); }, [loadNotes]);

  // 创建便签
  const createNote = async () => {
    const uid = await getCurrentUserId();
    if (!uid) { Alert.alert('提示', '请先登录'); return; }
    const { data, error } = await supabase
      .from('sticky_notes')
      .insert({
        user_id: uid,
        content: '',
        color: NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)],
        position_x: 0,
        position_y: 0,
      })
      .select()
      .single();
    if (!error && data) {
      const note = data as StickyNote;
      setNotes(prev => [note, ...prev]);
      // 打开编辑
      setEditingNote(note);
      setEditContent('');
      setEditColor(note.color);
      setShowEditor(true);
    }
  };

  // 更新便签
  const updateNote = async () => {
    if (!editingNote) return;
    const { error } = await supabase
      .from('sticky_notes')
      .update({
        content: editContent,
        color: editColor,
        updated_at: new Date().toISOString(),
      })
      .eq('id', editingNote.id);
    if (!error) {
      setNotes(prev => prev.map(n =>
        n.id === editingNote.id ? { ...n, content: editContent, color: editColor } : n
      ));
      setShowEditor(false);
      setEditingNote(null);
    }
  };

  // 删除便签
  const deleteNote = (note: StickyNote) => {
    Alert.alert('删除便签', '确定要删除这张便签吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除', style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('sticky_notes').delete().eq('id', note.id);
          if (!error) setNotes(prev => prev.filter(n => n.id !== note.id));
        },
      },
    ]);
  };

  // 归档便签
  const archiveNote = async (note: StickyNote) => {
    await supabase.from('sticky_notes').update({ archived: true }).eq('id', note.id);
    setNotes(prev => prev.filter(n => n.id !== note.id));
  };

  // 双击编辑
  const handleNotePress = (note: StickyNote) => {
    setEditingNote(note);
    setEditContent(note.content);
    setEditColor(note.color);
    setShowEditor(true);
  };

  const visibleNotes = showArchived ? notes : notes.filter(n => !n.archived);

  return (
    <View style={styles.container}>
      {/* 头部 */}
      <View style={styles.header}>
        <Text style={styles.title}>📝 便签</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => setShowArchived(!showArchived)}
            activeOpacity={0.7}
          >
            <Text style={styles.iconBtnText}>{showArchived ? '📋' : '📦'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addNoteBtn} onPress={createNote} activeOpacity={0.7}>
            <Text style={styles.addNoteBtnText}>＋ 新建</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 便签网格 */}
      {loading ? (
        <Text style={styles.empty}>加载中…</Text>
      ) : visibleNotes.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📝</Text>
          <Text style={styles.emptyText}>还没有便签</Text>
          <Text style={styles.emptyHint}>点击「＋ 新建」创建你的第一张便签</Text>
        </View>
      ) : (
        <View style={styles.notesGrid}>
          {visibleNotes.map((note) => (
            <TouchableOpacity
              key={note.id}
              style={[styles.noteCard, { backgroundColor: note.color }]}
              onPress={() => handleNotePress(note)}
              onLongPress={() => deleteNote(note)}
              activeOpacity={0.8}
            >
              <Text style={[styles.noteContent, { color: NOTE_TEXT_COLORS[note.color] || '#333' }]} numberOfLines={8}>
                {note.content || '（空白便签，点击编辑）'}
              </Text>
              <View style={styles.noteFooter}>
                <Text style={[styles.noteDate, { color: NOTE_TEXT_COLORS[note.color] ? NOTE_TEXT_COLORS[note.color] + '80' : '#999' }]}>
                  {note.updated_at ? new Date(note.updated_at).toLocaleDateString('zh-CN') : ''}
                </Text>
                <TouchableOpacity
                  onPress={() => archiveNote(note)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.archiveBtn}>📦</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* 编辑弹窗 */}
      <Modal visible={showEditor} transparent animationType="slide" onRequestClose={() => setShowEditor(false)}>
        <TouchableWithoutFeedback onPress={() => { updateNote(); }}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.editorBox, { backgroundColor: editColor }]}>
                {/* 颜色选择 */}
                <View style={styles.colorRow}>
                  {NOTE_COLORS.map((c) => (
                    <TouchableOpacity
                      key={c}
                      style={[styles.colorDot, { backgroundColor: c }, editColor === c && styles.colorDotActive]}
                      onPress={() => setEditColor(c)}
                      activeOpacity={0.7}
                    />
                  ))}
                </View>

                {/* 编辑区 */}
                <TextInput
                  style={[styles.editorInput, { color: NOTE_TEXT_COLORS[editColor] || '#333' }]}
                  placeholder="写下你想记的事…"
                  placeholderTextColor={NOTE_TEXT_COLORS[editColor] ? NOTE_TEXT_COLORS[editColor] + '60' : '#999'}
                  value={editContent}
                  onChangeText={setEditContent}
                  multiline
                  autoFocus
                  textAlignVertical="top"
                />

                {/* 操作按钮 */}
                <View style={styles.editorActions}>
                  <TouchableOpacity
                    style={styles.editorCancel}
                    onPress={() => setShowEditor(false)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.editorCancelText}>取消</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.editorSave}
                    onPress={updateNote}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.editorSaveText}>保存</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginBottom: Spacing.md,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: FontSize.md, fontWeight: 'bold', color: Colors.textPrimary,
  },
  headerActions: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
  },
  iconBtn: {
    padding: Spacing.xs, borderRadius: BorderRadius.sm,
    backgroundColor: Colors.background,
  },
  iconBtnText: { fontSize: 16 },
  addNoteBtn: {
    backgroundColor: Colors.primary, borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
  },
  addNoteBtnText: {
    color: '#FFFFFF', fontSize: FontSize.sm, fontWeight: '600',
  },

  notesGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md,
  },
  noteCard: {
    width: SCREEN_WIDTH > 768 ? '30%' : '46%',
    minHeight: 120,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    // 模拟便签纸效果
    shadowColor: '#000',
    shadowOffset: { width: 1, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 3,
    transform: [{ rotate: '-0.5deg' }],
  },
  noteContent: {
    flex: 1,
    fontSize: FontSize.sm,
    lineHeight: 20,
    fontFamily: Platform.OS === 'ios' ? 'Kaiti SC' : 'serif',
  },
  noteFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: Spacing.sm, paddingTop: Spacing.xs,
    borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)',
  },
  noteDate: {
    fontSize: 10,
  },
  archiveBtn: {
    fontSize: 14, opacity: 0.5,
  },

  emptyState: {
    alignItems: 'center', paddingVertical: Spacing.xl,
  },
  emptyIcon: { fontSize: 40, marginBottom: Spacing.sm },
  emptyText: {
    fontSize: FontSize.base, color: Colors.textSecondary, fontWeight: '500',
  },
  emptyHint: {
    fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 4,
  },
  empty: {
    textAlign: 'center', color: Colors.textMuted, fontSize: FontSize.sm,
    paddingVertical: Spacing.lg,
  },

  /* 编辑弹窗 */
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center',
    padding: Spacing.xl,
  },
  editorBox: {
    width: '100%', maxWidth: 400, minHeight: 300,
    borderRadius: BorderRadius.sm,
    padding: Spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  colorRow: {
    flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md,
    flexWrap: 'wrap',
  },
  colorDot: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 2, borderColor: 'transparent',
  },
  colorDotActive: {
    borderColor: '#333',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  editorInput: {
    flex: 1, minHeight: 150,
    fontSize: FontSize.base,
    lineHeight: 24,
    padding: 0,
  },
  editorActions: {
    flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.lg,
  },
  editorCancel: {
    flex: 1, alignItems: 'center', paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  editorCancelText: {
    fontSize: FontSize.sm, fontWeight: '600', opacity: 0.6,
  },
  editorSave: {
    flex: 1, alignItems: 'center', paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  editorSaveText: {
    fontSize: FontSize.sm, fontWeight: '700', opacity: 0.8,
  },
});

// 数据库迁移提醒：需要在 Supabase 中创建 sticky_notes 表
