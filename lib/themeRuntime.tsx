/**
 * 运行时主题：根据 user_settings 的个性化设置（主色/字体/字号/密度）
 * 实时派生一套 Colors，供关键界面消费。
 *
 * 用法：在根布局用 <ThemeProvider> 包裹，组件内 const { colors, fontScale, fontFamilyCss } = useTheme()。
 */
import React, { createContext, useContext, useMemo, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import { Colors, deriveShades, FontSize } from './theme';

export interface ThemeOverrides {
  themeColor?: string | null;
  fontFamily?: string | null;   // 'default' | 'serif' | 'kai'
  fontSize?: number | null;     // 基准 px，默认 16
  density?: string | null;      // 'comfortable' | 'compact'
}

type MergedColors = {
  primary: string;
  primaryLight: string;
  primaryDark: string;
  hazeBlueDark: string;
  gold: string;
  dianHong: string;
  tu: string;
  earth: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  background: string;
  surface: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  divider: string;
  cardBg: string;
  cardShadow: string;
};

interface ThemeCtxValue {
  colors: MergedColors;
  fontScale: number;
  fontFamilyCss: string;
  density: 'comfortable' | 'compact';
  setOverrides: (o: ThemeOverrides) => void;
}

const ThemeContext = createContext<ThemeCtxValue | null>(null);

const FONT_FAMILY_CSS: Record<string, string> = {
  default: '"PingFang SC","Noto Sans SC",sans-serif',
  serif: '"Songti SC","SimSun",serif',
  kai: '"Kaiti SC","KaiTi",serif',
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [overrides, setOverridesState] = useState<ThemeOverrides>({});

  const setOverrides = useCallback((o: ThemeOverrides) => {
    setOverridesState((prev) => ({ ...prev, ...o }));
  }, []);

  const value = useMemo<ThemeCtxValue>(() => {
    const merged: MergedColors = { ...Colors } as MergedColors;
    if (overrides.themeColor && /^#[0-9A-Fa-f]{6}$/.test(overrides.themeColor)) {
      const shades = deriveShades(overrides.themeColor);
      merged.primary = shades.primary;
      merged.primaryLight = shades.primaryLight;
      merged.primaryDark = shades.primaryDark;
      merged.cardShadow = `rgba(${parseInt(overrides.themeColor.slice(1, 3), 16)},${parseInt(
        overrides.themeColor.slice(3, 5),
        16
      )},${parseInt(overrides.themeColor.slice(5, 7), 16)},0.08)`;
    }

    const fontScale = overrides.fontSize && overrides.fontSize > 0 ? overrides.fontSize / 16 : 1;
    const fontFamilyCss =
      FONT_FAMILY_CSS[overrides.fontFamily || 'default'] || FONT_FAMILY_CSS.default;
    const density = overrides.density === 'compact' ? 'compact' : 'comfortable';

    return { colors: merged, fontScale, fontFamilyCss, density, setOverrides };
  }, [overrides]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeCtxValue {
  const ctx = useContext(ThemeContext);
  if (ctx) return ctx;
  // 兜底：未包裹 Provider 时返回默认主题
  return {
    colors: Colors as unknown as MergedColors,
    fontScale: 1,
    fontFamilyCss: FONT_FAMILY_CSS.default,
    density: 'comfortable',
    setOverrides: () => {},
  };
}

/** 字号缩放工具：传入基准 FontSize 常量，返回缩放后的数值 */
export function scaled(scale: number, base: number): number {
  return Math.round(base * scale);
}

/** 客户端统一写入个性化后，应用字体到 Web 文档（仅 web 生效） */
export function applyWebFontFamily(css: string) {
  if (Platform.OS !== 'web') return;
  try {
    (document as any).documentElement.style.setProperty('--app-font', css);
  } catch {
    /* ignore */
  }
}

export { FontSize };
