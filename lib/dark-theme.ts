/**
 * 暗色模式主题配色
 * 
 * 与亮色模式对应的完整暗色配色方案。
 * 基于 CodeBuddy 版「月夕生活台」的暗色调设计。
 */

export const DarkColors = {
  // ===== 品牌主色（暗色模式下略调亮）=====
  primary: '#3A8A9E',           // 浅秘色（暗色下需要更亮）
  primaryLight: '#4DA0B4',
  primaryDark: '#2E6F7E',
  primaryDeeper: '#1A5060',
  hazeBlueDark: '#1A5060',

  // ===== 点缀色（暗色模式下饱和度略降）=====
  gold: '#D4A847',
  goldLight: '#E0BC5A',
  goldPale: '#E8CC70',
  earth: '#A8896A',
  earthLight: '#BFA080',
  dianHong: '#D07060',
  redLight: '#E08878',
  redPale: '#E89888',

  // ===== 功能色 =====
  success: '#6B9C6A',
  warning: '#E0A040',
  error: '#E06050',
  info: '#5090D0',

  // ===== 中性色（暗色核心）=====
  background: '#1A1D20',       // 深灰黑底
  backgroundWarm: '#212428',   // 暖黑
  surface: '#282C30',          // 卡片黑
  surfaceHover: '#303438',     // 卡片悬停
  textPrimary: '#E8E4DD',      // 浅米白（护眼）
  textSecondary: '#B0AAA2',    // 中灰
  textMuted: '#787268',        // 暗灰
  border: '#383C40',           // 边框
  borderLight: '#303438',      // 浅边框
  divider: '#383C40',

  // ===== 卡片 =====
  cardBg: '#282C30',
  cardShadow: 'rgba(0,0,0,0.3)',
  cardShadowMd: 'rgba(0,0,0,0.4)',
  cardShadowLg: 'rgba(0,0,0,0.5)',

  // ===== 渐变背景 =====
  gradientPrimaryStart: '#2E6F7E',
  gradientPrimaryEnd: '#1A3038',

  // ===== 侧边栏 =====
  sidebarBg: '#1A5060',
  sidebarBgEnd: '#0F3038',
  sidebarText: 'rgba(255,255,255,0.7)',
  sidebarTextActive: '#FFFFFF',
  sidebarBorder: 'rgba(255,255,255,0.1)',
  sidebarActiveBg: 'rgba(255,255,255,0.15)',
  sidebarHoverBg: 'rgba(255,255,255,0.08)',

  // ===== 骨架屏 =====
  skeleton: '#303438',
  skeletonShine: '#3A3E42',
} as const;

/** 暗色模式板块颜色 */
export const DarkModuleColors: Record<string, string> = {
  english: '#3A8A9E',
  ai_learning: '#D4A847',
  reading: '#A8896A',
  podcast: '#9070E0',
  social_media: '#D07060',
  self_explore: '#3A8A9E',
};
