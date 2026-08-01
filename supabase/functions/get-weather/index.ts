import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders, json } from '../_shared/cors.ts';
import { getSupabase } from '../_shared/supabase.ts';
import { refreshWeather } from '../_shared/weather.ts';

// 客户端调用：GET /get-weather?city=宁波
// 优先返回缓存（30 分钟内），否则实时拉取和风天气
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const city = url.searchParams.get('city') || '宁波';
    const sb = getSupabase();

    // 先看缓存（30 分钟内）
    const { data: cached } = await sb
      .from('weather_cache')
      .select('*')
      .eq('city', city)
      .maybeSingle();
    const fresh =
      cached && Date.now() - new Date(cached.updated_at).getTime() < 30 * 60 * 1000;
    if (fresh) return json({ ok: true, cached: true, data: cached });

    const data = await refreshWeather(sb, city);
    return json({ ok: true, cached: false, data });
  } catch (e) {
    const msg = (e as Error).message;
    console.error('[get-weather] 错误:', msg);
    // 区分错误类型返回合适的状态码
    if (msg.includes('未设置')) return json({ ok: false, error: msg }, 400);
    if (msg.includes('未找到城市')) return json({ ok: false, error: msg }, 400);
    if (msg.includes('HTTP 4')) return json({ ok: false, error: msg }, 502);
    return json({ ok: false, error: msg }, 500);
  }
});
