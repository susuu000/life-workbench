import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, Text, StyleSheet } from 'react-native';
import React, { useEffect, useState } from 'react';
import { supabase, getCurrentUserId } from '@/lib/supabase';
import { Colors } from '@/lib/theme';
import { ThemeProvider, useTheme, applyWebFontFamily } from '@/lib/themeRuntime';
import EdgeSwipe from '@/components/EdgeSwipe';

/**
 * 根布局：全局状态栏 + 认证守卫 + 导航壳 + 运行时主题
 * 未登录 → 自动重定向到 /(auth)/login
 * 已登录 → 显示底部三 Tab（首页/发现/我的）
 */
export default function RootLayout() {
  return (
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  );
}

function AppShell() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const segments = useSegments();
  const router = useRouter();
  const { setOverrides, fontFamilyCss } = useTheme();

  useEffect(() => {
    // 获取初始会话
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setLoading(false);
    });

    // 监听认证状态变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, s) => {
        setSession(s);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // 加载个性化主题（user_settings）
  useEffect(() => {
    let active = true;
    (async () => {
      const uid = await getCurrentUserId();
      if (!uid) return;
      const { data } = await supabase
        .from('user_settings')
        .select('theme_color, font_family, font_size, density')
        .eq('user_id', uid)
        .maybeSingle();
      if (active && data) {
        setOverrides({
          themeColor: data.theme_color,
          fontFamily: data.font_family,
          fontSize: data.font_size,
          density: data.density,
        });
        applyWebFontFamily(fontFamilyCss);
      }
    })();
    return () => {
      active = false;
    };
  }, [session, setOverrides, fontFamilyCss]);

  // 认证守卫：未登录且不在 auth 页面 → 跳转登录
  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    }
    if (session && inAuthGroup) {
      // Web 静态导出下 /(tabs)/index 可能触发 "Unmatched Route"，
      // 统一用根路径 /（expo-router 会自动渲染 tabs/index 内容）
      router.replace('/');
    }
  }, [session, loading, segments]);

  if (loading) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>Susu</Text>
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" backgroundColor={Colors.primary} />
      <View style={styles.container}>
        <EdgeSwipe>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)/module/[key]" options={{ title: '界面', headerShown: false }} />
        </Stack>
        </EdgeSwipe>
        {/* 云端连接状态条 */}
        <CloudStatusBadge />
      </View>
    </>
  );
}

/** 云端状态指示器 */
function CloudStatusBadge() {
  const [status, setStatus] = useState<'connected' | 'disconnected'>('connected');

  useEffect(() => {
    let mounted = true;
    async function check() {
      try {
        const { error } = await supabase.from('profiles').select('id').limit(1);
        if (mounted) setStatus(error ? 'disconnected' : 'connected');
      } catch {
        if (mounted) setStatus('disconnected');
      }
    }
    check();
    const id = setInterval(check, 30000); // 每30秒检测
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

  return (
    <View style={[styles.badge, status === 'disconnected' && styles.badgeError]}>
      <View style={[styles.dot, status === 'connected' ? styles.dotConnected : styles.dotDisconnected]} />
      <Text style={styles.badgeText}>
        {status === 'connected' ? '云端已连接' : '云端已断开'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: {
    flex: 1,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: { fontSize: 32, color: '#FFFFFF', fontWeight: 'bold', letterSpacing: 8 },
  badge: {
    // Web/PWA 模式下不使用绝对定位（会与 Tab 栏重叠），
    // 改由各页面自行决定是否展示云端状态
    display: 'none',
  },
  badgeError: { backgroundColor: '#FFF5F5' },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 4 },
  dotConnected: { backgroundColor: Colors.success },
  dotDisconnected: { backgroundColor: Colors.error },
  badgeText: { fontSize: 10, color: Colors.textMuted },
});
