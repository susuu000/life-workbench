/**
 * HomeWidgetAssembler - 首页 Widget 组装器
 * 
 * 允许用户自定义首页显示哪些组件及其顺序：
 * - 打卡卡片（固定，不可隐藏）
 * - 板块网格（固定，不可隐藏）
 * - 每日金句
 * - 便签
 * - 习惯热力图
 * - 天气详情
 * 
 * 配置持久化到 user_settings.home_widgets
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Switch,
  ScrollView, Modal, Alert,
} from 'react-native';
import { supabase, getCurrentUserId } from '@/lib/supabase';
import { Colors, Spacing, FontSize, BorderRadius } from '@/lib/theme';
import { useDarkMode } from '@/lib/DarkModeProvider';
import DailyQuote from '@/components/DailyQuote';
import StickyNotes from '@/components/StickyNotes';
import HabitHeatmap from '@/components/HabitHeatmap';

// ===== 类型 =====
interface WidgetConfig {
  key: string;
  label: string;
  icon: string;
  enabled: boolean;
  order: number;
  component?: React.ComponentType<any>;
}

// 可用 Widget 注册表
const AVAILABLE_WIDGETS: Omit<WidgetConfig, 'enabled' | 'order'>[] = [
  { key: 'daily_quote', label: '每日金句', icon: '💬', component: DailyQuote },
  { key: 'sticky_notes', label: '便签', icon: '📝', component: StickyNotes },
  { key: 'habit_heatmap', label: '习惯热力图', icon: '📊', component: HabitHeatmap },
];

const DEFAULT_WIDGETS: WidgetConfig[] = [
  { key: 'daily_quote', label: '每日金句', icon: '💬', enabled: true, order: 0 },
  { key: 'sticky_notes', label: '便签', icon: '📝', enabled: true, order: 1 },
  { key: 'habit_heatmap', label: '习惯热力图', icon: '📊', enabled: false, order: 2 },
];

// ===== 主组件 =====
export default function HomeWidgetAssembler({
  children,
}: {
  children?: React.ReactNode;
}) {
  const { colors } = useDarkMode();
  const [widgets, setWidgets] = useState<WidgetConfig[]>(DEFAULT_WIDGETS);
  const [showConfig, setShowConfig] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // 加载配置
  useEffect(() => {
    (async () => {
      const uid = await getCurrentUserId();
      if (!uid) { setLoaded(true); return; }
      const { data } = await supabase
        .from('user_settings')
        .select('home_widgets')
        .eq('user_id', uid)
        .maybeSingle();

      if (data?.home_widgets) {
        const saved = data.home_widgets as WidgetConfig[];
        // 合并新增的 Widget
        const merged = DEFAULT_WIDGETS.map((dw) => {
          const found = saved.find((s) => s.key === dw.key);
          return found ? { ...dw, ...found } : dw;
        });
        setWidgets(merged);
      }
      setLoaded(true);
    })();
  }, []);

  // 保存配置
  const saveConfig = async (newWidgets: WidgetConfig[]) => {
    const uid = await getCurrentUserId();
    if (!uid) return;
    await supabase
      .from('user_settings')
      .upsert({ user_id: uid, home_widgets: newWidgets }, { onConflict: 'user_id' });
    setWidgets(newWidgets);
  };

  // 切换开关
  const toggleWidget = (key: string) => {
    const updated = widgets.map((w) =>
      w.key === key ? { ...w, enabled: !w.enabled } : w
    );
    saveConfig(updated);
  };

  // 上移/下移
  const moveWidget = (key: string, direction: 'up' | 'down') => {
    const idx = widgets.findIndex((w) => w.key === key);
    if (idx === -1) return;
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === widgets.length - 1) return;

    const updated = [...widgets];
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    [updated[idx], updated[swapIdx]] = [updated[swapIdx], updated[idx]];
    // 更新 order
    const reordered = updated.map((w, i) => ({ ...w, order: i }));
    saveConfig(reordered);
  };

  // 已启用的 Widget（按 order 排序）
  const enabledWidgets = useMemo(
    () => widgets.filter((w) => w.enabled).sort((a, b) => a.order - b.order),
    [widgets]
  );

  if (!loaded) return null;

  return (
    <View>
      {/* Widget 区域 */}
      {enabledWidgets.map((widget) => {
        const Component = AVAILABLE_WIDGETS.find((aw) => aw.key === widget.key)?.component;
        if (!Component) return null;
        return <Component key={widget.key} />;
      })}

      {/* 自定义按钮 */}
      <TouchableOpacity
        style={[styles.customizeBtn, { borderColor: colors.borderLight }]}
        onPress={() => setShowConfig(true)}
        activeOpacity={0.7}
      >
        <Text style={[styles.customizeBtnText, { color: colors.textMuted }]}>
          ⚙️ 自定义首页组件
        </Text>
      </TouchableOpacity>

      {/* 配置弹窗 */}
      <Modal visible={showConfig} transparent animationType="slide" onRequestClose={() => setShowConfig(false)}>
        <View style={styles.configOverlay}>
          <View style={[styles.configBox, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
            <Text style={[styles.configTitle, { color: colors.textPrimary }]}>
              🧩 自定义首页
            </Text>
            <Text style={[styles.configHint, { color: colors.textMuted }]}>
              选择要在首页显示的组件，拖拽调整顺序
            </Text>

            <ScrollView style={styles.configList}>
              {widgets.map((widget, idx) => (
                <View
                  key={widget.key}
                  style={[styles.widgetRow, { borderBottomColor: colors.borderLight }]}
                >
                  <View style={styles.widgetInfo}>
                    <Text style={styles.widgetIcon}>{widget.icon}</Text>
                    <View style={styles.widgetText}>
                      <Text style={[styles.widgetLabel, { color: colors.textPrimary }]}>
                        {widget.label}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.widgetActions}>
                    {/* 排序按钮 */}
                    <TouchableOpacity
                      style={[styles.moveBtnSmall, idx === 0 && { opacity: 0.3 }]}
                      onPress={() => moveWidget(widget.key, 'up')}
                      disabled={idx === 0}
                    >
                      <Text style={styles.moveBtnText}>↑</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.moveBtnSmall, idx === widgets.length - 1 && { opacity: 0.3 }]}
                      onPress={() => moveWidget(widget.key, 'down')}
                      disabled={idx === widgets.length - 1}
                    >
                      <Text style={styles.moveBtnText}>↓</Text>
                    </TouchableOpacity>
                    {/* 开关 */}
                    <Switch
                      value={widget.enabled}
                      onValueChange={() => toggleWidget(widget.key)}
                      trackColor={{ false: Colors.border, true: Colors.primaryLight }}
                      thumbColor={widget.enabled ? Colors.primary : '#f4f3f4'}
                    />
                  </View>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.configDone}
              onPress={() => setShowConfig(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.configDoneText}>完成</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  customizeBtn: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderRadius: BorderRadius.full,
    borderStyle: 'dashed',
  },
  customizeBtnText: {
    fontSize: FontSize.xs,
  },

  configOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  configBox: {
    maxHeight: '70%',
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.xl,
    borderWidth: 1,
  },
  configTitle: {
    fontSize: FontSize.lg,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  configHint: {
    fontSize: FontSize.sm,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  configList: {
    maxHeight: 300,
  },
  widgetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  widgetInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  widgetIcon: { fontSize: 20 },
  widgetText: {},
  widgetLabel: {
    fontSize: FontSize.base,
    fontWeight: '500',
  },
  widgetActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  moveBtnSmall: {
    width: 28, height: 28,
    borderRadius: 14,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moveBtnText: { fontSize: 12, color: Colors.textSecondary },
  configDone: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  configDoneText: {
    color: '#FFFFFF',
    fontSize: FontSize.base,
    fontWeight: '600',
  },
});
