/**
 * DarkModeProvider - 全局暗色模式 Provider
 * 
 * 整合系统主题检测 + 手动切换 + 持久化，
 * 提供统一的 useDarkMode hook 给所有组件使用。
 * 
 * 所有组件统一使用 useDarkMode() 替代手动传 colors，
 * 确保全局主题切换时所有组件同步更新。
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useColorScheme, Platform, Appearance } from 'react-native';
import { supabase, getCurrentUserId } from '@/lib/supabase';
import { Colors } from '@/lib/theme';
import { DarkColors, DarkModuleColors } from '@/lib/dark-theme';
import { ModuleColors } from '@/lib/theme';

// ===== 类型 =====
interface DarkModeContextType {
  /** 当前是否为暗色模式 */
  isDark: boolean;
  /** 是否跟随系统主题 */
  followSystem: boolean;
  /** 当前生效的配色（亮/暗自动选择） */
  colors: typeof Colors;
  /** 当前板块配色 */
  moduleColors: Record<string, string>;
  /** 切换暗色模式 */
  toggleDarkMode: () => void;
  /** 设置是否跟随系统 */
  setFollowSystem: (follow: boolean) => void;
  /** 直接设置暗色模式 */
  setDarkMode: (dark: boolean) => void;
}

const DarkModeContext = createContext<DarkModeContextType>({
  isDark: false,
  followSystem: false,
  colors: Colors,
  moduleColors: ModuleColors,
  toggleDarkMode: () => {},
  setFollowSystem: () => {},
  setDarkMode: () => {},
});

// ===== Provider =====
export function DarkModeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [isDark, setIsDark] = useState(false);
  const [followSystem, setFollowSystemState] = useState(true);
  const [loaded, setLoaded] = useState(false);

  // 从服务器加载主题设置
  useEffect(() => {
    let active = true;
    (async () => {
      const uid = await getCurrentUserId();
      if (!uid) {
        // 未登录时跟随系统
        if (active) {
          setIsDark(systemScheme === 'dark');
          setLoaded(true);
        }
        return;
      }
      const { data } = await supabase
        .from('user_settings')
        .select('dark_mode, follow_system_theme')
        .eq('user_id', uid)
        .maybeSingle();

      if (!active) return;

      if (data?.follow_system_theme !== false) {
        // 默认跟随系统
        setFollowSystemState(true);
        setIsDark(systemScheme === 'dark');
      } else if (data?.dark_mode !== undefined) {
        setFollowSystemState(false);
        setIsDark(data.dark_mode);
      } else {
        setIsDark(systemScheme === 'dark');
      }
      setLoaded(true);
    })();
    return () => { active = false; };
  }, [systemScheme]);

  // 监听系统主题变化（仅当 followSystem 时）
  useEffect(() => {
    if (!followSystem || !loaded) return;

    if (Platform.OS === 'web') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    } else {
      const sub = Appearance.addChangeListener(({ colorScheme }) => {
        setIsDark(colorScheme === 'dark');
      });
      return () => sub.remove();
    }
  }, [followSystem, loaded]);

  // 切换暗色模式
  const toggleDarkMode = useCallback(() => {
    const next = !isDark;
    setIsDark(next);
    setFollowSystemState(false);
    // 持久化
    (async () => {
      const uid = await getCurrentUserId();
      if (uid) {
        await supabase.from('user_settings').upsert({
          user_id: uid,
          dark_mode: next,
          follow_system_theme: false,
        }, { onConflict: 'user_id' });
      }
    })();
  }, [isDark]);

  // 设置跟随系统
  const setFollowSystem = useCallback((follow: boolean) => {
    setFollowSystemState(follow);
    if (follow) {
      setIsDark(systemScheme === 'dark');
    }
    (async () => {
      const uid = await getCurrentUserId();
      if (uid) {
        await supabase.from('user_settings').upsert({
          user_id: uid,
          follow_system_theme: follow,
          dark_mode: systemScheme === 'dark',
        }, { onConflict: 'user_id' });
      }
    })();
  }, [systemScheme]);

  // 直接设置
  const setDarkMode = useCallback((dark: boolean) => {
    setIsDark(dark);
    setFollowSystemState(false);
  }, []);

  // 计算当前配色
  const colors = useMemo(() => (isDark ? DarkColors : Colors), [isDark]);
  const moduleColors = useMemo(() => (isDark ? DarkModuleColors : ModuleColors), [isDark]);

  const value = useMemo(() => ({
    isDark, followSystem, colors, moduleColors,
    toggleDarkMode, setFollowSystem, setDarkMode,
  }), [isDark, followSystem, colors, moduleColors]);

  return (
    <DarkModeContext.Provider value={value}>
      {children}
    </DarkModeContext.Provider>
  );
}

// ===== Hook =====
export function useDarkMode() {
  return useContext(DarkModeContext);
}

/**
 * 便捷 Hook：获取带暗色感知的样式
 * 用法：const styles = useThemedStyles(createStyles);
 * createStyles 接收 colors 和 isDark 参数
 */
export function useThemedStyles<T extends Record<string, any>>(
  factory: (colors: typeof Colors, isDark: boolean) => T
): T {
  const { colors, isDark } = useDarkMode();
  return useMemo(() => factory(colors, isDark), [colors, isDark]);
}
