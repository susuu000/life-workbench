/**
 * Design Tokens - 全局设计令牌系统
 * 
 * 统一管理所有视觉常量，确保全站一致性：
 * - 间距体系（4px 基础单位）
 * - 阴影层次（5 级）
 * - 圆角规范（5 级）
 * - 动画参数（时长 + 缓动函数）
 * - 响应式断点
 * - Z-Index 层级
 * - 排版体系
 * 
 * 所有组件应从本文件引用设计令牌，而非硬编码数值。
 */

import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ===== 间距体系（4px 基础网格）=====
export const Space = {
  /** 0px */
  none: 0,
  /** 4px */
  xs: 4,
  /** 8px */
  sm: 8,
  /** 12px */
  md: 12,
  /** 16px */
  lg: 16,
  /** 20px */
  xl: 20,
  /** 24px */
  xxl: 24,
  /** 32px */
  xxxl: 32,
  /** 40px */
  huge: 40,
  /** 48px */
  massive: 48,
  /** 64px */
  giant: 64,
} as const;

// ===== 阴影层次 =====
export const Shadow = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  /** 微妙阴影 - 卡片默认 */
  subtle: {
    shadowColor: 'rgba(60,50,30,0.06)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 1,
  },
  /** 标准阴影 - 卡片悬停 */
  standard: {
    shadowColor: 'rgba(60,50,30,0.1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
  /** 强调阴影 - 弹窗/模态框 */
  elevated: {
    shadowColor: 'rgba(60,50,30,0.15)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 6,
  },
  /** 浮动阴影 - 侧边栏/抽屉 */
  floating: {
    shadowColor: 'rgba(0,0,0,0.2)',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 10,
  },
  /** 重阴影 - FAB/重要操作 */
  heavy: {
    shadowColor: 'rgba(0,0,0,0.25)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 16,
  },
} as const;

// ===== 圆角规范 =====
export const Radius = {
  /** 2px - 极小圆角 */
  xs: 2,
  /** 4px - 标签/徽标 */
  sm: 6,
  /** 8px - 输入框/小卡片 */
  md: 10,
  /** 12px - 标准卡片 */
  lg: 16,
  /** 16px - 大卡片 */
  xl: 20,
  /** 24px - 特大卡片/图片 */
  xxl: 24,
  /** 999px - 胶囊/药丸 */
  full: 999,
} as const;

// ===== 动画参数 =====
export const Motion = {
  /** 快速（按钮反馈） */
  fast: {
    duration: 150,
    easing: 'easeOut' as const,
  },
  /** 标准（过渡动画） */
  normal: {
    duration: 250,
    easing: 'easeInOut' as const,
  },
  /** 慢速（页面切换） */
  slow: {
    duration: 350,
    easing: 'easeInOut' as const,
  },
  /** 弹性（弹窗出现） */
  spring: {
    tension: 65,
    friction: 11,
  },
  /** 轻弹（小元素） */
  lightSpring: {
    tension: 120,
    friction: 14,
  },
} as const;

// ===== Z-Index 层级 =====
export const ZIndex = {
  /** 内容层 */
  content: 1,
  /** 粘性头部 */
  sticky: 10,
  /** 下拉菜单 */
  dropdown: 50,
  /** 遮罩层 */
  overlay: 80,
  /** 侧边栏/抽屉 */
  drawer: 90,
  /** 模态框 */
  modal: 100,
  /** Toast/提示 */
  toast: 110,
  /** 最高优先级 */
  top: 999,
} as const;

// ===== 响应式断点 =====
export const Breakpoint = {
  /** 手机竖屏 */
  mobile: 480,
  /** 平板竖屏 / 手机横屏 */
  tablet: 768,
  /** 平板横屏 / 小桌面 */
  desktop: 1024,
  /** 大桌面 */
  wide: 1280,
} as const;

// ===== 当前屏幕信息 =====
export const Screen = {
  width: SCREEN_WIDTH,
  height: SCREEN_HEIGHT,
  /** 是否为移动端 */
  isMobile: SCREEN_WIDTH < Breakpoint.tablet,
  /** 是否为平板 */
  isTablet: SCREEN_WIDTH >= Breakpoint.tablet && SCREEN_WIDTH < Breakpoint.desktop,
  /** 是否为桌面端 */
  isDesktop: SCREEN_WIDTH >= Breakpoint.desktop,
};

// ===== 排版体系 =====
export const Type = {
  /** 标题层级 */
  heading: {
    h1: { fontSize: 30, fontWeight: '700' as const, lineHeight: 38 },
    h2: { fontSize: 24, fontWeight: '700' as const, lineHeight: 32 },
    h3: { fontSize: 20, fontWeight: '600' as const, lineHeight: 28 },
    h4: { fontSize: 17, fontWeight: '600' as const, lineHeight: 24 },
  },
  /** 正文层级 */
  body: {
    large: { fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
    normal: { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
    small: { fontSize: 13, fontWeight: '400' as const, lineHeight: 20 },
  },
  /** 辅助文本 */
  caption: {
    normal: { fontSize: 12, fontWeight: '400' as const, lineHeight: 18 },
    small: { fontSize: 11, fontWeight: '400' as const, lineHeight: 16 },
    tiny: { fontSize: 10, fontWeight: '400' as const, lineHeight: 14 },
  },
  /** 特殊 */
  special: {
    timeHuge: { fontSize: 64, fontWeight: '200' as const, fontFamily: 'Times New Roman' },
    dateLarge: { fontSize: 22, fontWeight: '600' as const },
  },
} as const;

// ===== 图标尺寸 =====
export const IconSize = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

// ===== 触摸目标最小尺寸（无障碍）=====
export const TouchTarget = {
  min: 44, // Apple HIG 推荐
};

// ===== 常用组合 =====
/** 卡片预设 */
export const CardPreset = {
  padding: Space.lg,
  borderRadius: Radius.lg,
  gap: Space.md,
};

/** 按钮预设 */
export const ButtonPreset = {
  paddingHorizontal: Space.xl,
  paddingVertical: Space.sm + 2,
  borderRadius: Radius.full,
  minHeight: TouchTarget.min,
};

/** 输入框预设 */
export const InputPreset = {
  paddingHorizontal: Space.md,
  paddingVertical: Space.sm + 2,
  borderRadius: Radius.md,
  fontSize: Type.body.normal.fontSize,
};

// ===== 导出类型 =====
export type ShadowLevel = keyof typeof Shadow;
export type RadiusLevel = keyof typeof Radius;
export type SpaceLevel = keyof typeof Space;
export type MotionPreset = keyof typeof Motion;
