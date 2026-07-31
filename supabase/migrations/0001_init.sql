-- ============================================================
-- 生活工作台 · Supabase 数据库初始化迁移
-- 版本: 0001_init
-- 说明: 覆盖六大核心板块 + 发现 + 我的 + 自我探索 + 收藏 + 设置 + 缓存
-- 行级安全(RLS): 所有用户数据仅本人可见
-- ============================================================

-- ===== 0. 启用 UUID 扩展 =====
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ===== 1. 用户与认证 =====

CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '生活工作台用户',
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_profiles_user_id ON profiles(user_id);


-- ===== 2. 打卡记录 =====

CREATE TABLE IF NOT EXISTS checkin_records (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date         DATE NOT NULL,                    -- YYYY-MM-DD
  streak_days  INTEGER NOT NULL DEFAULT 1,       -- 连续天数（计算值）
  total_days   INTEGER NOT NULL DEFAULT 1,       -- 累计天数
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT unique_checkin_per_day UNIQUE (user_id, date)
);

ALTER TABLE checkin_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own checkins" ON checkin_records FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own checkins" ON checkin_records FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_checkin_user_date ON checkin_records(user_id, date DESC);


-- ===== 3. 核心板块任务（通用）=====

CREATE TYPE module_key AS ENUM (
  'english', 'ai_learning', 'reading',
  'podcast', 'social_media', 'self_explore'
);

CREATE TABLE IF NOT EXISTS tasks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module        module_key NOT NULL,
  title         TEXT NOT NULL,
  sub_module    TEXT,                              -- 子模块名，如"单词学习"/"每日外刊听力"
  done          BOOLEAN NOT NULL DEFAULT false,
  completed_at  TIMESTAMPTZ,
  review_note   TEXT,                              -- 复盘输入行
  order_index   INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own tasks" ON tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own tasks" ON tasks FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_tasks_user_module ON tasks(user_id, module, done, order_index);


-- ===== 4. 英语板块 =====

CREATE TABLE IF NOT EXISTS english_word_tasks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  daily_target  INTEGER NOT NULL DEFAULT 15,       -- 默认每日 15 个
  source_link   TEXT,                              -- 墨墨背单词跳转链接
  date          DATE NOT NULL DEFAULT CURRENT_DATE,
  completed     INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE english_word_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own english_words" ON english_word_tasks FOR ALL USING (auth.uid() = user_id);


CREATE TABLE IF NOT EXISTS listening_articles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  audio_url     TEXT NOT NULL,
  transcript    TEXT,
  translation   TEXT,
  date          DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 外刊为公共内容（所有登录用户可见），无需 RLS 按用户隔离


-- ===== 5. AI 学习板块 =====

