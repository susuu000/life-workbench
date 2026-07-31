// 使用 Service Role Key 的后台客户端（绕过 RLS，仅限 Edge Function 内部使用）
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export function getSupabase(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) {
    throw new Error('缺少 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY 环境变量');
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
