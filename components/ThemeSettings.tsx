/**
 * ThemeSettings - 主题设置组件
 * 
 * 包含：
 * - 暗色模式开关
 * - 跟随系统主题开关
 * - 个性化主色调选择
 * - 字体大小调节
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, Switch, TouchableOpacity,
  ScrollView, Alert, Platform,
} from 'react-native';
import { supabase, getCurrentUserId } from '@/lib/supabase';
import { Colors, Spacing, FontSize, BorderRadius } from '@/lib/theme';
import { DarkColors } from '@/lib/dark-theme';
import { useDarkMode } from '@/lib/DarkModeProvider';

// 预设主题色
const PRESET_COLORS = [
  { name: '秘色', hex: '#2E6F7E' },
  { name: '墨绿', hex: '#2D5A4B' },
  { name: '靛蓝', hex: '#3B5998' },
  { name: '暖棕', hex: '#8B6F47' },
  { name: '玫红', hex: '#B04860' },
  { name: '暗紫', hex: '#6B4E8C' },
];

const FONT_SIZES = [
  { label: '小', value: 13 },
  { label: '中', value: 15 },
  { label: '大', value: 17 },
];

export default function ThemeSettings() {
  const { colors, isDark: darkMode, followSystem, toggleDarkMode, setFollowSystem } = useDarkMode();
  const [selectedColor, setSelectedColor] = useState('#2E6F7E');
  const [selectedFontSize, setSelectedFontSize] = useState(15);

  // 加载当前设置
  useEffect(() => {
    (async () => {
      const uid = await getCurrentUserId();
      if (!uid) return;
      const { data } = await supabase
        .from('user_settings')
        .select('theme_color, font_size')
        .eq('user_id', uid)
        .maybeSingle();
      if (data?.theme_color) setSelectedColor(data.theme_color);
      if (data?.font_size) setSelectedFontSize(data.font_size);
    })();
  }, []);

  // 切换暗色模式
  const handleToggleDark = (value: boolean) => {
    toggleDarkMode();
  };

  // 切换跟随系统
  const handleToggleFollowSystem = (value: boolean) => {
    setFollowSystem(value);
  };

  // 选择主题色
  const handleSelectColor = async (hex: string) => {
    setSelectedColor(hex);
    const uid = await getCurrentUserId();
    if (uid) {
      await supabase
        .from('user_settings')
        .upsert({ user_id: uid, theme_color: hex }, { onConflict: 'user_id' });
    }
  };

  // 选择字体大小
  const handleSelectFontSize = async (size: number) => {
    setSelectedFontSize(size);
    const uid = await getCurrentUserId();
    if (uid) {
      await supabase
        .from('user_settings')
        .upsert({ user_id: uid, font_size: size }, { onConflict: 'user_id' });
    }
  };

  const bg = colors.background;
  const surface = colors.surface;
  const text = colors.textPrimary;
  const textSec = colors.textSecondary;
  const border = colors.borderLight;

  return (
    <ScrollView style={[styles.container, { backgroundColor: bg }]} showsVerticalScrollIndicator={false}>
      {/* 暗色模式 */}
      <View style={[styles.section, { backgroundColor: surface, borderColor: border }]}>
        <Text style={[styles.sectionTitle, { color: text }]}>🌓 外观模式</Text>

        <View style={[styles.row, { borderBottomColor: border }]}>
          <View style={styles.rowInfo}>
            <Text style={[styles.rowLabel, { color: text }]}>暗色模式</Text>
            <Text style={[styles.rowHint, { color: textSec }]}>
              {darkMode ? '深色背景，护眼舒适' : '浅色背景，清晰明亮'}
            </Text>
          </View>
          <Switch
            value={darkMode}
            onValueChange={handleToggleDark}
            trackColor={{ false: Colors.border, true: Colors.primaryLight }}
            thumbColor={darkMode ? Colors.primary : '#f4f3f4'}
          />
        </View>

        {!darkMode && (
          <View style={styles.row}>
            <View style={styles.rowInfo}>
              <Text style={[styles.rowLabel, { color: text }]}>跟随系统</Text>
              <Text style={[styles.rowHint, { color: textSec }]}>
                自动根据系统设置切换明暗
              </Text>
            </View>
            <Switch
              value={followSystem}
              onValueChange={handleToggleFollowSystem}
              trackColor={{ false: Colors.border, true: Colors.primaryLight }}
              thumbColor={followSystem ? Colors.primary : '#f4f3f4'}
            />
          </View>
        )}
      </View>

      {/* 主题色 */}
      <View style={[styles.section, { backgroundColor: surface, borderColor: border }]}>
        <Text style={[styles.sectionTitle, { color: text }]}>🎨 主题色</Text>
        <Text style={[styles.rowHint, { color: textSec, marginBottom: Spacing.md, paddingHorizontal: 0 }]}>
          选择你喜欢的主色调
        </Text>
        <View style={styles.colorGrid}>
          {PRESET_COLORS.map((c) => (
            <TouchableOpacity
              key={c.hex}
              style={[
                styles.colorChip,
                { backgroundColor: c.hex },
                selectedColor === c.hex && styles.colorChipSelected,
              ]}
              onPress={() => handleSelectColor(c.hex)}
              activeOpacity={0.7}
            >
              {selectedColor === c.hex && (
                <Text style={styles.colorCheck}>✓</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
        <Text style={[styles.colorName, { color: textSec }]}>
          {PRESET_COLORS.find((c) => c.hex === selectedColor)?.name || '自定义'}
        </Text>
      </View>

      {/* 字体大小 */}
      <View style={[styles.section, { backgroundColor: surface, borderColor: border }]}>
        <Text style={[styles.sectionTitle, { color: text }]}>🔤 字体大小</Text>
        <View style={styles.fontSizeRow}>
          {FONT_SIZES.map((fs) => (
            <TouchableOpacity
              key={fs.value}
              style={[
                styles.fontSizeChip,
                { borderColor: border },
                selectedFontSize === fs.value && { backgroundColor: Colors.primary, borderColor: Colors.primary },
              ]}
              onPress={() => handleSelectFontSize(fs.value)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.fontSizeLabel,
                { color: textSec },
                selectedFontSize === fs.value && { color: '#FFFFFF' },
              ]}>
                {fs.label}
              </Text>
              <Text style={[
                styles.fontSizePreview,
                { fontSize: fs.value, color: text },
                selectedFontSize === fs.value && { color: '#FFFFFF' },
              ]}>
                Aa
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* 预览卡片 */}
      <View style={[styles.previewCard, { backgroundColor: surface, borderColor: border }]}>
        <Text style={[styles.previewTitle, { color: text }]}>预览效果</Text>
        <Text style={[styles.previewText, { color: textSec }]}>
          这是一段示例文字，展示当前主题色和字体大小的效果。月夕生活台，记录每一天的成长。
        </Text>
        <View style={[styles.previewBadge, { backgroundColor: selectedColor }]}>
          <Text style={styles.previewBadgeText}>主题色徽标</Text>
        </View>
      </View>

      <View style={{ height: 80 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  section: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: 'bold',
    marginBottom: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  rowInfo: { flex: 1, marginRight: Spacing.md },
  rowLabel: {
    fontSize: FontSize.base,
    fontWeight: '500',
    marginBottom: 2,
  },
  rowHint: {
    fontSize: FontSize.xs,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xs,
  },

  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    justifyContent: 'center',
  },
  colorChip: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  colorChipSelected: {
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  colorCheck: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  colorName: {
    fontSize: FontSize.sm,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },

  fontSizeRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  fontSizeChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  fontSizeLabel: {
    fontSize: FontSize.xs,
    marginBottom: 4,
  },
  fontSizePreview: {
    fontWeight: '600',
  },

  previewCard: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    alignItems: 'center',
  },
  previewTitle: {
    fontSize: FontSize.base,
    fontWeight: '600',
    marginBottom: Spacing.md,
  },
  previewText: {
    fontSize: FontSize.base,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  previewBadge: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  previewBadgeText: {
    color: '#FFFFFF',
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
});
