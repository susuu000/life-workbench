-- ============================================================
-- 每日定时任务：北京时间 0:00（= UTC 16:00）触发 daily-cron
-- 用法：在 Supabase 控制台 SQL Editor 粘贴执行；或 `supabase sql --file supabase/cron_daily.sql`
-- 注意：把 YOUR_ANON_KEY 替换为项目的 anon key 或 publishable key（Settings → API）
-- 依赖：pg_cron + pg_net 扩展。本项目经测试「无法通过 SQL 创建 pg_cron」（控制文件缺失），
--   若 Dashboard → Database → Extensions 启用 pg_cron 仍失败，请改用客户端刷新 / GitHub Actions（见 README 第 6 节）。
-- ============================================================

-- 若已存在同名计划则先删除，避免重复
select cron.unschedule('susu-daily-refresh');

select cron.schedule(
  'susu-daily-refresh',
  '0 16 * * *',
  $$
  select net.http_post(
    url := 'https://xyufbgmhjmqdanrblvit.supabase.co/functions/v1/daily-cron',
    headers := jsonb_build_object(
      'Authorization', 'Bearer YOUR_ANON_KEY',
      'Content-Type', 'application/json'
    )
  )
  $$
);
