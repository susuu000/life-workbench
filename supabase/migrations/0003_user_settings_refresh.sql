-- ============================================================
-- 生活工作台 · 迁移 0003
-- 内容: 为 user_settings 增加「上次自动刷新时间」与「自动刷新开关」，
--       用于客户端在 App 打开时判断是否触发每日内容刷新（daily-cron）。
-- 说明: 不依赖 pg_cron（该扩展在部分 Supabase 项目不可通过 SQL 启用），
--       真正的无人值守刷新可改用 Supabase Dashboard 启用 pg_cron 后执行
--       supabase/cron_setup.sql。
-- ============================================================

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS last_refresh_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS daily_refresh_enabled BOOLEAN NOT NULL DEFAULT true;
