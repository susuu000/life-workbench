-- =============================================
-- 迁移 0005: 第三阶段 - 便签 + 名言 + 同步队列
-- =============================================

-- 1. 便签表
CREATE TABLE IF NOT EXISTS sticky_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT DEFAULT '',
  color TEXT DEFAULT '#FFF9C4',
  position_x INTEGER DEFAULT 0,
  position_y INTEGER DEFAULT 0,
  archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE sticky_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own sticky notes"
  ON sticky_notes FOR ALL
  USING (auth.uid() = user_id);

-- 2. 每日名言表（公共，管理员可添加）
CREATE TABLE IF NOT EXISTS daily_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text TEXT NOT NULL,
  author TEXT NOT NULL,
  source TEXT,
  category TEXT DEFAULT 'general',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE daily_quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read quotes"
  ON daily_quotes FOR SELECT
  USING (true);

-- 3. 名言收藏表
CREATE TABLE IF NOT EXISTS favorite_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quote_text TEXT NOT NULL,
  author TEXT NOT NULL,
  source TEXT,
  collected_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, quote_text)
);

ALTER TABLE favorite_quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own quote favorites"
  ON favorite_quotes FOR ALL
  USING (auth.uid() = user_id);

-- 4. book_movie_entries 增加类型相关字段（如果不存在）
ALTER TABLE book_movie_entries
  ADD COLUMN IF NOT EXISTS director TEXT,
  ADD COLUMN IF NOT EXISTS isbn TEXT,
  ADD COLUMN IF NOT EXISTS rating INTEGER;

-- 5. 同步操作日志表
CREATE TABLE IF NOT EXISTS sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  table_name TEXT NOT NULL,
  action TEXT NOT NULL,
  record_id TEXT,
  synced_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE sync_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own sync log"
  ON sync_log FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Users create own sync log"
  ON sync_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 索引
CREATE INDEX IF NOT EXISTS idx_sticky_notes_user ON sticky_notes(user_id, archived);
CREATE INDEX IF NOT EXISTS idx_favorite_quotes_user ON favorite_quotes(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_log_user ON sync_log(user_id, synced_at DESC);

-- 6. 种子名言数据
INSERT INTO daily_quotes (text, author, source, category) VALUES
  ('凡事先从自己身上找原因，你的人生将豁然开朗。', '佚名', NULL, 'inspiration'),
  ('你所浪费的今天，是昨天死去的人奢望的明天。', '哈佛校训', NULL, 'motivation'),
  ('生活不止眼前的苟且，还有诗和远方。', '高晓松', NULL, 'life'),
  ('不要因为走得太远，而忘记为什么出发。', '纪伯伦', NULL, 'reflection'),
  ('人生最大的遗憾，莫过于轻易地放弃了不该放弃的。', '柏拉图', NULL, 'wisdom')
ON CONFLICT DO NOTHING;
