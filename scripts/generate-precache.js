#!/usr/bin/env node
/**
 * 预缓存清单生成器
 * 
 * 在 pnpm build:web 之后运行，扫描 dist/ 目录，
 * 生成所有需要预缓存的静态资源 URL 列表，
 * 注入到 sw.js 的 PRECACHE_URLS 数组中。
 * 
 * 用法：
 *   node scripts/generate-precache.js
 *   或在 package.json 中： "postbuild:web": "node scripts/generate-precache.js"
 */

const fs = require('fs');
const path = require('path');

const DIST_DIR = path.resolve(__dirname, '../dist');
const SW_FILE = path.resolve(__dirname, '../dist/sw.js');
const SW_SRC = path.resolve(__dirname, '../public/sw.js');

// 需要预缓存的文件扩展名
const PRECACHE_EXTENSIONS = [
  '.html', '.js', '.css', '.json',
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico',
  '.woff', '.woff2', '.ttf', '.eot',
];

// 排除模式
const EXCLUDE_PATTERNS = [
  /^\/_expo\//,     // Expo 内部资源（按需加载）
  /\.map$/,          // Source maps
  /sw\.js$/,         // SW 自身
  /workbox-/,        // Workbox 文件
];

function walkDir(dir, basePath = '/') {
  const files = [];
  
  if (!fs.existsSync(dir)) {
    console.warn(`[precache] Directory not found: ${dir}`);
    return files;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = basePath + entry.name;
    
    if (entry.isDirectory()) {
      // 跳过隐藏目录
      if (entry.name.startsWith('.')) continue;
      files.push(...walkDir(fullPath, relativePath + '/'));
    } else if (entry.isFile()) {
      // 检查扩展名
      const ext = path.extname(entry.name).toLowerCase();
      if (!PRECACHE_EXTENSIONS.includes(ext)) continue;
      
      // 检查排除模式
      if (EXCLUDE_PATTERNS.some((pattern) => pattern.test(relativePath))) continue;
      
      files.push(relativePath);
    }
  }
  
  return files;
}

function generateSw(precacheUrls) {
  if (!fs.existsSync(SW_SRC)) {
    console.error('[precache] Source SW file not found:', SW_SRC);
    console.log('[precache] Creating minimal SW with precache list...');
    
    // 如果没有源 SW 文件，从 dist/sw.js 读取并注入
    if (fs.existsSync(SW_FILE)) {
      let content = fs.readFileSync(SW_FILE, 'utf-8');
      const urlsJson = JSON.stringify(precacheUrls, null, 2);
      content = content.replace(
        /const PRECACHE_URLS[^;]*;/,
        `const PRECACHE_URLS = ${urlsJson};`
      );
      fs.writeFileSync(SW_FILE, content);
      console.log(`[precache] Updated ${SW_FILE} with ${precacheUrls.length} URLs`);
      return;
    }
    
    // 创建新的 SW
    const swContent = generateFullSw(precacheUrls);
    fs.writeFileSync(SW_FILE, swContent);
    console.log(`[precache] Created ${SW_FILE} with ${precacheUrls.length} URLs`);
    return;
  }
  
  // 读取源 SW 模板
  let swContent = fs.readFileSync(SW_SRC, 'utf-8');
  const urlsJson = JSON.stringify(precacheUrls, null, 2);
  
  // 替换 PRECACHE_URLS
  swContent = swContent.replace(
    /const PRECACHE_URLS[^;]*;/,
    `const PRECACHE_URLS = ${urlsJson};`
  );
  
  // 确保 dist 目录存在
  const distDir = path.dirname(SW_FILE);
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }
  
  fs.writeFileSync(SW_FILE, swContent);
  console.log(`[precache] Generated ${SW_FILE} with ${precacheUrls.length} URLs`);
}

function generateFullSw(precacheUrls) {
  const urlsJson = JSON.stringify(precacheUrls, null, 2);
  return `/**
 * Service Worker - 离线缓存 + PWA 增强（自动生成）
 * 生成时间: ${new Date().toISOString()}
 */

const CACHE_VERSION = 'yuexi-v3-${Date.now().toString(36)}';
const STATIC_CACHE = 'yuexi-static-' + CACHE_VERSION;
const DYNAMIC_CACHE = 'yuexi-dynamic-' + CACHE_VERSION;
const IMAGE_CACHE = 'yuexi-images-' + CACHE_VERSION;

const PRECACHE_URLS = ${urlsJson};

// ===== 安装 =====
self.addEventListener('install', (event) => {
  console.log('[SW] Installing, caching ' + PRECACHE_URLS.length + ' files...');
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      // 逐个缓存，单个失败不影响整体
      return Promise.allSettled(
        PRECACHE_URLS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('[SW] Failed to cache:', url, err.message);
          })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// ===== 激活 =====
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) =>
            key !== STATIC_CACHE &&
            key !== DYNAMIC_CACHE &&
            key !== IMAGE_CACHE
          )
          .map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// ===== 请求拦截 =====
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // 跳过 API 请求
  if (url.hostname.includes('supabase.co')) return;
  if (url.pathname.startsWith('/functions/')) return;

  // 图片: Stale While Revalidate
  if (/\.(png|jpg|jpeg|gif|svg|webp|ico)$/i.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, IMAGE_CACHE));
    return;
  }

  // 静态资源: Cache First
  if (/\.(js|css|woff2?|ttf|json)$/i.test(url.pathname)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // 导航: Network First
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, DYNAMIC_CACHE));
    return;
  }

  // 默认: Network First
  event.respondWith(networkFirst(request, DYNAMIC_CACHE));
});

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 408 });
  }
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response('Offline', { status: 408 });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cached = await caches.match(request);
  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      caches.open(cacheName).then((c) => c.put(request, response.clone()));
    }
    return response;
  }).catch(() => cached);
  return cached || fetchPromise;
}
`;
}

// ===== 主流程 =====
console.log('[precache] Scanning dist/ directory...');
const precacheUrls = walkDir(DIST_DIR);
console.log(`[precache] Found ${precacheUrls.length} files to precache`);

// 确保首页在列表中
if (!precacheUrls.includes('/')) {
  precacheUrls.unshift('/');
}
if (!precacheUrls.includes('/index.html')) {
  precacheUrls.unshift('/index.html');
}

generateSw(precacheUrls);

// 同时生成 .nojekyll（GitHub Pages 需要）
const nojekyllPath = path.join(DIST_DIR, '.nojekyll');
if (!fs.existsSync(nojekyllPath)) {
  fs.writeFileSync(nojekyllPath, '');
  console.log('[precache] Created .nojekyll');
}

console.log('[precache] Done!');
