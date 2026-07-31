import { Tabs } from 'expo-router';
import { StyleSheet, View, Text, Platform } from 'react-native';
import React from 'react';
import { Spacing, Colors } from '@/lib/theme';
import { useTheme } from '@/lib/themeRuntime';

/** 底部导航栏：首页 / 发现 / 我的 */
export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: styles.tabItem,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '首页',
          // TODO: 替换为正式图标（当前用文字占位）
          tabBarIcon: ({ color }: { color: string }) => (
            <View style={styles.iconWrap}>
              <Text style={[styles.iconText, { color }]}>🏠</Text>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: '发现',
          tabBarIcon: ({ color }: { color: string }) => (
            <View style={styles.iconWrap}>
              <Text style={[styles.iconText, { color }]}>🔍</Text>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="mine"
        options={{
          title: '我的',
          tabBarIcon: ({ color }: { color: string }) => (
            <View style={styles.iconWrap}>
              <Text style={[styles.iconText, { color }]}>👤</Text>
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderColor: Colors.border,
    height: Platform.OS === 'ios' ? 88 : 60,
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
    paddingTop: 8,
    elevation: 8,
    shadowColor: Colors.cardShadow,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 1,
    shadowRadius: 6,
  },
  tabItem: {
    paddingVertical: 4,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
  },
  iconWrap: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    fontSize: 20,
  },
});
