import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders, json } from '../_shared/cors.ts';
import { getSupabase } from '../_shared/supabase.ts';
import {
  refreshNews,
  refreshAiFrontier,
  refreshAiInsights,
  refreshListening,
  refreshBookMovie,
  refreshStocks,
} from '../_shared/jobs.ts';
import { refreshWeather } from '../_shared/weather.ts';

// 每日 0:00 定时触发的编排器：依次执行所有抓取任务
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const sb = getSupabase();
  const result: Record<string, number> = {};
  const run = async (name: string, fn: () => Promise<number>) => {
    try {
      result[name] = await fn();
    } catch (e) {
      result[name] = -1;
      console.error(`[daily-cron] ${name} 失败:`, (e as Error).message);
    }
  };

  await run('news', () => refreshNews(sb));
  await run('ai_frontier', () => refreshAiFrontier(sb));
  await run('ai_insights', () => refreshAiInsights(sb));
  await run('listening', () => refreshListening(sb));
  await run('bookmovie', () => refreshBookMovie(sb));
  await run('stocks', () => refreshStocks(sb));

  // 天气：默认宁波 + 各用户设置中的城市
  try {
    const cities = new Set<string>(['宁波']);
    const { data: settings } = await sb.from('user_settings').select('weather_city');
    (settings ?? []).forEach((s: any) => {
      if (s.weather_city) cities.add(s.weather_city);
    });
    for (const c of cities) {
      try {
        await refreshWeather(sb, c);
        result[`weather_${c}`] = 1;
      } catch (e) {
        result[`weather_${c}`] = -1;
        console.error(`[daily-cron] 天气 ${c} 失败:`, (e as Error).message);
      }
    }
  } catch (e) {
    console.error('[daily-cron] 天气刷新异常:', (e as Error).message);
  }

  console.log('[daily-cron] 完成:', JSON.stringify(result));
  return json({ ok: true, result });
});
