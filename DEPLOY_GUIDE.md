# 🚀 生活工作台 v2 部署操作手册

> 最后更新：2025-08-01
> 本文档包含从代码提交到全量上线的每一步操作，按顺序执行即可。

---

## 前置信息

| 项目 | 值 |
|------|-----|
| GitHub 仓库 | `https://github.com/susuu000/life-workbench` |
| Supabase 项目 | `https://xyufbgmhjmqdanrblvit.supabase.co` |
| Supabase Project Ref | `xyufbgmhjmqdanrblvit` |
| Netlify 站点 | 已连接 GitHub 自动部署 |
| 和风天气 Host | `devapi.qweather.com`（标准免费 Host） |

---

## 第 1 步：提交代码到 GitHub

在你本地电脑的终端中执行：

```bash
# 1. 进入项目目录
cd ~/你的项目路径/life-workbench

# 2. 拉取最新代码（确保不冲突）
git pull origin main

# 3. 查看所有改动
git status

# 4. 添加所有改动
git add -A

# 5. 提交
git commit -m "v2: 11项功能完善 - 书影豆瓣数据/天气修复/多邻国打卡/AI实操知识/月历打卡/自媒体生成/编辑删除等"

# 6. 推送到 GitHub
git push origin main
```

> ⚠️ 推送后 Netlify 会自动触发构建部署，无需手动操作 Netlify。

---

## 第 2 步：执行 Supabase 数据库迁移

### 2.1 打开 SQL Editor

1. 浏览器打开：https://supabase.com/dashboard/project/xyufbgmhjmqdanrblvit
2. 左侧菜单 → **SQL Editor**
3. 点击 **New query**

### 2.2 粘贴并执行以下 SQL

将下面 **全部内容** 复制粘贴到 SQL Editor 中，然后点击右下角 **Run**（或按 `Ctrl+Enter`）：

```sql
-- ============================================================
-- 生活工作台 v2 数据库迁移
-- ============================================================

-- ① english_word_tasks 新增多邻国打卡字段
ALTER TABLE english_word_tasks
  ADD COLUMN IF NOT EXISTS duolingo_done BOOLEAN DEFAULT FALSE;

-- ② ai_knowledge_items 新增实操教程字段
ALTER TABLE ai_knowledge_items
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS content_type TEXT DEFAULT 'prompt',
  ADD COLUMN IF NOT EXISTS steps JSONB DEFAULT '[]'::jsonb;

-- ③ reading_checkins 补 user_id 字段
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reading_checkins' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE reading_checkins ADD COLUMN user_id UUID REFERENCES auth.users(id);
  END IF;
END $$;

-- ④ reading_checkins 唯一约束（防重复打卡）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reading_checkins_unique'
  ) THEN
    ALTER TABLE reading_checkins ADD CONSTRAINT reading_checkins_unique
      UNIQUE (user_id, entry_id, date);
  END IF;
END $$;

-- ⑤ social_media_recs 补字段
ALTER TABLE social_media_recs
  ADD COLUMN IF NOT EXISTS source_url TEXT,
  ADD COLUMN IF NOT EXISTS traffic_analysis TEXT;

-- ⑥ english_word_tasks 唯一约束（每人每天一条）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'english_word_tasks_unique'
  ) THEN
    ALTER TABLE english_word_tasks ADD CONSTRAINT english_word_tasks_unique
      UNIQUE (user_id, date);
  END IF;
END $$;
```

### 2.3 验证迁移成功

执行以下查询，确认字段已添加：

```sql
-- 检查 english_word_tasks 是否有 duolingo_done 字段
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'english_word_tasks' AND column_name = 'duolingo_done';

-- 检查 ai_knowledge_items 是否有 content_type 字段
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'ai_knowledge_items' AND column_name IN ('title', 'content_type', 'steps');
```

预期：每个查询都返回至少 1 行结果。

---

## 第 3 步：部署 Edge Functions

### 3.1 安装 Supabase CLI（如果还没有）

```bash
# macOS
brew install supabase/tap/supabase

# 或使用 npm
npm install -g supabase
```

### 3.2 登录 Supabase

```bash
supabase login
```

执行后会弹出浏览器 → 选择你的 Supabase 账号 → 授权。终端会显示 `Successfully logged in.`

### 3.3 链接项目

```bash
cd ~/你的项目路径/life-workbench
supabase link --project-ref xyufbgmhjmqdanrblvit
```

执行后会提示输入数据库密码。密码在 Supabase Dashboard → Settings → Database → Database password 中查看。

### 3.4 部署修改过的函数

**逐个部署，确保每个成功后再部署下一个：**

```bash
# 1. 天气函数（修复了 API Host + 重试逻辑）
supabase functions deploy get-weather

# 2. 每日定时任务（新增了 AI 知识库 + 自媒体内容生成）
supabase functions deploy daily-cron

# 3. 豆瓣搜索代理（新增）
supabase functions deploy douban-search
```

