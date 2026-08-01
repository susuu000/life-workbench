#!/usr/bin/env node

/**
 * 月夕生活台 — App图标 & 启动画面自动生成脚本
 *
 * 用法:
 *   node scripts/generate-icons.js
 *
 * 前置条件:
 *   - 需要安装 canvas: npm install canvas
 *   - 或使用 sharp (更轻量): npm install sharp
 *
 * 输出:
 *   - public/icons/   — PWA多尺寸图标 (72–512px)
 *   - public/splash/  — iOS启动画面 (各设备尺寸)
 *   - public/favicon.ico
 */

const fs = require('fs');
const path = require('path');

// ============================================================
// 配置
// ============================================================

const OUTPUT_DIR = path.resolve(__dirname, '..', 'public');
const ICONS_DIR = path.join(OUTPUT_DIR, 'icons');
const SPLASH_DIR = path.join(OUTPUT_DIR, 'splash');

// PWA图标规格
const ICON_SIZES = [72, 96, 128, 144, 152, 180, 192, 384, 512];

// iOS启动画面规格 (宽 × 高)
const SPLASH_SCREENS = [
  { name: 'iphone_6_7_8',           width: 750,  height: 1334, scale: 2 },
  { name: 'iphone_6_7_8_plus',      width: 1242, height: 2208, scale: 3 },
  { name: 'iphone_x',               width: 1125, height: 2436, scale: 3 },
  { name: 'iphone_xs_max',          width: 1242, height: 2688, scale: 3 },
  { name: 'iphone_12_13_pro',       width: 1170, height: 2532, scale: 3 },
  { name: 'iphone_14_pro_max',      width: 1290, height: 2796, scale: 3 },
  { name: 'ipad_pro_11',            width: 1668, height: 2388, scale: 2 },
  { name: 'ipad_pro_12_9',          width: 2048, height: 2732, scale: 2 },
];

// ============================================================
// 配色 (月夕生活台品牌色)
// ============================================================

const BRAND = {
  bgGradientStart: '#f5e6d3',   // 暖杏色 (秘色系)
  bgGradientEnd:   '#e8d5f0',   // 淡紫
  primary:         '#c9a96e',   // 金色
  primaryDark:     '#b8944f',   // 深金
  accent:          '#8b5cf6',   // 紫
  text:            '#3d3226',   // 深棕
  textLight:       '#8b7355',   // 浅棕
  white:           '#faf8f5',   // 暖白
};

// ============================================================
// SVG 图标生成器
// ============================================================

function generateIconSVG(size) {
  // 基础坐标基于512×512设计，按比例缩放
  const s = size;
  const m = s / 512; // 缩放倍率

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${BRAND.bgGradientStart}"/>
      <stop offset="100%" stop-color="${BRAND.bgGradientEnd}"/>
    </linearGradient>
    <linearGradient id="moon" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${BRAND.primary}"/>
      <stop offset="100%" stop-color="${BRAND.primaryDark}"/>
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="${8 * m}" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <!-- 背景圆角矩形 -->
  <rect x="${4 * m}" y="${4 * m}" width="${504 * m}" height="${504 * m}" rx="${90 * m}" fill="url(#bg)"/>

  <!-- 月亮 -->
  <g filter="url(#glow)" transform="translate(${256 * m}, ${220 * m})">
    <circle cx="0" cy="0" r="${100 * m}" fill="url(#moon)" opacity="0.9"/>
    <!-- 月牙缺口 -->
    <circle cx="${35 * m}" cy="${-25 * m}" r="${75 * m}" fill="url(#bg)"/>
  </g>

  <!-- 星星 -->
  <g fill="${BRAND.accent}" opacity="0.6">
    <circle cx="${160 * m}" cy="${330 * m}" r="${4 * m}"/>
    <circle cx="${350 * m}" cy="${300 * m}" r="${3 * m}"/>
    <circle cx="${130 * m}" cy="${380 * m}" r="${2.5 * m}"/>
    <circle cx="${380 * m}" cy="${370 * m}" r="${2 * m}"/>
    <circle cx="${200 * m}" cy="${400 * m}" r="${2 * m}"/>
    <circle cx="${320 * m}" cy="${420 * m}" r="${1.5 * m}"/>
  </g>

  <!-- 文字：夕 -->
  <text x="${256 * m}" y="${435 * m}" text-anchor="middle"
        font-family="system-ui, -apple-system, sans-serif"
        font-size="${56 * m}" font-weight="300"
        fill="${BRAND.text}" opacity="0.7">夕</text>
</svg>`;
}

function generateSplashSVG(width, height) {
  const cx = width / 2;
  const cy = height / 2;
  const moonR = Math.min(width, height) * 0.12;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${BRAND.bgGradientStart}"/>
      <stop offset="100%" stop-color="${BRAND.bgGradientEnd}"/>
    </linearGradient>
    <linearGradient id="moon" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${BRAND.primary}"/>
      <stop offset="100%" stop-color="${BRAND.primaryDark}"/>
    </linearGradient>
  </defs>

  <!-- 背景 -->
  <rect width="${width}" height="${height}" fill="url(#bg)"/>

  <!-- 月亮 -->
  <g transform="translate(${cx}, ${cy - moonR * 0.3})">
    <circle r="${moonR}" fill="url(#moon)" opacity="0.85"/>
    <circle cx="${moonR * 0.35}" cy="${-moonR * 0.25}" r="${moonR * 0.75}" fill="url(#bg)"/>
  </g>

  <!-- 标题 -->
  <text x="${cx}" y="${cy + moonR * 1.5}" text-anchor="middle"
        font-family="system-ui, -apple-system, sans-serif"
        font-size="${Math.round(Math.min(width, height) * 0.045)}" font-weight="300"
        fill="${BRAND.text}" opacity="0.6">月夕 · 生活台</text>
</svg>`;
}

