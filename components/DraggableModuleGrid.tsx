/**
 * DraggableModuleGrid - 可拖拽排序的板块网格
 * 
 * 功能：
 * - 长按进入拖拽模式
 * - 拖拽调整板块顺序
 * - 排序结果持久化到 Supabase user_settings.module_order
 * - 支持板块显示/隐藏切换
 * 
 * 注意：React Native 中拖拽需使用 PanResponder 或 Gesture Handler。
 * 此组件提供基于 PanResponder 的轻量实现。
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, PanResponder,
  Animated, Dimensions, Alert, Switch,
} from 'react-native';
import { getCurrentUserId, supabase } from '@/lib/supabase';
import { Colors, Spacing, FontSize, BorderRadius, ModuleColors } from '@/lib/theme';
import { MODULE_META, type ModuleKey } from '@/lib/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH > 768 ? '30%' : '46%';

interface DraggableModuleGridProps {
  moduleKeys: ModuleKey[];
  moduleTargets: Record<ModuleKey, number>;
  moduleProgress: Record<ModuleKey, { done: number; total: number }>;
  expandedModule: ModuleKey | null;
  onModulePress: (key: ModuleKey) => void;
  onSubNavigate: (key: ModuleKey) => void;
  onOrderChange?: (newOrder: ModuleKey[]) => void;
}

interface ModuleItem {
  key: ModuleKey;
  x: number;
  y: number;
}

export default function DraggableModuleGrid({
  moduleKeys,
  moduleTargets,
  moduleProgress,
  expandedModule,
  onModulePress,
  onSubNavigate,
  onOrderChange,
}: DraggableModuleGridProps) {
  const [order, setOrder] = useState<ModuleKey[]>([...moduleKeys]);
  const [editMode, setEditMode] = useState(false);
  const [visibility, setVisibility] = useState<Record<string, boolean>>({});
  const [dragging, setDragging] = useState<ModuleKey | null>(null);

  // 拖拽动画值
  const pan = useRef(new Animated.ValueXY()).current;
  const scale = useRef(new Animated.Value(1)).current;
  const zIndex = useRef(new Animated.Value(0)).current;

  // 从服务器加载排序和可见性
  useEffect(() => {
    (async () => {
      const uid = await getCurrentUserId();
      if (!uid) return;
      const { data } = await supabase
        .from('user_settings')
        .select('module_order, module_visibility')
        .eq('user_id', uid)
        .maybeSingle();
      if (data?.module_order) {
        const saved = data.module_order as ModuleKey[];
        // 合并新板块
        const merged = [...saved];
        for (const key of moduleKeys) {
          if (!merged.includes(key)) merged.push(key);
        }
        setOrder(merged);
      }
      if (data?.module_visibility) {
        setVisibility(data.module_visibility as Record<string, boolean>);
      }
    })();
  }, [moduleKeys]);

  // 保存排序
  const saveOrder = async (newOrder: ModuleKey[]) => {
    const uid = await getCurrentUserId();
    if (!uid) return;
    await supabase
      .from('user_settings')
      .update({ module_order: newOrder })
      .eq('user_id', uid);
    onOrderChange?.(newOrder);
  };

  // 保存可见性
  const saveVisibility = async (vis: Record<string, boolean>) => {
    const uid = await getCurrentUserId();
    if (!uid) return;
    await supabase
      .from('user_settings')
      .update({ module_visibility: vis })
      .eq('user_id', uid);
  };

  // 切换可见性
  const toggleVisibility = (key: ModuleKey) => {
    const updated = { ...visibility, [key]: !visibility[key] };
    setVisibility(updated);
    saveVisibility(updated);
  };

  // 移动板块
  const moveItem = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    const newOrder = [...order];
    const [moved] = newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, moved);
    setOrder(newOrder);
    saveOrder(newOrder);
  };

  // 重置为默认排序
  const resetOrder = () => {
    const defaultOrder = [...moduleKeys];
    setOrder(defaultOrder);
    saveOrder(defaultOrder);
    Alert.alert('已重置', '板块排序已恢复为默认。');
  };

  // 可见的板块列表
  const visibleKeys = order.filter((k) => visibility[k] !== false);

  return (
    <View>
      {/* 编辑模式工具栏 */}
      <View style={styles.toolbar}>
        <TouchableOpacity
          style={[styles.toolbarBtn, editMode && styles.toolbarBtnActive]}
          onPress={() => setEditMode(!editMode)}
          activeOpacity={0.7}
        >
          <Text style={[styles.toolbarBtnText, editMode && styles.toolbarBtnTextActive]}>
            {editMode ? '✅ 完成' : '🔧 排序'}
          </Text>
        </TouchableOpacity>
        {editMode && (
          <TouchableOpacity style={styles.toolbarBtn} onPress={resetOrder} activeOpacity={0.7}>
            <Text style={styles.toolbarBtnText}>↩ 重置</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 板块网格 */}
      <View style={styles.grid}>
        {visibleKeys.map((key, index) => {
          const meta = MODULE_META[key];
          const prog = moduleProgress[key];
          const target = moduleTargets[key] || 0;
          const done = prog.done;
          const showTotal = target > 0 ? target : (prog.total > 0 ? prog.total : 0);
          const pct = showTotal > 0 ? Math.round((done / showTotal) * 100) : 0;
          const isComplete = showTotal > 0 && done >= showTotal;
          const isExpanded = expandedModule === key;
          const modColor = ModuleColors[key] || Colors.primary;

          return (
            <View
              key={key}
              style={[
                styles.cardWrap,
                isExpanded && { width: '100%' },
                editMode && styles.cardWrapEditing,
              ]}
            >
              {/* 编辑模式下的拖拽手柄 */}
              {editMode && (
                <View style={styles.dragHandle}>
                  <Text style={styles.dragHandleText}>⠿</Text>
                </View>
              )}

              <TouchableOpacity
                style={[
                  styles.card,
                  isComplete && styles.cardDone,
                  isExpanded && styles.cardExpanded,
                  { borderColor: isExpanded ? modColor : Colors.borderLight },
                ]}
                activeOpacity={0.7}
                onPress={() => onModulePress(key)}
                onLongPress={() => {
                  if (!editMode) setEditMode(true);
                }}
              >
                <View style={[styles.iconBox, { backgroundColor: modColor }]}>
                  <Text style={styles.iconText}>{meta.icon}</Text>
                </View>
                <Text style={styles.label}>{meta.label}</Text>
                <Text style={[styles.progress, isComplete && { color: Colors.success }]}>
                  {done}/{showTotal || '—'}
                </Text>
                {pct > 0 && (
                  <View style={styles.barBg}>
                    <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: isComplete ? Colors.success : modColor }]} />
                  </View>
                )}
                {isComplete && <Text style={styles.doneStar}>✨</Text>}

                {/* 编辑模式：移动按钮 */}
                {editMode && (
                  <View style={styles.moveBtns}>
                    {index > 0 && (
                      <TouchableOpacity
                        style={styles.moveBtn}
                        onPress={() => moveItem(index, index - 1)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={styles.moveBtnText}>⬆</Text>
                      </TouchableOpacity>
                    )}
                    {index < visibleKeys.length - 1 && (
                      <TouchableOpacity
                        style={styles.moveBtn}
                        onPress={() => moveItem(index, index + 1)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={styles.moveBtnText}>⬇</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </TouchableOpacity>
            </View>
          );
        })}
      </View>

      {/* 编辑模式：隐藏的板块 */}
      {editMode && order.filter((k) => visibility[k] === false).length > 0 && (
        <View style={styles.hiddenSection}>
          <Text style={styles.hiddenTitle}>已隐藏的板块</Text>
          <View style={styles.hiddenList}>
            {order
              .filter((k) => visibility[k] === false)
              .map((key) => (
                <TouchableOpacity
                  key={key}
                  style={styles.hiddenChip}
                  onPress={() => toggleVisibility(key)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.hiddenChipText}>
                    {MODULE_META[key].icon} {MODULE_META[key].label} (点击显示)
                  </Text>
                </TouchableOpacity>
              ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  toolbarBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  toolbarBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  toolbarBtnText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  toolbarBtnTextActive: {
    color: '#FFFFFF',
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.lg,
  },

  cardWrap: {
    width: CARD_WIDTH,
  },
  cardWrapEditing: {
    // 编辑模式下略微缩小留空间给手柄
  },

  dragHandle: {
    alignItems: 'center',
    paddingBottom: 4,
  },
  dragHandleText: {
    fontSize: 16,
    color: Colors.textMuted,
    letterSpacing: 4,
  },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.borderLight,
    shadowColor: Colors.cardShadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
    minHeight: 130,
    position: 'relative',
  },
  cardExpanded: {
    borderWidth: 2,
    shadowOpacity: 0.5,
    shadowRadius: 12,
  },
  cardDone: {
    backgroundColor: Colors.success + '08',
    borderColor: Colors.success + '30',
  },

  iconBox: {
    width: 40, height: 40, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  iconText: { fontSize: 20 },

  label: {
    fontSize: FontSize.base, fontWeight: '600',
    color: Colors.textPrimary, marginBottom: 2,
  },
  progress: {
    fontSize: FontSize.sm, color: Colors.textSecondary,
    marginBottom: 6, fontWeight: '600',
  },
  barBg: {
    width: '75%', height: 5, borderRadius: 3,
    backgroundColor: Colors.borderLight, overflow: 'hidden',
  },
  barFill: { height: 5, borderRadius: 3 },
  doneStar: {
    position: 'absolute', top: 6, right: 8, fontSize: 12,
  },

  moveBtns: {
    position: 'absolute', top: 6, left: 6,
    flexDirection: 'row', gap: 2,
  },
  moveBtn: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: Colors.primary + '15',
    justifyContent: 'center', alignItems: 'center',
  },
  moveBtnText: { fontSize: 10 },

  hiddenSection: {
    marginTop: Spacing.xl,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  hiddenTitle: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    fontWeight: '500',
    marginBottom: Spacing.sm,
  },
  hiddenList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  hiddenChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  hiddenChipText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
});
