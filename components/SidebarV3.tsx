/**
 * SidebarV3 - CodeBuddy 版「月夕生活台」风格侧边栏
 * 
 * 特性：
 * - 秘色渐变背景（#2E6F7E → #1A5060）
 * - Logo + 应用名头部（月夕 · 生活台）
 * - 导航项：白色半透明 + 金色左边条激活态
 * - 自定义板块支持添加/删除
 * - 底部「添加板块」按钮
 * - 移动端从左侧滑入，带遮罩层
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Animated, Dimensions, Modal, TextInput, Alert,
  Platform, TouchableWithoutFeedback,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getCurrentUserId, supabase } from '@/lib/supabase';
import { Colors, Spacing, FontSize, BorderRadius } from '@/lib/theme';
import { MODULE_META, type ModuleKey } from '@/lib/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SIDEBAR_WIDTH = Math.min(260, SCREEN_WIDTH * 0.7);

export interface CustomSection {
  id: string;
  name: string;
  icon?: string;
}

interface SidebarV3Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (key: string) => void;
  custom: CustomSection[];
  onCustomChange: (sections: CustomSection[]) => void;
  moduleKeys: ModuleKey[];
}

// 内置导航项图标（SVG path 简化为 emoji）
const NAV_ICONS: Record<string, string> = {
  home: '🏠',
  english: '📚',
  ai_learning: '🤖',
  reading: '📖',
  podcast: '🎙️',
  social_media: '📸',
  self_explore: '🌙',
  discover: '🔍',
  profile: '👤',
  settings: '⚙️',
};

export default function SidebarV3({
  visible, onClose, onSelect, custom, onCustomChange, moduleKeys,
}: SidebarV3Props) {
  const insets = useSafeAreaInsets();
  const slideAnim = React.useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  const overlayAnim = React.useRef(new Animated.Value(0)).current;
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }),
        Animated.timing(overlayAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: -SIDEBAR_WIDTH, duration: 200, useNativeDriver: true }),
        Animated.timing(overlayAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!visible && (slideAnim as any)._value === -SIDEBAR_WIDTH) return null;

  const handleSelect = (key: string) => {
    onSelect(key);
  };

  const handleAddSection = async () => {
    const name = newSectionName.trim();
    if (!name) return;
    const id = `custom-${Date.now()}`;
    const newSection: CustomSection = { id, name };
    const updated = [...custom, newSection];
    onCustomChange(updated);
    setNewSectionName('');
    setShowAddModal(false);
  };

  const handleDeleteSection = (id: string) => {
    Alert.alert('删除板块', '确定要删除这个自定义板块吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除', style: 'destructive',
        onPress: () => {
          const updated = custom.filter((s) => s.id !== id);
          onCustomChange(updated);
        },
      },
    ]);
  };

  // 构建导航项列表（对齐 CodeBuddy 版 sidebar 顺序）
  const navItems = [
    { id: 'home', name: '首页', icon: NAV_ICONS.home, custom: false },
    ...moduleKeys.map((key) => ({
      id: key,
      name: MODULE_META[key].label,
      icon: MODULE_META[key].icon,
      custom: false,
    })),
    { id: 'discover', name: '发现', icon: NAV_ICONS.discover, custom: false },
    { id: 'profile', name: '我的', icon: NAV_ICONS.profile, custom: false },
    ...custom.map((s) => ({ ...s, icon: s.icon || '📌', custom: true })),
    { id: 'settings', name: '设置', icon: NAV_ICONS.settings, custom: false },
  ];

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={visible ? 'auto' : 'none'}>
      {/* 遮罩层 */}
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[styles.overlay, { opacity: overlayAnim }]} />
      </TouchableWithoutFeedback>

      {/* 侧边栏 */}
      <Animated.View style={[styles.sidebar, { transform: [{ translateX: slideAnim }], paddingTop: insets.top }]}>
        {/* Logo 头部（CodeBuddy 版风格） */}
        <View style={styles.sidebarHeader}>
          <View style={styles.logoBox}>
            <View style={styles.logoInner}>
              <Text style={styles.logoMoon}>🌙</Text>
            </View>
          </View>
          <View style={styles.appTitleBox}>
            <Text style={styles.appName}>月夕</Text>
            <Text style={styles.appSubtitle}>生活台</Text>
          </View>
        </View>

        {/* 导航列表 */}
        <ScrollView style={styles.navScroll} showsVerticalScrollIndicator={false}>
          {navItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.navItem}
              onPress={() => handleSelect(item.id)}
              activeOpacity={0.7}
            >
              <View style={styles.navActiveBar} />
              <Text style={styles.navIcon}>{item.icon}</Text>
              <Text style={styles.navLabel} numberOfLines={1}>{item.name}</Text>
              {item.custom && (
                <TouchableOpacity
                  style={styles.navDelete}
                  onPress={() => handleDeleteSection(item.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.navDeleteText}>✕</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* 底部：添加板块按钮 */}
        <View style={styles.sidebarFooter}>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setShowAddModal(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.addBtnIcon}>+</Text>
            <Text style={styles.addBtnText}>添加板块</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* 添加板块弹窗 */}
      {showAddModal && (
        <Modal transparent animationType="fade" visible={showAddModal} onRequestClose={() => setShowAddModal(false)}>
          <TouchableWithoutFeedback onPress={() => setShowAddModal(false)}>
            <View style={styles.modalOverlay}>
              <TouchableWithoutFeedback>
                <View style={styles.modalBox}>
                  <Text style={styles.modalTitle}>添加自定义板块</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="输入板块名称…"
                    placeholderTextColor={Colors.textMuted}
                    value={newSectionName}
                    onChangeText={setNewSectionName}
                    autoFocus
                  />
                  <View style={styles.modalActions}>
                    <TouchableOpacity
                      style={styles.modalCancel}
                      onPress={() => { setShowAddModal(false); setNewSectionName(''); }}
                    >
                      <Text style={styles.modalCancelText}>取消</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalConfirm, !newSectionName.trim() && { opacity: 0.5 }]}
                      onPress={handleAddSection}
                      disabled={!newSectionName.trim()}
                    >
                      <Text style={styles.modalConfirmText}>添加</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      )}
    </View>
  );
}

