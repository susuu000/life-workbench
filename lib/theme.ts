/**
 * 生活工作台 · 主题配色
 * 主色：秘色 #2E6F7E
 * 点缀：金 #C9A227 / 滇红 #8C2230 / 土 #B07D3C
 */

export const Colors = {
  // 品牌主色（对齐旧版「月夕生活台」）
  primary: '#2E6F7E',       // 秘色
  primaryLight: '#3D8FA0',
  primaryDark: '#1F4D5A',
  hazeBlueDark: '#1A5060',  // 深秘色（旧版侧栏渐变）

  // 点缀色（对齐旧版金/红 hex）
  gold: '#D4A847',          // 金（旧版 #D4A847）
  dianHong: '#C04830',      // 滇红 / 红（旧版 #C04830）
  tu: '#B07D3C',            // 土
  earth: '#8C6A4A',         // 土褐（阅读板块配色，旧版 --earth）

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

/** 根据主色派生浅/深两档（用于个性化主色实时生效） */
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
