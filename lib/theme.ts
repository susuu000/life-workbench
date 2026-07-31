/**
 * 生活工作台 · 主题配色
 * 主色：秘色 #2E6F7E
 * 点缀：金 #C9A227 / 滇红 #8C2230 / 土 #B07D3C
 */

export const Colors = {
  // 品牌主色
  primary: '#2E6F7E',       // 秘色
  primaryLight: '#3D8FA0',
  primaryDark: '#1F4D5A',

  // 点缀色
  gold: '#C9A227',          // 金
  dianHong: '#8C2230',      // 滇红
  tu: '#B07D3C',            // 土

  // 功能色
  success: '#2E7D32',
  warning: '#F57F17',
  error: '#C62828',
  info: '#1565C0',

  // 中性色
  background: '#F5F4EF',    // 米白底（护眼）
  surface: '#FFFFFF',
  textPrimary: '#1A1A1A',
  textSecondary: '#666666',
  textMuted: '#999999',
  border: '#E0DDD5',
  divider: '#D5D2CA',

  // 卡片
  cardBg: '#FFFFFF',
  cardShadow: 'rgba(46,111,126,0.08)',
} as const;

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
  timeHuge: 64,            // 首页时间卡片专用
} as const;

export const BorderRadius = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  full: 999,
} as const;

// 首页时间字体：Times New Roman（iOS 系统自带，Web 标准字体）
export const TimeFontFamily = {
  ios: 'Times New Roman',
  android: 'serif',
  web: "'Times New Roman', Times, serif",
};
