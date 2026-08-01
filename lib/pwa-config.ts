/**
 * PWA 配置 + iOS 体验优化
 * 
 * 用于更新 app.json 的 expo.web 和 PWA 相关配置
 * 
 * 变更说明：
 * 1. 更新主题色和背景色
 * 2. 配置完整的 PWA manifest
 * 3. 优化 iOS standalone 模式体验
 * 4. 添加启动画面配置
 */

// ===== 需要更新 app.json 的字段 =====

export const PWA_CONFIG = {
  // expo.web 配置
  web: {
    bundler: 'metro',
    output: 'static',
    favicon: './assets/icon.svg',
  },

  // expo.web.manifest（PWA manifest.json）
  manifest: {
    name: '月夕生活台',
    short_name: '月夕',
    description: '个人生活工作台 · 学习打卡 · 内容聚合 · 自我管理',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#F5F0E8',
    theme_color: '#2E6F7E',
    lang: 'zh-CN',
    dir: 'ltr',
    categories: ['productivity', 'lifestyle', 'education'],
    icons: [
      { src: '/assets/icon-72.png', sizes: '72x72', type: 'image/png' },
      { src: '/assets/icon-96.png', sizes: '96x96', type: 'image/png' },
      { src: '/assets/icon-128.png', sizes: '128x128', type: 'image/png' },
      { src: '/assets/icon-144.png', sizes: '144x144', type: 'image/png' },
      { src: '/assets/icon-152.png', sizes: '152x152', type: 'image/png' },
      { src: '/assets/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: '/assets/icon-384.png', sizes: '384x384', type: 'image/png' },
      { src: '/assets/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
    screenshots: [],
    shortcuts: [
      {
        name: '今日打卡',
        short_name: '打卡',
        description: '快速查看今日打卡状态',
        url: '/?shortcut=checkin',
      },
    ],
  },

  // iOS 特定 meta 标签（在 index.html 中配置）
  iosMeta: {
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
    'apple-mobile-web-app-title': '月夕',
    'format-detection': 'telephone=no',
  },

  // splash screen 配置（app.json 中）
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#2E6F7E',
    imageWidth: 200,
  },
};
