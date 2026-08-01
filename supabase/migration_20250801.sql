-- ============================================================
-- 生活工作台 v2 数据库迁移（2025-08-01）
-- 在 Supabase Dashboard → SQL Editor 中粘贴执行
-- ============================================================

-- 1. english_word_tasks 新增多邻国打卡字段
ALTER TABLE english_word_tasks
  ADD COLUMN IF NOT EXISTS duolingo_done BOOLEAN DEFAULT FALSE;

-- 2. ai_knowledge_items 新增实操教程相关字段
ALTER TABLE ai_knowledge_items
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS content_type TEXT DEFAULT 'prompt',
  ADD COLUMN IF NOT EXISTS steps JSONB DEFAULT '[]'::jsonb;

-- 3. reading_checkins 新增 user_id 字段（之前可能漏了）
-- 先检查是否存在
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reading_checkins' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE reading_checkins ADD COLUMN user_id UUID REFERENCES auth.users(id);
  END IF;
END $$;

-- 4. reading_checkins 唯一约束（每人每天每个条目只能打卡一次）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reading_checkins_unique'
  ) THEN
    ALTER TABLE reading_checkins ADD CONSTRAINT reading_checkins_unique
      UNIQUE (user_id, entry_id, date);
  END IF;
END $$;

-- 5. social_media_recs 确保 source_url 字段存在
ALTER TABLE social_media_recs
  ADD COLUMN IF NOT EXISTS source_url TEXT,
  ADD COLUMN IF NOT EXISTS traffic_analysis TEXT;

-- 6. english_word_tasks 唯一约束（每人每天一条记录）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'english_word_tasks_unique'
  ) THEN
    ALTER TABLE english_word_tasks ADD CONSTRAINT english_word_tasks_unique
      UNIQUE (user_id, date);
  END IF;
END $$;
