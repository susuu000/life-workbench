/**
 * ThemeRuntime v3 - 运行时主题管理
 * 
 * 新增：
 * - 暗色模式切换
 * - 自动跟随系统主题（可选）
 * - 主题持久化到 Supabase user_settings.dark_mode
 * 
 * 使用方式：
 *   <ThemeProvider>
 *     <App />
 *   </ThemeProvider>
 * 
 *   组件内使用：const { colors, darkMode, toggleDarkMode } = useTheme();
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useColorScheme, Platform } from 'react-native';
import { supabase, getCurrentUserId } from '@/lib/supabase';
import { Colors, deriveShades, Spacing, FontSize, BorderRadius, ModuleColors } from '@/lib/theme';
import { DarkColors, DarkModuleColors } from '@/lib/dark-theme';

// ===== 类型 =====
interface ThemeOverrides {
  themeColor?: string;
  fontFamily?: string;
  fontSize?: number;
  density?: string;
}

interface ThemeContextType {
  colors: typeof Colors;
  darkMode: boolean;
  followSystem: boolean;
  moduleColors: Record<string, string>;
  setOverrides: (overrides: ThemeOverrides) => void;
  toggleDarkMode: () => void;
  setFollowSystem: (follow: boolean) => void;
  fontFamilyCss: string;
}

const ThemeContext = createContext<ThemeContextType>({
  colors: Colors,
  darkMode: false,
  followSystem: false,
  moduleColors: ModuleColors,
  setOverrides: () => {},
  toggleDarkMode: () => {},
  setFollowSystem: () => {},
  fontFamilyCss: '',
});

// ===== Provider =====
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [darkMode, setDarkMode] = useState(false);
  const [followSystem, setFollowSystemState] = useState(false);
  const [overrides, setOverrides] = useState<ThemeOverrides>({});

  // 从服务器加载主题设置
  useEffect(() => {
    (async () => {
      const uid = await getCurrentUserId();
      if (!uid) return;
      const { data } = await supabase
        .from('user_settings')
        .select('dark_mode, theme_color, font_family, font_size, density')
        .eq('user_id', uid)
        .maybeSingle();
      if (data) {
        if (data.dark_mode !== undefined) setDarkMode(data.dark_mode);
        setOverrides({
          themeColor: data.theme_color,
          fontFamily: data.font_family,
          fontSize: data.font_size,
          density: data.density,
        });
      }
    })();
  }, []);

  // 跟随系统主题
  useEffect(() => {
    if (followSystem && systemScheme) {
      setDarkMode(systemScheme === 'dark');
    }
  }, [systemScheme, followSystem]);

  // 切换暗色模式
  const toggleDarkMode = useCallback(() => {
    const next = !darkMode;
    setDarkMode(next);
    setFollowSystemState(false);
    // 持久化
    (async () => {
      const uid = await getCurrentUserId();
      if (uid) {
        await supabase
          .from('user_settings')
          .update({ dark_mode: next })
          .eq('user_id', uid);
      }
    })();
  }, [darkMode]);

  // 设置跟随系统
  const setFollowSystem = useCallback((follow: boolean) => {
    setFollowSystemState(follow);
    if (follow && systemScheme) {
      setDarkMode(systemScheme === 'dark');
    }
  }, [systemScheme]);

  // 应用个性化覆盖
  const applyOverrides = useCallback((o: ThemeOverrides) => {
    setOverrides((prev) => ({ ...prev, ...o }));
  }, []);

  // 计算实际颜色
  const baseColors = darkMode ? DarkColors : Colors;
  
  // 如果有个性化主题色，派生并覆盖
  let effectiveColors = { ...baseColors };
  if (overrides.themeColor) {
    const shades = deriveShades(overrides.themeColor);
    effectiveColors = {
      ...effectiveColors,
      primary: shades.primary,
      primaryLight: shades.primaryLight,
      primaryDark: shades.primaryDark,
    };
  }

  // 板块颜色
  const effectiveModuleColors = darkMode ? DarkModuleColors : ModuleColors;

  // 字体 CSS（Web 端）
  const fontFamilyCss = overrides.fontFamily || '';

  const value: ThemeContextType = {
    colors: effectiveColors,
    darkMode,
    followSystem,
    moduleColors: effectiveModuleColors,
    setOverrides: applyOverrides,
    toggleDarkMode,
    setFollowSystem,
    fontFamilyCss,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

// ===== Hook =====
export function useTheme() {
  return useContext(ThemeContext);
}

// ===== Web 字体应用（在 _layout.tsx 中调用）=====
export function applyWebFontFamily(css: string) {
  if (Platform.OS === 'web' && css) {
    document.body.style.fontFamily = css;
  }
}
