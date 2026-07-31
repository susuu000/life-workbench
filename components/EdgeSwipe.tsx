/**
 * Web 端边缘滑动手势：左缘右滑返回 / 右缘左滑回首页。
 * iOS 原生 Stack 自带左滑返回，此组件仅 Web 生效。
 */
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';

export default function EdgeSwipe({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;

    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      touchStartX = t.clientX;
      touchStartY = t.clientY;
      touchStartTime = Date.now();
    };

    const onEnd = (e: TouchEvent) => {
      const t = e.changedTouches[0];
      const dx = t.clientX - touchStartX;
      const dy = t.clientY - touchStartY;
      const dt = Date.now() - touchStartTime;
      const winW = window.innerWidth;

      if (Math.abs(dx) > 60 && Math.abs(dy) < 80 && dt < 500) {
        // 从左边缘向右滑 → 返回上一级
        if (touchStartX < 40 && dx > 60) {
          if (router.canGoBack()) {
            router.back();
          }
        }
        // 从右边缘向左滑 → 回首页
        else if (touchStartX > winW - 40 && dx < -60) {
          router.navigate('/');
        }
      }
    };

    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchend', onEnd);
    };
  }, [router]);

  return <>{children}</>;
}
