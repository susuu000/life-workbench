/**
 * Tab 布局 v3 - CodeBuddy 版底部导航风格
 * 
 * 优化：
 * - 更精致的 SVG 图标（用 emoji 替代以保持兼容）
 * - 选中态缩放动画
 * - safe-area 底部适配
 * - 柔和的顶部分隔线
 * - 选中态高亮文字色
 */

import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Platform } from 'react-native';
import { Tabs, useRouter, useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, FontSize, BorderRadius } from '@/lib/theme';

/** Tab 图标 */
const TAB_ICONS: Record<string, { active: string; inactive: string }> = {
  index: { active: '🏠', inactive: '🏠' },
  discover: { active: '🔍', inactive: '🔍' },
  mine: { active: '👤', inactive: '👤' },
};

const TAB_LABELS: Record<string, string> = {
  index: '首页',
  discover: '发现',
  mine: '我的',
};

/** 单个 Tab 按钮（带动画） */
function TabButton({
  label, icon, isActive, onPress,
}: {
  label: string; icon: { active: string; inactive: string };
  isActive: boolean; onPress: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isActive) {
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.15, duration: 150, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]).start();
    }
  }, [isActive]);

  return (
    <TouchableOpacity style={styles.tabItem} onPress={onPress} activeOpacity={0.7}>
      <Animated.Text style={[styles.tabIcon, { transform: [{ scale: scaleAnim }] }]}>
        {isActive ? icon.active : icon.inactive}
      </Animated.Text>
      <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const segments = useSegments();

  const currentTab = segments[segments.length - 1] || 'index';

  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => (
        <View style={[styles.tabBar, { paddingBottom: insets.bottom || Spacing.sm }]}>
          <View style={styles.tabBarInner}>
            {props.state.routes.map((route, index) => {
              const isActive = props.state.index === index;
              const icon = TAB_ICONS[route.name] || TAB_ICONS.index;
              const label = TAB_LABELS[route.name] || route.name;

              return (
                <TabButton
                  key={route.key}
                  label={label}
                  icon={icon}
                  isActive={isActive}
                  onPress={() => {
                    const event = props.navigation.emit({
                      type: 'tabPress',
                      target: route.key,
                      canPreventDefault: true,
                    });
                    if (!isActive && !event.defaultPrevented) {
                      props.navigation.navigate(route.name);
                    }
                  }}
                />
              );
            })}
          </View>
        </View>
      )}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="discover" />
      <Tabs.Screen name="mine" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    shadowColor: 'rgba(60,50,30,0.06)',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 8,
  },
  tabBarInner: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    height: 52,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: Spacing.xs,
  },
  tabIcon: {
    fontSize: 22,
  },
  tabLabel: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  tabLabelActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
});