CREATE TABLE IF NOT EXISTS ai_insights (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type            TEXT NOT NULL CHECK (type IN ('news','parse','video')),
  content         TEXT NOT NULL,
  highlights      TEXT NOT NULL,
  shortcomings    TEXT NOT NULL,
  value_summary   TEXT NOT NULL,
  source_url      TEXT,
  published_at    DATE NOT NULL DEFAULT CURRENT_DATE,
  reading_feeling TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- AI 前沿资讯为公共内容


CREATE TABLE IF NOT EXISTS ai_knowledge_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category        TEXT NOT NULL CHECK (category IN ('ai_office','ai_comic','ai_build')),
  prompt_formula  TEXT NOT NULL,
  four_elements   TEXT NOT NULL,
  summary         TEXT NOT NULL,
  core_tip        TEXT NOT NULL,
  collected_by    UUID[] DEFAULT '{}',             -- 收藏此条的用户 ID 列表

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 知识库为公共内容；collected_by 追踪个人收藏状态


-- ===== 6. 阅读板块 =====

CREATE TABLE IF NOT EXISTS book_movie_entries (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type              TEXT NOT NULL CHECK (type IN ('book','movie')),
  title             TEXT NOT NULL,
  author            TEXT,
  translator        TEXT,
  publisher         TEXT,
  description       TEXT NOT NULL DEFAULT '',
  cover_url         TEXT NOT NULL DEFAULT '',
  characters        TEXT,                          -- 人物角色梳理线
  total_pages       INTEGER,
  total_episodes    INTEGER,
  current_page      INTEGER DEFAULT 0,
  current_episode   INTEGER DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'reading'
                     CHECK (status IN ('reading','planned','completed')),
  duration_ms       BIGINT,                        -- 总耗时(ms)
  completed_at      TIMESTAMPTZ,
  recommendation_url TEXT,                          -- B站解说跳转
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE book_movie_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own books_movies" ON book_movie_entries FOR ALL USING (auth.uid() = user_id);
CREATE INDEX idx_bookmovie_user_status ON book_movie_entries(user_id, type, status);


CREATE TABLE IF NOT EXISTS reading_checkins (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id    UUID NOT NULL REFERENCES book_movie_entries(id) ON DELETE CASCADE,
  entry_type  TEXT NOT NULL CHECK (entry_type IN ('book','movie')),
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE reading_checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own reading_checkins" ON reading_checkins FOR ALL USING (
  EXISTS (SELECT 1 FROM book_movie_entries bme WHERE bme.id = entry_id AND bme.user_id = auth.uid())
);


-- 公众号精选 & 三联中读（公共内容）

CREATE TABLE IF NOT EXISTS wechat_picks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account     TEXT NOT NULL,                       -- 单读 / KnowYourself / heytea
  title       TEXT NOT NULL,
  summary     TEXT,
  url         TEXT NOT NULL,
  week_of     DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);


CREATE TABLE IF NOT EXISTS sanlian_articles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  summary     TEXT,
  url         TEXT NOT NULL,
  week_of     DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ===== 7. 播客板块 =====

CREATE TABLE IF NOT EXISTS podcast_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,                   -- 播客名称
  episode_title   TEXT NOT NULL,
  summary         TEXT NOT NULL,
  play_url        TEXT NOT NULL,
  source          TEXT NOT NULL CHECK (source IN ('xiaoyuzhou_hot','my_follows')),
  week_of         DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 小宇宙热榜为公共内容；my_follows 需按用户筛选（后续可加 user_id 字段或关联表）


-- ===== 8. 自媒体板块 =====

CREATE TABLE IF NOT EXISTS social_media_recs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type              TEXT NOT NULL CHECK (type IN ('today_rec','inspiration','aesthetic')),
  title             TEXT NOT NULL,
  content           TEXT NOT NULL,
  traffic_analysis  TEXT,
  image_url         TEXT,
  source_url        TEXT,
  platform          TEXT NOT NULL DEFAULT 'other' CHECK (platform IN ('xiaohongshu','douyin','other')),
  published_at      DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ===== 9. 自我探索板块 =====

CREATE TABLE IF NOT EXISTS mood_records (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  emotion     TEXT NOT NULL,                      -- emoji 或文字描述
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT unique_mood_per_day UNIQUE (user_id, date)
);

ALTER TABLE mood_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own moods" ON mood_records FOR ALL USING (auth.uid() = user_id);


CREATE TABLE IF NOT EXISTS appearance_records (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  type        TEXT NOT NULL CHECK (type IN ('ootd','hairstyle','weight')),
  image_url   TEXT NOT NULL,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE appearance_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own appearances" ON appearance_records FOR ALL USING (auth.uid() = user_id);


CREATE TABLE IF NOT EXISTS clothes_records (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_url  TEXT NOT NULL,                       -- 淘宝/小红书链接
  style       TEXT NOT NULL,
  price       DECIMAL(10,2),
  category    TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE clothes_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own clothes" ON clothes_records FOR ALL USING (auth.uid() = user_id);


CREATE TABLE IF NOT EXISTS daily_records (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date          DATE NOT NULL DEFAULT CURRENT_DATE,
  type          TEXT NOT NULL CHECK (type IN ('outdoor','cooking','cleaning','custom')),
  custom_label  TEXT,
  photo_url     TEXT,
  done          BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE daily_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own daily_records" ON daily_records FOR ALL USING (auth.uid() = user_id);


CREATE TABLE IF NOT EXISTS new_skills (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  skill_name    TEXT NOT NULL,
  learned_at    DATE NOT NULL DEFAULT CURRENT_DATE,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE new_skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own_skills" ON new_skills FOR ALL USING (auth.uid() = user_id);


CREATE TABLE IF NOT EXISTS period_records (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_date       DATE NOT NULL,
  end_date         DATE NOT NULL,
  predicted_next   DATE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE period_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own_periods" ON period_records FOR ALL USING (auth.uid() = user_id);


CREATE TABLE IF NOT EXISTS finance_records (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount        DECIMAL(12,2) NOT NULL,
  category      TEXT NOT NULL,
  note          TEXT NOT NULL DEFAULT '',
  is_large      BOOLEAN NOT NULL DEFAULT false,
  recorded_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE finance_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage_own_finance" ON finance_records FOR ALL USING (auth.uid() = user_id);


CREATE TABLE IF NOT EXISTS journal_entries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  images      TEXT[] NOT NULL DEFAULT '{}',       -- 云存储 URL 数组
  text        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage_own_journals" ON journal_entries FOR ALL USING (auth.uid() = user_id);


-- ===== 10. 发现 · 资讯缓存（公共/系统写入）=====

CREATE TABLE IF NOT EXISTS news_cache (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source        TEXT NOT NULL CHECK (source IN ('xinhua','renmin','other')),
  title         TEXT NOT NULL,
  url           TEXT NOT NULL,
  summary       TEXT,
  published_at  DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_news_date ON news_cache(published_at DESC);


CREATE TABLE IF NOT EXISTS ai_frontier_cache (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  summary       TEXT NOT NULL,
  source        TEXT NOT NULL,
  url           TEXT,
  published_at  DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_frontier_date ON ai_frontier_cache(published_at DESC);


CREATE TABLE IF NOT EXISTS stock_sector_info (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sector      TEXT NOT NULL,
  change_pct  DECIMAL(6,3) NOT NULL,
  data_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stocks_date ON stock_sector_info(data_date DESC);


CREATE TABLE IF NOT EXISTS book_movie_new (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type          TEXT NOT NULL CHECK (type IN ('book','movie')),
  title         TEXT NOT NULL,
  author        TEXT NOT NULL,
  source        TEXT NOT NULL CHECK (source IN ('douban','letterboxd')),
  url           TEXT,
  published_at  DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bmnew_date ON book_movie_new(published_at DESC);


-- ===== 11. 收藏（统一归集）=====

CREATE TABLE IF NOT EXISTS collections (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category      TEXT NOT NULL,                      -- 板块分类
  ref_table     TEXT NOT NULL,                       -- 来源表名
  ref_id        UUID NOT NULL,                       -- 来源记录 ID
  collected_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT unique_collection UNIQUE (user_id, ref_table, ref_id)
);

ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage_own_collections" ON collections FOR ALL USING (auth.uid() = user_id);
CREATE INDEX idx_collections_user_cat ON collections(user_id, category);


-- ===== 12. 用户设置 =====

CREATE TABLE IF NOT EXISTS user_settings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  theme_color     TEXT NOT NULL DEFAULT '#2E6F7E',
  font_size       INTEGER NOT NULL DEFAULT 16,
  module_order    TEXT[] NOT NULL DEFAULT ARRAY[
    'english','ai_learning','reading','podcast','social_media','self_explore'
  ]::text[],
  app_icon_url    TEXT,
  app_name        TEXT NOT NULL DEFAULT '生活工作台',
  weather_city    TEXT,
  weather_enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage_own_settings" ON user_settings FOR ALL USING (auth.uid() = user_id);


-- ===== 13. 天气缓存 =====

CREATE TABLE IF NOT EXISTS weather_cache (
  city        TEXT PRIMARY KEY,
  temp        INTEGER NOT NULL,
  condition   TEXT NOT NULL,
  icon_code   TEXT,
  forecast    JSONB NOT NULL DEFAULT '[]',        -- DailyForecast[]
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ===== 14. 辅助函数：自动更新打卡连续天数 =====

CREATE OR REPLACE FUNCTION update_checkin_streak()
RETURNS TRIGGER AS $$
DECLARE
  prev_date DATE;
BEGIN
  -- 计算连续天数
  SELECT MAX(date) INTO prev_date
  FROM checkin_records
  WHERE user_id = NEW.user_id AND date < NEW.date;

  IF prev_date IS NOT NULL AND prev_date = NEW.date - INTERVAL '1 day' THEN
    NEW.streak_days := COALESCE(
      (SELECT streak_days FROM checkin_records
       WHERE user_id = NEW.user_id AND date = prev_date), 0) + 1;
  ELSE
    NEW.streak_days := 1;
  END IF;

  -- 计算累计天数
  NEW.total_days := COALESCE(
    (SELECT COUNT(*) FROM checkin_records WHERE user_id = NEW.user_id), 0);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_checkin_streak
  BEFORE INSERT ON checkin_records
  FOR EACH ROW EXECUTE FUNCTION update_checkin_streak();


-- ===== 15. 辅助函数：任务完成时自动触发打卡 =====

CREATE OR REPLACE FUNCTION auto_checkin_on_task_complete()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.done = true AND (OLD.done IS NULL OR OLD.done = false) THEN
    INSERT INTO checkin_records (user_id, date)
    VALUES (NEW.user_id, CURRENT_DATE)
    ON CONFLICT (user_id, date) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auto_checkin
  AFTER UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION auto_checkin_on_task_complete();


-- ============================================================
-- 完成: 共 25 张表 + RLS + 触发器 + 索引
-- 下一步: 在 Supabase 控制台 SQL Editor 中执行本文件，
--        或通过 CLI: supabase db push
-- ============================================================
