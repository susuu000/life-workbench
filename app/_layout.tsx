/**
 * 月夕生活台 · 根布局
 *
 * 全局 Provider 集成入口：
 * - DarkModeProvider    暗色模式 + 系统主题跟随
 * - SafeAreaProvider    安全区域适配
 * - SyncEngine          离线队列 + 多端同步
 * - SidebarV3           侧边栏导航
 * - ErrorBoundary       全局错误边界
 * - SplashScreen        启动画面
 * - 离线检测             断网提示
 *
 * Provider 嵌套顺序（从外到内）：
 * 1. SafeAreaProvider      — 最外层，供所有组件访问 safe-area insets
 * 2. DarkModeProvider      — 主题上下文，所有组件均可感知暗/亮模式
 * 3. ErrorBoundary         — 兜底捕获未处理异常
 * 4. SyncProvider          — 离线队列 + 自动同步
 * 5. Sidebar + Stack       — 导航骨架
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Platform, StatusBar, TouchableOpacity } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';

import { DarkModeProvider, useDarkMode } from '@/lib/DarkModeProvider';
import { SyncEngine, useOnlineStatus, SyncIndicator } from '@/lib/sync-manager';
import SidebarV3 from '@/components/SidebarV3';
import { Space, ZIndex } from '@/lib/design-tokens';
import { Colors } from '@/lib/theme';

// 保持启动画面直到根布局渲染完毕
SplashScreen.preventAutoHideAsync().catch(() => {});

// ===== 错误边界 =====
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[月夕生活台] 未捕获错误:', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={errorStyles.container}>
          <Text style={errorStyles.emoji}>🪷</Text>
          <Text style={errorStyles.title}>出了点小问题</Text>
          <Text style={errorStyles.message}>
            {this.state.error?.message || '应用遇到了未知错误'}
          </Text>
          <TouchableOpacity style={errorStyles.button} onPress={this.handleReset}>
            <Text style={errorStyles.buttonText}>重试</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const errorStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F0E8',
    padding: 40,
    gap: 12,
  },
  emoji: { fontSize: 64, marginBottom: 8 },
  title: { fontSize: 20, fontWeight: '700', color: '#2C2416' },
  message: { fontSize: 14, color: '#8C8070', textAlign: 'center', lineHeight: 20 },
  button: {
    marginTop: 20,
    paddingHorizontal: 32,
    paddingVertical: 12,
    backgroundColor: '#2E6F7E',
    borderRadius: 999,
  },
  buttonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 15 },
});

// ===== 离线提示条 =====
function OfflineBanner() {
  const online = useOnlineStatus();

  if (online) return null;

  return (
    <View style={offlineStyles.banner}>
      <Text style={offlineStyles.text}>📡 网络已断开 — 数据将在恢复连接后自动同步</Text>
    </View>
  );
}

const offlineStyles = StyleSheet.create({
  banner: {
    backgroundColor: '#C04830',
    paddingVertical: 6,
    paddingHorizontal: Space.lg,
    alignItems: 'center',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
});

// ===== 同步 Provider（轻量包装）=====
function SyncProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // 页面加载时尝试同步离线队列
    const engine = SyncEngine.getInstance();
    if (engine.getPendingCount() > 0) {
      engine.sync();
    }

    // 定时检查（每 30 秒）
    const interval = setInterval(() => {
      if (engine.getPendingCount() > 0 && engine.status === 'idle') {
        engine.sync();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  return <>{children}</>;
}

// ===== 根导航栈 =====
function RootNavigator() {
  const router = useRouter();
  const segments = useSegments();
  const { isDark, colors } = useDarkMode();

  // ---- 侧边栏状态 ----
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [customSections, setCustomSections] = useState<Array<{ id: string; name: string; icon?: string }>>([]);
  const [moduleKeys, setModuleKeys] = useState<string[]>([]);

  // 加载自定义板块
  useEffect(() => {
    (async () => {
      try {
        const { getCurrentUserId, supabase } = await import('@/lib/supabase');
        const uid = await getCurrentUserId();
        if (!uid) return;
        const { data } = await supabase
          .from('custom_modules')
          .select('*')
          .eq('user_id', uid);
        if (data) {
          setCustomSections(data.map((m: any) => ({ id: m.id, name: m.name, icon: m.icon })));
        }
        // 加载用户启用的板块
        const { data: settings } = await supabase
          .from('user_settings')
          .select('module_keys')
          .eq('user_id', uid)
          .maybeSingle();
        if (settings?.module_keys) {
          setModuleKeys(settings.module_keys);
        }
      } catch {}
    })();
  }, []);

  // 同步 StatusBar
  useEffect(() => {
    if (Platform.OS !== 'web') {
      StatusBar.setBarStyle(isDark ? 'light-content' : 'dark-content');
    }
  }, [isDark]);

  // 隐藏启动画面
  const onLayoutRootView = useCallback(async () => {
    await SplashScreen.hideAsync();
  }, []);

  // 判断当前是否在 tabs 页面
  const isTabsScreen = segments.length === 0 ||
    (segments.length === 1 && ['index', 'discover', 'mine'].includes(segments[0]));

  // 侧边栏导航选择
  const handleSidebarSelect = useCallback((key: string) => {
  if (key === 'home') {
    router.push('/');
  } else if (key === 'discover') {
    router.push('/discover');
  } else if (key === 'profile') {
    router.push('/mine');
  } else if (key === 'settings') {
    router.push('/settings');
  } else {
    router.push(`/module/${key}`);
  }
  if (Platform.OS !== 'web') {
    setSidebarVisible(false);
  }
}, [router]);


  return (
    <View style={[{ flex: 1, backgroundColor: colors.background }]} onLayout={onLayoutRootView}>
      {/* 离线提示条 */}
      <OfflineBanner />

      {/* 同步指示器（右上角浮动） */}
      <View style={rootStyles.syncContainer}>
        <SyncIndicator />
      </View>

      {/* 主内容区：侧边栏 + Stack */}
      <View style={rootStyles.mainArea}>
        {/* 桌面端：固定侧边栏；移动端：Modal 侧边栏 */}
        {isTabsScreen && Platform.OS === 'web' && (
          <View style={rootStyles.sidebarWrapper}>
            <SidebarV3
              visible={true}
              onClose={() => {}}
              onSelect={handleSidebarSelect}
              custom={customSections}
              onCustomChange={setCustomSections}
              moduleKeys={moduleKeys as any}
            />
          </View>
        )}

        {/* 移动端侧边栏切换按钮 */}
        {isTabsScreen && Platform.OS !== 'web' && (
          <TouchableOpacity
            style={rootStyles.hamburger}
            onPress={() => setSidebarVisible(true)}
          >
            <Text style={{ fontSize: 22, color: colors.textPrimary }}>☰</Text>
          </TouchableOpacity>
        )}

        {/* 移动端侧边栏 Modal */}
        {Platform.OS !== 'web' && (
          <SidebarV3
            visible={sidebarVisible}
            onClose={() => setSidebarVisible(false)}
            onSelect={handleSidebarSelect}
            custom={customSections}
            onCustomChange={setCustomSections}
            moduleKeys={moduleKeys as any}
          />
        )}

        {/* 页面栈 */}
        <View style={rootStyles.stackWrapper}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen
              name="module/[key]"
              options={{
                presentation: 'card',
                animation: 'slide_from_right',
              }}
            />
          </Stack>
        </View>
      </View>
    </View>
  );
}

// ===== 根组件 =====
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <DarkModeProvider>
        <ErrorBoundary>
          <SyncProvider>
            <RootNavigator />
          </SyncProvider>
        </ErrorBoundary>
      </DarkModeProvider>
    </SafeAreaProvider>
  );
}

// ===== 样式 =====
const rootStyles = StyleSheet.create({
  mainArea: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebarWrapper: {
    width: Platform.OS === 'web' ? 220 : 260,
    zIndex: ZIndex.drawer,
  },
  stackWrapper: {
    flex: 1,
    overflow: 'hidden',
  },
  syncContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 12,
    right: Space.lg,
    zIndex: ZIndex.sticky,
  },
  hamburger: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 8,
    left: Space.lg,
    zIndex: ZIndex.sticky,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
