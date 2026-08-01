/**
 * SwipeableCard - 左滑露出快捷操作的卡片包装组件
 * 
 * 功能：
 * - 板块卡片左滑露出「完成」「跳过」按钮
 * - 使用 PanResponder 手势实现
 * - 触觉反馈（可选振动）
 * - 阈值触发，松手回弹
 */

import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Animated, PanResponder,
  TouchableOpacity, Dimensions, Platform,
} from 'react-native';
import { Colors, Spacing, FontSize, BorderRadius } from '@/lib/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ACTION_WIDTH = 80; // 每个操作按钮宽度
const SWIPE_THRESHOLD = ACTION_WIDTH * 1.5; // 触发阈值
const MAX_SWIPE = ACTION_WIDTH * 3; // 最大滑动距离

// ===== 类型 =====
interface SwipeAction {
  label: string;
  icon: string;
  color: string;
  onPress: () => void;
}

interface SwipeableCardProps {
  children: React.ReactNode;
  actions?: SwipeAction[];
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  enabled?: boolean;
  style?: any;
}

// ===== 默认操作 =====
const DEFAULT_ACTIONS: SwipeAction[] = [
  {
    label: '完成',
    icon: '✓',
    color: Colors.success,
    onPress: () => {},
  },
  {
    label: '跳过',
    icon: '→',
    color: Colors.warning,
    onPress: () => {},
  },
];

// ===== 主组件 =====
export default function SwipeableCard({
  children,
  actions = DEFAULT_ACTIONS,
  onSwipeLeft,
  onSwipeRight,
  enabled = true,
  style,
}: SwipeableCardProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const [swiped, setSwiped] = useState(false);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        if (!enabled) return false;
        // 水平滑动 > 垂直滑动时激活
        return Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      },
      onPanResponderMove: (_, gestureState) => {
        // 只允许向左滑动
        const dx = Math.min(0, Math.max(-MAX_SWIPE, gestureState.dx));
        translateX.setValue(dx);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -SWIPE_THRESHOLD) {
          // 超过阈值，保持打开
          Animated.spring(translateX, {
            toValue: -(actions.length * ACTION_WIDTH),
            useNativeDriver: true,
            tension: 65,
            friction: 11,
          }).start();
          setSwiped(true);

          // 触觉反馈
          if (Platform.OS === 'web' && navigator.vibrate) {
            navigator.vibrate(10);
          }
        } else {
          // 回弹
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            tension: 65,
            friction: 11,
          }).start();
          setSwiped(false);
        }
      },
    })
  ).current;

  // 关闭滑动
  const closeSwipe = () => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
    setSwiped(false);
  };

  const totalActionWidth = actions.length * ACTION_WIDTH;

  return (
    <View style={[styles.wrapper, style]}>
      {/* 背后的操作按钮 */}
      <View style={[styles.actionsContainer, { width: totalActionWidth }]}>
        {actions.map((action, index) => (
          <TouchableOpacity
            key={index}
            style={[styles.actionBtn, { backgroundColor: action.color, width: ACTION_WIDTH }]}
            onPress={() => {
              action.onPress();
              closeSwipe();
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.actionIcon}>{action.icon}</Text>
            <Text style={styles.actionLabel}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 前景内容 */}
      <Animated.View
        style={[styles.content, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  );
}

// ===== 使用示例 Hook =====
export function useSwipeActions(
  onComplete: () => void,
  onSkip: () => void
): SwipeAction[] {
  return [
    {
      label: '完成',
      icon: '✓',
      color: Colors.success,
      onPress: onComplete,
    },
    {
      label: '跳过',
      icon: '→',
      color: Colors.warning,
      onPress: onSkip,
    },
  ];
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  actionsContainer: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  actionBtn: {
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
  },
  actionIcon: {
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: 'bold',
    marginBottom: 2,
  },
  actionLabel: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  content: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
  },
});
