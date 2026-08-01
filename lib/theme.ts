/**
 * 生活工作台 · 主题配色（v3 优化版）
 * 
 * 主色：秘色 #2E6F7E（对齐 CodeBuddy 版「月夕生活台」）
 * 点缀：金 #D4A847 / 滇红 #C04830 / 土 #8B6F47
 * 
 * 变更：
 * - 引入 CodeBuddy 版的 CSS 变量体系
 * - 增加渐变背景色定义
 * - 增加阴影层次
 * - 新增骨架屏颜色
 */

export const Colors = {
  // ===== 品牌主色（对齐 CodeBuddy 版「月夕生活台」）=====
  primary: '#2E6F7E',           // 秘色
  primaryLight: '#3A8A9E',     // 浅秘色
  primaryDark: '#1A5060',      // 深秘色
  primaryDeeper: '#134050',    // 更深秘色（渐变底部）
  hazeBlueDark: '#1A5060',     // 深秘色（旧版兼容）

  // ===== 点缀色（对齐 CodeBuddy 版 CSS 变量）=====
  gold: '#D4A847',             // 金
  goldLight: '#E8C547',        // 浅金
  goldPale: '#F0D060',         // 淡金
  earth: '#8B6F47',            // 土
  earthLight: '#A8896A',       // 浅土
  dianHong: '#C04830',         // 滇红
  redLight: '#D85A42',         // 浅红
  redPale: '#E88070',          // 淡红

  // ===== 功能色 =====
  success: '#5B8C5A',
  warning: '#D4943B',
  error: '#C62828',
  info: '#1565C0',

  // ===== 中性色（对齐 CodeBuddy 版）=====
  background: '#F5F0E8',       // 米白底（纸色，护眼）
  backgroundWarm: '#FAF5ED',   // 暖米白
  surface: '#FFFEF9',          // 卡片白
  surfaceHover: '#FBF7F0',     // 卡片悬停
  textPrimary: '#2C2416',      // 墨色
  textSecondary: '#5C5040',    // 浅墨
  textMuted: '#8C8070',        // 淡墨
  border: '#E0D8CC',           // 边框
  borderLight: '#EDE8DF',      // 浅边框
  divider: '#D5D2CA',

  // ===== 卡片 =====
  cardBg: '#FFFEF9',
  cardShadow: 'rgba(60, 50, 30, 0.08)',
  cardShadowMd: 'rgba(60, 50, 30, 0.12)',
  cardShadowLg: 'rgba(60, 50, 30, 0.18)',

  // ===== 渐变背景（CodeBuddy 版引入）=====
  gradientPrimaryStart: '#2E6F7E',
  gradientPrimaryEnd: '#1A5060',

  // ===== 侧边栏（CodeBuddy 版引入）=====
  sidebarBg: '#2E6F7E',
  sidebarBgEnd: '#1A5060',
  sidebarText: 'rgba(255,255,255,0.75)',
  sidebarTextActive: '#FFFFFF',
  sidebarBorder: 'rgba(255,255,255,0.12)',
  sidebarActiveBg: 'rgba(255,255,255,0.18)',
  sidebarHoverBg: 'rgba(255,255,255,0.1)',

  // ===== 骨架屏 =====
  skeleton: '#E8E3D8',
  skeletonShine: '#F0ECE3',
} as const;

/** 根据主色派生浅/深两档 */
export function deriveShades(hex: string): { primary: string; primaryLight: string; primaryDark: string } {
  const h = hex.replace('#', '');
  if (h.length !== 6) return { primary: hex, primaryLight: hex, primaryDark: hex };
  const num = parseInt(h, 16);
  const r = (num >> 16) & 255, g = (num >> 8) & 255, b = num & 255;
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const toHex = (v: number) => clamp(v).toString(16).padStart(2, '0');
  const mix = (target: number, amt: number) =>
    toHex(r + (target - r) * amt) + toHex(g + (target - g) * amt) + toHex(b + (target - b) * amt);
  return {
    primary: hex,
    primaryLight: '#' + mix(255, 0.25),
    primaryDark: '#' + mix(0, 0.18),
  };
}

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const FontSize = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 24,
  xxl: 30,
  timeHuge: 64,
  dateLarge: 22,    // 新增：首页日期大字
} as const;

export const BorderRadius = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  full: 999,
} as const;

/** 首页时间字体 */
export const TimeFontFamily = {
  ios: 'Times New Roman',
  android: 'serif',
  web: "'Times New Roman', Times, serif",
};

/** 板块颜色映射（对齐 CodeBuddy 版） */
export const ModuleColors: Record<string, string> = {
  english: '#2E6F7E',       // 秘色（英语/雅思）
  ai_learning: '#D4A847',   // 金（AI学习）
  reading: '#8B6F47',       // 土（阅读）
  podcast: '#7B3FF2',       // 紫（播客，CodeBuddy 版使用）
  social_media: '#C04830',  // 滇红（自媒体）
  self_explore: '#1A5060',  // 深秘色（自我探索）
};
