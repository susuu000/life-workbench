/**
 * useSWR - Stale-While-Revalidate 数据缓存 Hook
 * 
 * 策略：
 * 1. 首次渲染：显示缓存数据（如有），同时后台刷新
 * 2. 后续访问：先返回缓存，后台验证更新
 * 3. 缓存过期（默认 5 分钟）：自动重新获取
 * 
 * 同时提供 LazyImage 组件实现图片懒加载。
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Image, View, StyleSheet, Platform, Animated } from 'react-native';

// ===== useSWR Hook =====

interface SWROptions {
  cacheKey: string;
  fetcher: () => Promise<any>;
  ttl?: number;           // 缓存过期时间（毫秒），默认 5 分钟
  revalidateOnMount?: boolean;
}

interface SWRState<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
  stale: boolean;         // 是否正在使用过期数据
}

// 内存缓存
const memoryCache = new Map<string, { data: any; timestamp: number }>();

export function useSWR<T = any>({
  cacheKey,
  fetcher,
  ttl = 5 * 60 * 1000,
  revalidateOnMount = true,
}: SWROptions): SWRState<T> & { revalidate: () => Promise<void> } {
  const [data, setData] = useState<T | null>(() => {
    const cached = memoryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < ttl) {
      return cached.data;
    }
    return null;
  });
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(!data);
  const [stale, setStale] = useState(false);
  const fetchingRef = useRef(false);

  const doFetch = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    try {
      const result = await fetcher();
      setData(result);
      setError(null);
      memoryCache.set(cacheKey, { data: result, timestamp: Date.now() });
      setStale(false);
    } catch (err) {
      setError(err as Error);
      // 如果有缓存数据，标记为过期但继续使用
      if (data) setStale(true);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [cacheKey, fetcher, ttl]);

  useEffect(() => {
    const cached = memoryCache.get(cacheKey);
    const isStale = !cached || Date.now() - cached.timestamp >= ttl;

    if (isStale && revalidateOnMount) {
      doFetch();
    } else if (cached && !data) {
      setData(cached.data);
      setLoading(false);
    }
  }, [cacheKey]);

  // 定时检查过期
  useEffect(() => {
    const interval = setInterval(() => {
      const cached = memoryCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp >= ttl) {
        setStale(true);
        doFetch();
      }
    }, Math.min(ttl, 60000)); // 每分钟检查一次
    return () => clearInterval(interval);
  }, [cacheKey, ttl]);

  return { data, error, loading, stale, revalidate: doFetch };
}

/** 手动更新缓存 */
export function mutateCache(key: string, data: any) {
  memoryCache.set(key, { data, timestamp: Date.now() });
}

/** 清除缓存 */
export function clearCache(key?: string) {
  if (key) {
    memoryCache.delete(key);
  } else {
    memoryCache.clear();
  }
}

// ===== LazyImage 图片懒加载组件 =====

interface LazyImageProps {
  uri: string;
  width?: number;
  height?: number;
  resizeMode?: 'cover' | 'contain' | 'stretch';
  placeholderColor?: string;
  borderRadius?: number;
  style?: any;
}

export function LazyImage({
  uri, width, height, resizeMode = 'cover',
  placeholderColor = '#E8E3D8', borderRadius = 8, style,
}: LazyImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [inView, setInView] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const viewRef = useRef<View>(null);

  // Intersection Observer（仅 Web）
  useEffect(() => {
    if (Platform.OS === 'web' && viewRef.current) {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setInView(true);
            observer.disconnect();
          }
        },
        { rootMargin: '100px' } // 提前 100px 开始加载
      );
      // Web 端用 data-id 查找
      const el = document.querySelector(`[data-lazy-img="${uri}"]`);
      if (el) observer.observe(el);
      return () => observer.disconnect();
    } else {
      // Native 端直接加载
      setInView(true);
    }
  }, [uri]);

  const handleLoad = () => {
    setLoaded(true);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  return (
    <View
      ref={viewRef}
      style={[
        {
          width: width || '100%',
          height: height || 200,
          backgroundColor: placeholderColor,
          borderRadius,
          overflow: 'hidden',
        },
        style,
      ]}
      {...(Platform.OS === 'web' ? { 'data-lazy-img': uri } : {})}
    >
      {inView && (
        <Animated.View style={{ ...StyleSheet.absoluteFillObject, opacity: fadeAnim }}>
          <Image
            source={{ uri }}
            style={{ width: '100%', height: '100%', borderRadius }}
            resizeMode={resizeMode}
            onLoad={handleLoad}
          />
        </Animated.View>
      )}
      {!loaded && (
        <View style={[StyleSheet.absoluteFillObject, styles.placeholder]}>
          <View style={styles.placeholderShimmer} />
        </View>
      )}
    </View>
  );
}

// ===== 代码分割工具 =====

/**
 * 懒加载组件包装器
 * 用法：const LazyComponent = lazyLoad(() => import('./HeavyComponent'));
 */
export function lazyLoad<T extends React.ComponentType<any>>(
  importFn: () => Promise<{ default: T }>
): React.LazyExoticComponent<T> {
  return React.lazy(importFn);
}

/**
 * 带 Suspense 的懒加载包装
 */
export function withSuspense<P>(
  Component: React.LazyExoticComponent<React.ComponentType<P>>,
  Fallback: React.ComponentType = () => null
) {
  return function SuspenseWrapper(props: P) {
    return (
      <React.Suspense fallback={<Fallback />}>
        <Component {...(props as any)} />
      </React.Suspense>
    );
  };
}

const styles = StyleSheet.create({
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderShimmer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#E8E3D8',
  },
});