每次部署成功后会显示 `Deployed Functions on project xyufbgmhjmqdanrblvit` 以及函数的访问 URL。

---

## 第 4 步：更新环境变量

### 4.1 打开 Secrets 管理页面

浏览器打开：https://supabase.com/dashboard/project/xyufbgmhjmqdanrblvit/settings/functions

或手动导航：Supabase Dashboard → Settings → Edge Functions

### 4.2 修改和风天气 Host

在 Secrets 列表中找到 `QWEATHER_API_HOST`，点击编辑：

| 字段 | 旧值 | 新值 |
|------|------|------|
| QWEATHER_API_HOST | `kh6pga2v33.re.qweatherapi.com` | `devapi.qweather.com` |

点击 **Save**。

### 4.3 确认其他必需的 Secrets

以下 Secrets 必须存在，如果缺失请添加：

| Secret 名称 | 说明 | 是否必需 |
|-------------|------|----------|
| `QWEATHER_API_KEY` | 和风天气 API Key | ✅ 必需 |
| `QWEATHER_API_HOST` | `devapi.qweather.com` | ✅ 必需 |
| `OPENROUTER_API_KEY` | OpenRouter API Key（AI 内容生成） | ✅ 必需 |
| `TMDB_API_KEY` 或 `TMDB_API_READ_TOKEN` | TMDB 电影数据 | 推荐 |
| `SUPABASE_URL` | 项目 URL | 通常自动设置 |
| `SUPABASE_ANON_KEY` | 匿名访问密钥 | 通常自动设置 |

---

## 第 5 步：验证部署

### 5.1 验证 Edge Functions 部署成功

在浏览器中访问（替换为实际的 Function URL）：

```
https://xyufbgmhjmqdanrblvit.supabase.co/functions/v1/get-weather?city=宁波
```

预期返回 JSON：`{"ok":true,"cached":true,"data":{...}}` 或 `{"ok":true,"cached":false,"data":{...}}`

### 5.2 手动触发一次内容刷新

```
https://xyufbgmhjmqdanrblvit.supabase.co/functions/v1/daily-cron
```

在浏览器直接访问会返回 `{"ok":true,"result":{...}}`（因为是 GET 请求，可能需要用 POST）。你可以在 Supabase Dashboard → Edge Functions → daily-cron → Invoke 中点击 **Invoke** 按钮手动触发。

### 5.3 验证 Netlify 自动部署

1. 浏览器打开 Netlify 项目页面
2. 查看 Deploys 列表 → 应该有一个新的部署正在进行
3. 部署完成后点击 Preview 链接，确认：
   - 首页时钟正常显示（无「点击显示秒」文字）
   - 天气能正常加载
   - 发现页的「刷新内容」按钮存在
   - 英语模块有多邻国打卡入口
   - AI 知识库有「实操教程」分类
   - 播客/书影有删除按钮

---

## 常见问题

### Q1: `supabase link` 提示数据库密码错误
在 Supabase Dashboard → Settings → Database → 点击 **Reset database password** 重置密码，然后用新密码重试。

### Q2: Edge Function 部署失败
检查函数日志：Dashboard → Edge Functions → 点击对应函数 → Logs 标签。常见原因：
- Secrets 缺失（如 `QWEATHER_API_KEY`）
- 函数代码有语法错误

### Q3: Netlify 构建失败
检查 Netlify 环境变量是否设置了 `EXPO_PUBLIC_SUPABASE_URL` 和 `EXPO_PUBLIC_SUPABASE_ANON_KEY`。
在 Netlify → Site settings → Environment variables 中添加。

### Q4: 豆瓣搜索返回空
豆瓣网页抓取可能因 IP 限制失败，这不影响添加功能，会自动降级为手动填写。如果持续失败，可在 Supabase Dashboard 中查看 `douban-search` 函数的日志。

---

## 部署检查清单

| 步骤 | 操作 | 完成？ |
|------|------|--------|
| 1 | `git push origin main` 推送代码 | ☐ |
| 2 | Supabase SQL Editor 执行迁移 SQL | ☐ |
| 3 | `supabase login` 登录 | ☐ |
| 4 | `supabase link --project-ref xyufbgmhjmqdanrblvit` | ☐ |
| 5 | `supabase functions deploy get-weather` | ☐ |
| 6 | `supabase functions deploy daily-cron` | ☐ |
| 7 | `supabase functions deploy douban-search` | ☐ |
| 8 | 修改 Secret `QWEATHER_API_HOST` → `devapi.qweather.com` | ☐ |
| 9 | Netlify 自动部署完成 | ☐ |
| 10 | 浏览器验证所有功能正常 | ☐ |
