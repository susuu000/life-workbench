-- ============================================================
-- 生活工作台 · 迁移 0005
-- 内容:
--   1) user_settings 增加个性化与每日目标数字字段
--      (theme_color / font_family / density / module_targets)
--   2) 为 12 张共享内容/缓存表启用行级安全(RLS)，
--      并允许匿名(anon)与登录(authenticated)用户 SELECT，
--      保持发现页等内容公开可读，消除 Supabase 安全警告。
-- 说明: Edge Function 使用 service_role 写入，自动绕过 RLS，不受影响。
-- ============================================================

-- ---------- 1) user_settings 个性化字段 ----------

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS font_family TEXT NOT NULL DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS density TEXT NOT NULL DEFAULT 'comfortable',
  ADD COLUMN IF NOT EXISTS module_targets JSONB NOT NULL DEFAULT
    '{"english":4,"ai_learning":2,"reading":0,"podcast":5,"social_media":2,"self_explore":3}'::jsonb,
  ADD COLUMN IF NOT EXISTS custom_sections JSONB NOT NULL DEFAULT '[]'::jsonb;

-- ---------- 2) 12 张公开内容表启用 RLS + 公开只读 ----------

-- 需要启用 RLS 的共享内容表
DO $$
DECLARE
  t text;
  tbls text[] := ARRAY[
    'news_cache',
    'ai_frontier_cache',
    'ai_insights',
    'ai_knowledge_items',
    'book_movie_new',
    'stock_sector_info',
    'podcast_items',
    'listening_articles',
    'social_media_recs',
    'sanlian_articles',
    'wechat_picks',
    'weather_cache'
  ];
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    -- 启用 RLS
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);

    -- 公开只读策略（匿名 + 登录用户均可 SELECT）
    EXECUTE format(
      'DROP POLICY IF EXISTS "Public read %I" ON %I;', t, t
    );
    EXECUTE format(
      'CREATE POLICY "Public read %I" ON %I FOR SELECT USING (true);', t, t
    );
  END LOOP;
END $$;
