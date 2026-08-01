-- =============================================
-- 迁移 0004: Push 通知 + 板块排序 + 暗色模式
-- =============================================

-- 1. Push 订阅表
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  reminder_time TEXT DEFAULT '20:00',  -- HH:MM 格式
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own push subscriptions"
  ON push_subscriptions FOR ALL
  USING (auth.uid() = user_id);

-- 2. user_settings 扩展字段
-- push_enabled / push_reminder_time
ALTER TABLE user_settings 
  ADD COLUMN IF NOT EXISTS push_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS push_reminder_time TEXT DEFAULT '20:00',
  -- 暗色模式
  ADD COLUMN IF NOT EXISTS dark_mode BOOLEAN DEFAULT false,
  -- 板块排序（JSON 数组，如 ["english","ai_learning","reading",...]）
  ADD COLUMN IF NOT EXISTS module_order JSONB DEFAULT NULL,
  -- 板块显示/隐藏
  ADD COLUMN IF NOT EXISTS module_visibility JSONB DEFAULT NULL;

-- 3. 数据导出记录表
CREATE TABLE IF NOT EXISTS export_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  export_type TEXT NOT NULL CHECK (export_type IN ('csv', 'json', 'full_backup')),
  file_url TEXT,
  exported_at TIMESTAMPTZ DEFAULT now(),
  record_count INTEGER DEFAULT 0
);

ALTER TABLE export_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own exports"
  ON export_records FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Users create own exports"
  ON export_records FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 索引
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_reminder ON push_subscriptions(reminder_time, enabled);
CREATE INDEX IF NOT EXISTS idx_export_records_user ON export_records(user_id, exported_at DESC);
