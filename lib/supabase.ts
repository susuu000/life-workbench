import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    '⚠️ Supabase URL / Anon Key 未配置。请在 .env 中设置 EXPO_PUBLIC_SUPABASE_URL 和 EXPO_PUBLIC_SUPABASE_ANON_KEY'
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

/** 获取当前登录用户 ID（未登录返回 null） */
export async function getCurrentUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/** 云端连接状态检测：简单 ping */
export async function checkCloudConnection(): Promise<'connected' | 'disconnected' | 'error'> {
  try {
    const { error } = await supabase.from('profiles').select('id').limit(1);
    if (error) return 'disconnected';
    return 'connected';
  } catch {
    return 'error';
  }
}
