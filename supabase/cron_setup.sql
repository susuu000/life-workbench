-- ============================================================
-- 生活工作台 · 可选的「无人值守」每日刷新（pg_cron）
-- ============================================================
-- 前提：你的 Supabase 项目需支持 pg_cron 扩展。
--   1) 打开 Supabase Dashboard → Database → Extensions
--   2) 搜索并启用 "pg_cron"（以及 "pg_net"）
--   3) 在本 SQL Editor 中执行以下语句
-- 注意：本项目数据库经测试「无法通过 SQL 创建 pg_cron」（扩展控制文件缺失），
--   若 Dashboard 启用也失败，请改用客户端刷新机制（App 打开时自动触发，
--   见 lib/refresh.ts，无需 pg_cron）。
-- ============================================================

create extension if not exists cron;
create extension if not exists pg_net;

select cron.unschedule('susu-daily-refresh');

select cron.schedule(
  'susu-daily-refresh',
  '0 16 * * *',            -- 北京时间 0:00（UTC 16:00）
  $$
  select net.http_post(
    url := 'https://xyufbgmhjmqdanrblvit.supabase.co/functions/v1/daily-cron',
    headers := jsonb_build_object(
      'Authorization', 'Bearer sb_publishable_rA1Q9XIZJsa6Lxr5fX8ZVw_oKznvatB',
      'Content-Type', 'application/json'
    )
  )
  $$
);

-- 校验
-- select * from cron.job;
