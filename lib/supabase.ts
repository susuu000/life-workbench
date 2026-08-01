/**
 * Supabase 客户端初始化 & 辅助工具
 *
 * 支持 Web (Expo) + Native 双端。
 * 环境变量通过 EXPO_PUBLIC_ 前缀暴露给客户端。
 */

import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ===== 配置 =====
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// ===== 客户端实例 =====
// 使用 AsyncStorage 作为持久化存储（Web 端自动降级为 localStorage）
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: Platform.OS === 'web' ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});

// ===== 辅助函数 =====

/** 获取当前登录用户 ID */
export async function getCurrentUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

/** 检查是否已连接 Supabase */
export function checkCloudConnection(): boolean {
  return !!(SUPABASE_URL && SUPABASE_ANON_KEY);
}

/** 匿名登录（用于免注册体验） */
export async function signInAnonymously(): Promise<string | null> {
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) {
    console.error('匿名登录失败:', error.message);
    return null;
  }
  return data.user?.id ?? null;
}