/** 持久化自定义板块到 Supabase */
export async function persistCustomSections(sections: CustomSection[]): Promise<void> {
  const uid = await getCurrentUserId();
  if (!uid) return;
  await supabase.from('user_settings').update({ custom_sections: sections }).eq('user_id', uid);
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sidebar: {
    position: 'absolute',
    top: 0, left: 0, bottom: 0,
    width: SIDEBAR_WIDTH,
    backgroundColor: Colors.sidebarBg,
    // 渐变用两个层叠 View 模拟
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 20,
  },

  /* Logo 头部 */
  sidebarHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.lg,
    borderBottomWidth: 1, borderBottomColor: Colors.sidebarBorder,
  },
  logoBox: {
    width: 42, height: 42, borderRadius: 10, overflow: 'hidden',
    backgroundColor: Colors.primaryDark,
    marginRight: Spacing.md,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 4, elevation: 4,
  },
  logoInner: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: Colors.gold + '20',
  },
  logoMoon: { fontSize: 22 },
  appTitleBox: {},
  appName: {
    fontSize: FontSize.lg, fontWeight: '700', color: '#FFFFFF',
    letterSpacing: 2, lineHeight: 22,
  },
  appSubtitle: {
    fontSize: FontSize.xs, color: 'rgba(255,255,255,0.6)',
    letterSpacing: 1,
  },

  /* 导航列表 */
  navScroll: { flex: 1, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm },
  navItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: Spacing.sm + 2, paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm, marginBottom: 2,
    position: 'relative',
  },
  navActiveBar: {
    position: 'absolute', left: 0, top: '30%', bottom: '30%',
    width: 3, backgroundColor: Colors.gold,
    borderRadius: 2, opacity: 0,
  },
  navIcon: { fontSize: 18, width: 24, textAlign: 'center', marginRight: Spacing.sm },
  navLabel: {
    flex: 1, fontSize: FontSize.sm, color: Colors.sidebarText,
    whiteSpace: 'nowrap',
  },
  navDelete: {
    width: 22, height: 22, borderRadius: 4,
    justifyContent: 'center', alignItems: 'center',
    opacity: 0.6,
  },
  navDeleteText: { fontSize: 12, color: 'rgba(255,255,255,0.6)' },

  /* 底部 */
  sidebarFooter: {
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing.md,
    borderTopWidth: 1, borderTopColor: Colors.sidebarBorder,
  },
  addBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  addBtnIcon: {
    fontSize: 18, color: 'rgba(255,255,255,0.6)', marginRight: Spacing.sm,
    fontWeight: '300',
  },
  addBtnText: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.6)' },

  /* 添加弹窗 */
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center',
    padding: Spacing.xl,
  },
  modalBox: {
    width: '100%', maxWidth: 320,
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.xl, borderWidth: 1, borderColor: Colors.borderLight,
  },
  modalTitle: {
    fontSize: FontSize.md, fontWeight: 'bold', color: Colors.textPrimary,
    marginBottom: Spacing.lg, textAlign: 'center',
  },
  modalInput: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    fontSize: FontSize.base, color: Colors.textPrimary,
    marginBottom: Spacing.lg,
  },
  modalActions: {
    flexDirection: 'row', gap: Spacing.md,
  },
  modalCancel: {
    flex: 1, alignItems: 'center', paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full, borderWidth: 1, borderColor: Colors.border,
  },
  modalCancelText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  modalConfirm: {
    flex: 1, alignItems: 'center', paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full, backgroundColor: Colors.primary,
  },
  modalConfirmText: { fontSize: FontSize.sm, color: '#FFFFFF', fontWeight: '600' },
});
