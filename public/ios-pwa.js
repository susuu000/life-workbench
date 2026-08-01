/**
 * iOS PWA 体验增强脚本
 * 
 * 在 index.html 中引入此脚本，实现：
 * 1. 检测 standalone 模式，调整 safe-area
 * 2. 状态栏颜色适配
 * 3. 禁止橡皮筋效果（bounce）
 * 4. 触摸反馈增强
 */

(function () {
  'use strict';

  // ===== 检测 standalone 模式 =====
  const isStandalone = () =>
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true;

  // ===== 应用 standalone 样式 =====
  if (isStandalone()) {
    document.documentElement.classList.add('standalone-mode');
    // 确保状态栏适配
    document.documentElement.style.setProperty(
      '--safe-area-inset-top',
      'env(safe-area-inset-top, 20px)'
    );
  }

  // ===== 禁止 iOS 橡皮筋效果 =====
  document.addEventListener(
    'touchmove',
    function (e) {
      // 允许在可滚动元素内滚动
      const target = e.target as HTMLElement;
      let el = target;
      while (el && el !== document.body) {
        const style = window.getComputedStyle(el);
        const overflowY = style.overflowY;
        if (
          overflowY === 'scroll' ||
          overflowY === 'auto' ||
          el.classList.contains('scrollable')
        ) {
          return; // 允许滚动
        }
        el = el.parentElement!;
      }
      // 阻止 body 滚动（橡皮筋）
      e.preventDefault();
    },
    { passive: false }
  );

  // ===== 双击缩放禁用 =====
  let lastTouchEnd = 0;
  document.addEventListener(
    'touchend',
    function (e) {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        e.preventDefault();
      }
      lastTouchEnd = now;
    },
    { passive: false }
  );

  // ===== 状态栏颜色适配 =====
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) {
    // 监听页面可见性变化
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        themeMeta.setAttribute('content', '#1A5060'); // 深色
      } else {
        themeMeta.setAttribute('content', '#2E6F7E'); // 主色
      }
    });
  }

  console.log('[PWA] iOS optimization loaded, standalone:', isStandalone());
})();
