/**
 * 常驻左侧边栏：首页 + 六大板块 + 可加自定义板块。
 * 复刻旧版「月夕生活台」的左侧导航。与底部 3 Tab 并存。
 */
import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert,
} from 'react-native';
import { Colors, Spacing, FontSize, BorderRadius } from '@/lib/theme';
import { MODULE_META, type ModuleKey } from '@/lib/types';
import { supabase, getCurrentUserId } from '@/lib/supabase';

export interface CustomSection {
  id: string;
  name: string;
}

const FIXED: { key: string; label: string; icon: string }[] = [
  { key: 'home', label: '首页', icon: '🏠' },
  { key: 'english', label: '英语', icon: MODULE_META.english.icon },
  { key: 'ai_learning', label: 'AI学习', icon: MODULE_META.ai_learning.icon },
  { key: 'reading', label: '阅读', icon: MODULE_META.reading.icon },
  { key: 'podcast', label: '播客', icon: MODULE_META.podcast.icon },
  { key: 'social_media', label: '自媒体', icon: MODULE_META.social_media.icon },
  { key: 'self_explore', label: '自我探索', icon: MODULE_META.self_explore.icon },
];

export default function Sidebar({
  visible,
  onClose,
  onSelect,
  custom,
  onCustomChange,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (key: string) => void;
  custom: CustomSection[];
  onCustomChange: (next: CustomSection[]) => void;
}) {
  const addCustom = () => {
    Alert.prompt(
      '添加自定义板块',
      '板块名称（如：运动、冥想）',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '添加',
          onPress: (name) => {
            const n = (name || '').trim();
            if (!n) return;
            const next = [...custom, { id: 'custom-' + Date.now(), name: n }];
            onCustomChange(next);
          },
        },
      ],
      'plain-text'
    );
  };

  const removeCustom = (id: string) => {
    onCustomChange(custom.filter((c) => c.id !== id));
  };

  return (
    <>
      {visible && <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose} />}
      <View style={[styles.sidebar, visible && styles.sidebarOpen]}>
        <View style={styles.header}>
          <View style={[styles.logo, { backgroundColor: Colors.primary }]}>
            <Text style={styles.logoText}>🌿</Text>
          </View>
          <View>
            <Text style={styles.appName}>Susu</Text>
            <Text style={styles.appSub}>生活工作台</Text>
          </View>
        </View>

        <ScrollView style={styles.nav} showsVerticalScrollIndicator={false}>
          {FIXED.map((it) => (
            <TouchableOpacity
              key={it.key}
              style={styles.item}
              onPress={() => onSelect(it.key)}
              activeOpacity={0.7}
            >
              <Text style={styles.itemIcon}>{it.icon}</Text>
              <Text style={styles.itemLabel}>{it.label}</Text>
            </TouchableOpacity>
          ))}

          {custom.length > 0 && <View style={styles.divider} />}
          {custom.map((c) => (
            <View key={c.id} style={styles.item}>
              <TouchableOpacity
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
                onPress={() => onSelect(c.id)}
                activeOpacity={0.7}
              >
                <Text style={styles.itemIcon}>⭐</Text>
                <Text style={styles.itemLabel}>{c.name}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => removeCustom(c.id)} activeOpacity={0.7}>
                <Text style={styles.itemDel}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>

        <TouchableOpacity style={styles.addBtn} onPress={addCustom} activeOpacity={0.7}>
          <Text style={styles.addBtnText}>＋ 添加板块</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

/** 把自定义板块变更持久化到 user_settings（并在 Supabase 保存） */
export async function persistCustomSections(next: CustomSection[]) {
  const uid = await getCurrentUserId();
  if (!uid) return;
  await supabase.from('user_settings').update({ custom_sections: next }).eq('user_id', uid);
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)', zIndex: 90,
  },
  sidebar: {
    position: 'absolute', top: 0, left: -280, bottom: 0, width: 260,
    backgroundColor: Colors.surface, zIndex: 100,
    borderRightWidth: 1, borderRightColor: Colors.border,
    paddingTop: 48, paddingBottom: Spacing.lg,
  },
  sidebarOpen: { left: 0 },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.divider,
  },
  logo: {
    width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center',
    marginRight: Spacing.md,
  },
  logoText: { fontSize: 22 },
  appName: { fontSize: FontSize.lg, fontWeight: 'bold', color: Colors.textPrimary },
  appSub: { fontSize: FontSize.xs, color: Colors.textMuted },
  nav: { flex: 1, paddingVertical: Spacing.md },
  item: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  itemIcon: { fontSize: 18, marginRight: Spacing.md, width: 28, textAlign: 'center' },
  itemLabel: { fontSize: FontSize.base, color: Colors.textPrimary, flex: 1 },
  itemDel: { fontSize: 14, color: Colors.textMuted, padding: 4 },
  divider: { height: 1, backgroundColor: Colors.divider, marginVertical: Spacing.sm, marginHorizontal: Spacing.lg },
  addBtn: {
    marginHorizontal: Spacing.lg, alignItems: 'center', paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  addBtnText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '600' },
});
