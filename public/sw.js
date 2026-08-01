/**
 * Service Worker - 离线缓存 + PWA 增强
 * 
 * 策略：
 * - 静态资源（JS/CSS/字体）：Cache First（构建时预缓存）
 * - API 请求：Network First（优先网络，失败时回退缓存）
 * - 图片：Stale While Revalidate（显示缓存，后台更新）
 */

const CACHE_VERSION = 'yuexi-v3-001';
const STATIC_CACHE = `yuexi-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `yuexi-dynamic-${CACHE_VERSION}`;
const IMAGE_CACHE = `yuexi-images-${CACHE_VERSION}`;

// 预缓存的静态资源（构建时自动填充）
const PRECACHE_URLS: string[] = [
  '/',
  '/index.html',
];

// ===== 安装：预缓存静态资源 =====
self.addEventListener('install', (event: any) => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW] Precaching static assets');
      return cache.addAll(PRECACHE_URLS);
    }).then(() => {
      return (self as any).skipWaiting();
    })
  );
});

// ===== 激活：清理旧缓存 =====
self.addEventListener('activate', (event: any) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== DYNAMIC_CACHE && key !== IMAGE_CACHE)
          .map((key) => caches.delete(key))
      );
    }).then(() => {
      return (self as any).clients.claim();
    })
  );
});

// ===== 请求拦截 =====
self.addEventListener('fetch', (event: any) => {
  const { request } = event;
  const url = new URL(request.url);

  // 跳过非 GET 请求
  if (request.method !== 'GET') return;

  // 跳过 Supabase API 请求（需要实时数据）
  if (url.hostname.includes('supabase.co')) return;

  // 跳过 Chrome DevTools 请求
  if (url.pathname.startsWith('/__')) return;

  // 图片：Stale While Revalidate
  if (
    request.destination === 'image' ||
    /\.(png|jpg|jpeg|gif|svg|webp|ico)$/i.test(url.pathname)
  ) {
    event.respondWith(staleWhileRevalidate(request, IMAGE_CACHE));
    return;
  }

  // 静态资源（JS/CSS/字体）：Cache First
  if (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'font' ||
    /\.(js|css|woff2?|ttf|eot)$/i.test(url.pathname)
  ) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // 导航请求（HTML）：Network First
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, DYNAMIC_CACHE));
    return;
  }

  // 默认：Network First
  event.respondWith(networkFirst(request, DYNAMIC_CACHE));
});

// ===== 缓存策略 =====

/** Cache First：先查缓存，缓存没有才走网络 */
async function cacheFirst(request: Request, cacheName: string): Promise<Response> {
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
    // 离线且无缓存，返回空响应
    return new Response('', { status: 408 });
  }
}

/** Network First：先走网络，失败时回退缓存 */
async function networkFirst(request: Request, cacheName: string): Promise<Response> {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    // 完全离线时返回离线页面
    if (request.mode === 'navigate') {
      const offlinePage = await caches.match('/');
      if (offlinePage) return offlinePage;
    }
    return new Response('Network error', { status: 408 });
  }
}

/** Stale While Revalidate：返回缓存，后台更新 */
async function staleWhileRevalidate(request: Request, cacheName: string): Promise<Response> {
  const cached = await caches.match(request);

  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      const cache = caches.open(cacheName);
      cache.then((c) => c.put(request, response.clone()));
    }
    return response;
  }).catch(() => null);

  return cached || fetchPromise.then((r) => r || new Response('', { status: 408 }));
}

// ===== 推送通知（可选）=====
self.addEventListener('push', (event: any) => {
  const data = event.data?.json() || {};
  const title = data.title || '月夕生活台';
  const options: NotificationOptions = {
    body: data.body || '别忘了今天的打卡哦 🌙',
    icon: '/assets/icon-192.png',
    badge: '/assets/icon-72.png',
    tag: 'daily-reminder',
    renotify: true,
    vibrate: [200, 100, 200],
  };

  event.waitUntil(
    (self as any).registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event: any) => {
  event.notification.close();
  event.waitUntil(
    (self as any).clients.matchAll({ type: 'window' }).then((clients: any[]) => {
      if (clients.length > 0) {
        clients[0].focus();
      } else {
        (self as any).clients.openWindow('/');
      }
    })
  );
});

export {};