// ============================================================
// 工具函数
// ============================================================

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function saveSVG(filePath, svgContent) {
  fs.writeFileSync(filePath, svgContent, 'utf-8');
  console.log(`  ✓ ${path.relative(OUTPUT_DIR, filePath)}`);
}

// ============================================================
// 主流程
// ============================================================

async function main() {
  console.log('🎨 月夕生活台 — 图标 & 启动画面生成\n');
  console.log('使用 canvas-free SVG 方案 (无需额外依赖)\n');

  // ---- PWA 图标 ----
  console.log('📱 生成 PWA 图标...');
  ensureDir(ICONS_DIR);

  for (const size of ICON_SIZES) {
    const svg = generateIconSVG(size);
    saveSVG(path.join(ICONS_DIR, `icon-${size}x${size}.svg`), svg);
  }

  // 主图标 (Apple touch icon)
  const mainIcon = generateIconSVG(180);
  saveSVG(path.join(ICONS_DIR, 'apple-touch-icon.svg'), mainIcon);

  // 生成 PNG 占位说明 (SVG 已足够现代浏览器使用)
  const pngNote = `# SVG 图标说明
PWA 现代浏览器直接支持 SVG 图标。如需 PNG 版本，请在项目中使用以下方法之一：

1. 使用 Sharp (推荐):
   node scripts/convert-icons-sharp.js

2. 在线转换:
   将 public/icons/ 下的 SVG 上传到 https://convertio.co/svg-png/

3. 使用 ImageMagick:
   for size in 72 96 128 144 152 180 192 384 512; do
     convert -background none -size \\$\\{size}x$\\{size} public/icons/icon-$\\{size}x$\\{size}.svg public/icons/icon-$\\{size}x$\\{size}.png
   done
`;
  fs.writeFileSync(path.join(ICONS_DIR, 'README.md'), pngNote);
  console.log(`  ✓ ${path.relative(OUTPUT_DIR, path.join(ICONS_DIR, 'README.md'))}`);

  // ---- iOS 启动画面 ----
  console.log('\n📱 生成 iOS 启动画面...');
  ensureDir(SPLASH_DIR);

  for (const screen of SPLASH_SCREENS) {
    const svg = generateSplashSVG(screen.width, screen.height);
    saveSVG(path.join(SPLASH_DIR, `splash-${screen.name}.svg`), svg);
  }

  // ---- Favicon (多尺寸) ----
  console.log('\n🔖 生成 Favicon...');
  const favicon16 = generateIconSVG(16);
  const favicon32 = generateIconSVG(32);
  saveSVG(path.join(OUTPUT_DIR, 'favicon.svg'), favicon32);

  // ---- HTML 标签生成 ----
  console.log('\n📋 生成 PWA 图标 HTML 标签...');

  const iconTags = [
    '<!-- PWA 图标 -->',
    '<link rel="icon" type="image/svg+xml" href="/favicon.svg">',
  ];

  for (const size of [192, 512]) {
    iconTags.push(`<link rel="icon" type="image/svg+xml" sizes="${size}x${size}" href="/icons/icon-${size}x${size}.svg">`);
  }

  iconTags.push('<link rel="apple-touch-icon" href="/icons/apple-touch-icon.svg">');

  // 启动画面标签
  iconTags.push('\n<!-- iOS 启动画面 -->');
  for (const screen of SPLASH_SCREENS) {
    iconTags.push(
      `<link rel="apple-touch-startup-image" href="/splash/splash-${screen.name}.svg">`
    );
  }

  const htmlSnippet = iconTags.join('\n');
  saveSVG(path.join(OUTPUT_DIR, 'pwa-head-tags.html'), htmlSnippet);

  // ---- Manifest 更新参考 ----
  console.log('\n📋 生成 manifest 图标配置参考...');

  const manifestIcons = ICON_SIZES.map(size => ({
    src: `/icons/icon-${size}x${size}.svg`,
    sizes: `${size}x${size}`,
    type: 'image/svg+xml',
    purpose: size >= 192 ? 'any maskable' : 'any',
  }));

  const manifestRef = {
    name: '月夕生活台',
    short_name: '月夕',
    description: '个人生活工作台',
    theme_color: '#f5e6d3',
    background_color: '#faf8f5',
    display: 'standalone',
    orientation: 'portrait-primary',
    icons: manifestIcons,
  };

  saveSVG(
    path.join(OUTPUT_DIR, 'manifest-icons-ref.json'),
    JSON.stringify(manifestRef, null, 2)
  );

  // ---- 完成 ----
  console.log('\n✅ 全部生成完毕！');
  console.log(`\n输出目录: ${OUTPUT_DIR}`);
  console.log('  ├── icons/        — PWA 图标 (SVG)');
  console.log('  ├── splash/       — iOS 启动画面 (SVG)');
  console.log('  ├── favicon.svg   — 网站图标');
  console.log('  ├── pwa-head-tags.html     — 复制到 HTML head');
  console.log('  └── manifest-icons-ref.json — 复制到 manifest.json');
  console.log('\n💡 提示: 将 pwa-head-tags.html 内容复制到 app/+html.tsx 或根 HTML 的 <head> 中');
}

main().catch(err => {
  console.error('❌ 生成失败:', err);
  process.exit(1);
});
