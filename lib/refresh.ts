import { supabase, getCurrentUserId, SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase';

const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 小时

/**
 * 客户端「每日自动刷新」触发器（即发即忘，不阻塞 UI）。
 *
 * 触发条件（满足全部才触发）：
 *   1. 用户已登录
 *   2. user_settings.daily_refresh_enabled 为真（默认开）
 *   3. 距上次刷新超过 24h，或从未刷新
 *
 * 触发后调用 daily-cron Edge Function（负责刷新资讯 / AI 前沿 / 听播客 / 书影音 / 股票 / 全城市天气）。
 * 仅当调用成功时才更新 last_refresh_at，确保失败会在下次打开 App 时重试。
 *
 * 说明：本机制不依赖 pg_cron（部分 Supabase 项目无法用 SQL 启用该扩展），
 * 因此刷新发生在「用户打开 App 且超过 24h 未刷新」时。若需要真正的无人值守刷新，
 * 可在 Supabase Dashboard 启用 pg_cron 后执行 supabase/cron_setup.sql。
 */
export async function ensureDailyRefresh(): Promise<void> {
  try {
    const uid = await getCurrentUserId();
    if (!uid) return;

    const { data: settings } = await supabase
      .from('user_settings')
      .select('last_refresh_at, daily_refresh_enabled')
      .eq('user_id', uid)
      .maybeSingle();

    if (settings && settings.daily_refresh_enabled === false) return;

    const last = settings?.last_refresh_at ? new Date(settings.last_refresh_at).getTime() : 0;
    const now = Date.now();
    if (last && now - last < REFRESH_INTERVAL_MS) return; // 24h 内已刷新，跳过

    fetch(`${SUPABASE_URL}/functions/v1/daily-cron`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ triggered_by: 'client_launch' }),
    })
      .then(async (res) => {
        if (!res.ok) {
          console.warn('[ensureDailyRefresh] daily-cron 返回', res.status);
          return;
        }
        // 成功才更新时间戳，失败则留待下次打开重试
        await supabase
          .from('user_settings')
          .update({ last_refresh_at: new Date().toISOString() })
          .eq('user_id', uid);
      })
      .catch((e) => {
        console.warn('[ensureDailyRefresh] daily-cron 调用失败（下次打开重试）', e);
      });
  } catch (e) {
    console.warn('[ensureDailyRefresh] 异常', e);
  }
}
