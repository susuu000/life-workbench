/**
 * SkeletonLoader - 骨架屏加载组件
 * 
 * 支持类型：
 * - 'checkin': 打卡卡片骨架
 * - 'modules': 板块网格骨架
 * - 'card': 通用卡片骨架
 * - 'list': 列表骨架
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';
import { Colors, Spacing, BorderRadius } from '@/lib/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface SkeletonLoaderProps {
  type: 'checkin' | 'modules' | 'card' | 'list';
  count?: number;
}

/** 单个闪烁条 */
function ShimmerBlock({ width, height, borderRadius, style }: {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: any;
}) {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1, duration: 1000, useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0, duration: 1000, useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 0.8],
  });

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height: height || 16,
          borderRadius: borderRadius || BorderRadius.sm,
          backgroundColor: Colors.skeleton,
          opacity,
        },
        style,
      ]}
    />
  );
}

export default function SkeletonLoader({ type, count = 1 }: SkeletonLoaderProps) {
  if (type === 'checkin') {
    return (
      <View style={styles.checkinCard}>
        <View style={{ flex: 1 }}>
          <ShimmerBlock width={80} height={18} style={{ marginBottom: Spacing.sm }} />
          <View style={{ flexDirection: 'row', gap: Spacing.lg }}>
            <ShimmerBlock width={100} height={16} />
            <ShimmerBlock width={80} height={16} />
          </View>
        </View>
        <ShimmerBlock width={48} height={48} borderRadius={24} />
      </View>
    );
  }

  if (type === 'modules') {
    return (
      <View style={styles.moduleGrid}>
        {Array.from({ length: count }).map((_, i) => (
          <View key={i} style={styles.moduleCard}>
            <ShimmerBlock width={40} height={40} borderRadius={12} style={{ marginBottom: Spacing.sm }} />
            <ShimmerBlock width={60} height={16} style={{ marginBottom: 6 }} />
            <ShimmerBlock width={40} height={14} style={{ marginBottom: 8 }} />
            <ShimmerBlock width="70%" height={4} borderRadius={2} />
          </View>
        ))}
      </View>
    );
  }

  if (type === 'card') {
    return (
      <View style={styles.genericCard}>
        <ShimmerBlock width="60%" height={18} style={{ marginBottom: Spacing.md }} />
        <ShimmerBlock width="100%" height={14} style={{ marginBottom: Spacing.sm }} />
        <ShimmerBlock width="80%" height={14} />
      </View>
    );
  }

  // list
  return (
    <View style={{ gap: Spacing.md }}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.listItem}>
          <ShimmerBlock width={24} height={24} borderRadius={6} style={{ marginRight: Spacing.md }} />
          <View style={{ flex: 1 }}>
            <ShimmerBlock width="70%" height={16} style={{ marginBottom: 6 }} />
            <ShimmerBlock width="40%" height={12} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  checkinCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.lg, marginBottom: Spacing.xl,
    borderWidth: 1, borderColor: Colors.borderLight,
  },
  moduleGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.lg,
  },
  moduleCard: {
    width: SCREEN_WIDTH > 768 ? '30%' : '46.5%',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg, padding: Spacing.lg,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.borderLight,
    minHeight: 140,
  },
  genericCard: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.lg, borderWidth: 1, borderColor: Colors.borderLight,
    marginBottom: Spacing.md,
  },
  listItem: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: BorderRadius.md,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.borderLight,
  },
});
