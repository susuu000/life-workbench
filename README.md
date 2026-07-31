# 🌙 生活工作台

> 个人生活工作台 · Expo 单代码库（iOS 原生 App + 网页 PWA）· Supabase 云端底座

## 技术栈

| 层 | 技术 |
|---|---|
| 前端框架 | Expo SDK 52 (React Native) |
| 路由 | expo-router (文件路由) |
| 云端数据库 | Supabase (Postgres) |
| 云存储 | Supabase Storage |
| 定时任务 / 后端代理 | Supabase Edge Functions |
| AI 内容生成 | DeepSeek API |
| 天气数据 | 和风天气 API |
| iOS 构建 | EAS Cloud Build（无需本地 Mac） |
| 网页部署 | GitHub Pages (PWA) |

## 快速开始

> ⚠️ **开发环境要求**
> - **Node**：推荐使用 **Node 20 LTS**（Expo 52 官方支持版本）。
> - 安装器：`npm install` 或 `pnpm install`（项目已配置 `node-linker=hoisted` 以兼容 pnpm）。
> - 本骨架已在源码层面通过 **TypeScript 类型检查** 与 **app.json 配置校验**。在沙箱环境中因 Expo 52 工具链对源码版依赖的运行时转译限制，CLI（`expo start` / `expo export`）无法在此环境直接执行；在你本机标准环境下可正常启动。

### 0. 配置 Node 版本

- 本地开发 / 运行 App：`nvm install 20 && nvm use 20`（expo 52 官方支持的 LTS）
- **网页构建 `pnpm build:web` 必须用 Node 22**：静态渲染阶段 supabase realtime 依赖全局 `WebSocket`，Node 20 无此全局对象会报错。`nvm install 22 && nvm use 22 && pnpm build:web`

### 1. 环境准备

```bash
# 克隆项目
git clone <your-repo-url>
cd life-workbench

# 安装依赖
pnpm install

# 复制环境变量模板（Expo 读取 .env.local）
cp .env.example .env.local
```

### 2. 配置环境变量

编辑 `.env.local`，填入你的 Supabase 密钥（App 端需要）：

```bash
# ===== Supabase（必填，App 与网页端使用）=====
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
```

> 说明：`DEEPSEEK_API_KEY` 与 `QWEATHER_API_KEY` **不需要**写在 `.env.local`（App 不会直连这两家服务，避免密钥泄露）。它们只由 Supabase Edge Functions 在后台使用，请按下方「部署 Edge Functions」配置为 **Supabase 密钥（Secrets）**。

获取方式：
- **Supabase**：[supabase.com](https://supabase.com) → 新建项目 → Settings → API（项目已创建，ref: `xyufbgmhjmqdanrblvit`）
- **AI 生成（可平替，免费优先）**：DeepSeek 需充值，可改用**免费**方案，代码已支持自动识别，设任一家密钥即可：
  - **Google Gemini**（推荐，中文好、免费档够日用）：[aistudio.google.com/apikey](https://aistudio.google.com/apikey) → 创建密钥 → 设为 `GEMINI_API_KEY`
  - **Groq**（Llama 免费、极快）：[console.groq.com](https://console.groq.com) → [API Keys](https://console.groq.com/keys) → 设为 `GROQ_API_KEY`
  - **OpenRouter**（多免费模型，本项目当前即用此项）：[openrouter.ai/keys](https://openrouter.ai/keys) → 设为 `OPENROUTER_API_KEY`。默认免费模型 `google/gemma-4-26b-a4b-it:free`（已验证可生成中文解读/中译），可用 `OPENROUTER_MODEL` 覆盖。
  - DeepSeek（如需继续用）：[platform.deepseek.com](https://platform.deepseek.com) → 设为 `DEEPSEEK_API_KEY`
  - 优先级（未指定 `AI_PROVIDER` 时）：`GEMINI > GROQ > OPENROUTER > DEEPSEEK`
- **和风天气**：[dev.qweather.com](https://dev.qweather.com)

### 3. 初始化 Supabase 数据库

在 Supabase 控制台的 **SQL Editor** 中依次执行迁移（或按第 4 步用 CLI 推送）：

```
-- ① 粘贴 supabase/migrations/0001_init.sql 全部内容并运行（25 张表 + RLS + 触发器）
-- ② 粘贴 supabase/migrations/0002_seed_and_storage.sql 全部内容并运行（journal 存储桶 + 公共表种子数据）
-- ③ 粘贴 supabase/migrations/0003_user_settings_refresh.sql（user_settings 增加 last_refresh_at / daily_refresh_enabled 列，支撑客户端每日刷新）
```

> 本项目已在 Supabase 项目 `xyufbgmhjmqdanrblvit` 中执行过 `0001` / `0002` / `0003`，三者均已通过 `supabase db push` 落地。

或使用 CLI：

```bash
# 安装 Supabase CLI
npm i -g supabase

# 链接项目
supabase link --project-ref xyufbgmhjmqdanrblvit

# 推送全部迁移（含 0001 / 0002 / 0003）
supabase db push
```

### 4. 本地启动

```bash
# Web 模式（开发）
pnpm start --web

# iOS 模拟器（需 Mac）
pnpm start --ios
```

---

### 5. 部署 Edge Functions（自动抓取 + AI 生成）

后台自动抓取（RSS → 数据库）与 DeepSeek 内容生成全部由 `supabase/functions/` 下的 Edge Functions 完成。首次需登录 Supabase CLI 并部署：

> 💡 **一键脚本**：`scripts/deploy-functions.sh` 已内置已验证的密钥值，运行后只需输入 Service Role Key 即可自动设置 Secrets + 部署全部 8 个函数 + （可选）推送迁移 + 打印每日定时 SQL：
> ```bash
> chmod +x scripts/deploy-functions.sh && ./scripts/deploy-functions.sh
> ```

```bash
# 登录（浏览器授权）
supabase login

# 设置 Supabase 密钥（Edge Function 后台写入数据库需要 Service Role Key）
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<你的 service_role key>
# 设置第三方密钥：天气（已验证可用的值）
supabase secrets set QWEATHER_API_KEY=<QWEATHER_API_KEY>
supabase secrets set QWEATHER_API_HOST=kh6pga2v33.re.qweatherapi.com
# 设置 AI 供应商密钥（任选其一，免费优先；不设则 AI 解读/中译自动跳过）
#   Gemini（推荐）：
supabase secrets set GEMINI_API_KEY=<你的 Gemini API Key>
#   或 Groq / OpenRouter / DeepSeek：
# supabase secrets set GROQ_API_KEY=<...>
# 本项目已设（当前生效，免费方案）：
supabase secrets set OPENROUTER_API_KEY=<OPENROUTER_API_KEY>
# supabase secrets set DEEPSEEK_API_KEY=<...>（如无余额则不会选用）

# 逐个部署函数
supabase functions deploy refresh-news
supabase functions deploy refresh-ai-frontier
supabase functions deploy refresh-ai-insights
supabase functions deploy refresh-listening
supabase functions deploy refresh-bookmovie
supabase functions deploy refresh-stocks
supabase functions deploy get-weather
supabase functions deploy daily-cron
```

函数说明：

| 函数 | 作用 | 写入表 |
|------|------|--------|
| `refresh-news` | 新华网/人民网 RSS → 新闻 | `news_cache` |
| `refresh-ai-frontier` | 机器之心/36氪/量子位 RSS → AI 前沿 | `ai_frontier_cache` |
| `refresh-ai-insights` | AI RSS + AI 供应商结构化解读（当前 OpenRouter） | `ai_insights` |
| `refresh-listening` | 外刊 RSS + AI 供应商中译（当前 OpenRouter） | `listening_articles` |
| `refresh-bookmovie` | TMDB 电影（正在热映/即将上映，需 `TMDB_API_KEY`） | `book_movie_new` |
| `refresh-stocks` | 新浪财经行业板块（GBK 解析，无需密钥） | `stock_sector_info` |
| `get-weather` | 和风天气代理（按城市，30 分钟缓存） | `weather_cache` |
| `daily-cron` | 编排器：每日 0:00 依次执行上述全部 | — |

> RSS 源定义在 `supabase/functions/_shared/sources.ts`，可按可用性替换/增删。部分中文源可能为 GBK 编码，若抓取出现乱码需增加转码步骤。

### 6. 配置每日自动刷新（本地时间 0:00 前后）

> ⚠️ 本项目当前套餐**未启用 pg_cron**（执行 `create extension cron` 报控制文件不存在），因此不能用数据库内定时。刷新采用「双层机制」，开箱即用、无需任何额外配置：

**① 客户端启动刷新（默认开启，零配置）**
- App 每次打开首页时，`lib/refresh.ts` 的 `ensureDailyRefresh()` 会检查 `user_settings.last_refresh_at`：若距上次刷新超过 24h（或从未刷新），自动调用 `daily-cron` Edge Function 刷新全部内容。
- 可在「设置 → 天气 → 每日自动刷新内容」开关关闭。
- 底层数据由迁移 `0003_user_settings_refresh.sql` 提供的 `last_refresh_at` / `daily_refresh_enabled` 两列支撑。

**② GitHub Actions 定时工作流（可选，真正无人值守）**
- 已内置 `.github/workflows/daily-refresh.yml`：UTC 16:00（= 北京时间 0:00）自动调用 `daily-cron`，也支持手动触发。
- 启用步骤：
  1. 将本仓库推送到 GitHub
  2. 仓库 **Settings → Secrets → Actions** 新增密钥：
     - `SUPABASE_ANON_KEY` = 本项目 publishable key（`sb_publishable_rA1Q9XIZJsa6Lxr5fX8ZVw_oKznvatB`，注意不是另一个项目 `susuu000's Project` 的 key）
  3. 在 **Actions → Daily Refresh** 中启用 workflow；首次可点 **Run workflow** 手动验证

> 随时也可手动触发：`curl -X POST https://xyufbgmhjmqdanrblvit.supabase.co/functions/v1/daily-cron -H "Authorization: Bearer <本项目 publishable 或 anon key>"`

> 若你的 Supabase 项目后续支持 pg_cron，可在 Dashboard 启用后执行 `supabase/cron_setup.sql` 改用纯数据库定时（可选）。

---

## 部署指南

### A. 网页端部署到 GitHub Pages（手机端「桌面版本」即走此路，**无需 Apple 开发者账号**）

> 你的使用场景（iOS 桌面版 + 网页端、云端同步、长期可用）**完全由 Web PWA 满足**：把 Expo 网页包部署到任意静态托管，iPhone 上用 Safari 打开 → 分享 →「添加到主屏幕」，即以独立全屏窗口运行，数据经 Supabase 云端同步。全程不需要 Apple 开发者账号。Apple 账号（$99/年）只在「上架 App Store 的原生 iOS App」时才需要（见 B）。

**方式一：GitHub Actions 一键部署（推荐）**
1. 初始化并推送到 GitHub：`git init && git add -A && git commit -m init && git remote add origin <你的仓库> && git push -u origin main`
2. 仓库 `Settings → Secrets → Actions` 新增：
   - `EXPO_PUBLIC_SUPABASE_URL=https://xyufbgmhjmqdanrblvit.supabase.co`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY=`（见 `.env.local` 的 `EXPO_PUBLIC_SUPABASE_ANON_KEY`）
3. `Settings → Pages → Build and deployment → Source: GitHub Actions`
4. push 到 `main` 或手动 Run `Deploy Web PWA` 工作流，即自动构建并发布。

> 若用「项目页」(`<user>.github.io/<repo>`) 部署，请在 `app.json` 的 `web.basePath` 设为 `/<repo>/`；用「用户页」(`<user>.github.io`) / 自定义域名 / Netlify / Cloudflare Pages 则无需处理 basePath。

**方式二：本地构建后手动上传**
```bash
pnpm build:web          # 导出静态文件到 dist/（需 Node 22）
# 将 dist/ 上传到任意静态托管（GitHub Pages / Netlify / Cloudflare Pages / Vercel）
```

PWA 已配置：
- `display: standalone` — iOS「添加到主屏幕」后以独立窗口运行
- `theme_color: #2E6F7E` — 秘色主题色
- Service Worker（离线缓存）— 待接入

**构建注意事项**（已在本仓库处理，记录备查）：
- 构建需 **Node 22**（`expo export` 静态渲染阶段 supabase realtime 依赖全局 `WebSocket`，Node 20 无此全局对象会报错）。
- `app.json` 的 `plugins` 已移除多余的 `expo-web-browser`（该包无 config plugin，旧配置会导致 TS 插件加载报错）。
- 依赖已补充 `react-native-web`、`@opentelemetry/api`（supabase-js 的可选依赖，Metro 需可解析）。

### B. iOS App 通过 EAS 云构建（仅当你要上架 App Store 时才需要）

```bash
# 安装 EAS CLI
npm i -g eas-cli

# 登录 Apple 账号
eas login

# 初始化 EAS 配置（已预置 eas.json）
eas build:configure

# 云构建 iOS 包（无需 Mac！）
eas build --platform ios --profile production

# 提交到 App Store Connect（审核后上架）
eas submit --platform ios
```

**前提条件**：
- Apple Developer Program 账号（$99/年）
- 在 eas.json 中填入你的 Apple ID / Team ID / App Store Connect App ID

---

## 项目结构

```
life-workbench/
├── app/                        # expo-router 页面路由
│   ├── _layout.tsx             # 根布局（登录守卫 + 云端状态条）
│   ├── settings.tsx            # ⚙️ 设置页（名称/天气城市/天气开关/外观）
│   ├── (auth)/                 # 登录 / 注册
│   └── (tabs)/                 # 底部 Tab 页面组
│       ├── _layout.tsx         # Tab 导航配置
│       ├── index.tsx           # 🏠 首页（时间/打卡/六大板块/天气）
│       ├── discover.tsx        # 🔍 发现（时事/AI/股市/书影）
│       ├── mine.tsx            # 👤 我的（收藏/数据/AI专区/设置入口）
│       └── module/[key].tsx    # 板块详情动态路由
├── components/                 # 六大板块详情组件
│   ├── EnglishDetail.tsx  AIDetail.tsx  ReadingDetail.tsx
│   ├── PodcastDetail.tsx SocialMediaDetail.tsx SelfExploreDetail.tsx
├── lib/
│   ├── theme.ts                # 主题配色（秘色/金/滇红/土）
│   ├── types.ts                # TypeScript 类型定义
│   └── supabase.ts             # Supabase 客户端 + 连接检测
├── assets/                     # 图标/启动图
├── supabase/
│   ├── migrations/             # 数据库迁移 SQL
│   │   ├── 0001_init.sql              # 25 张表 + RLS + 触发器
│   │   └── 0002_seed_and_storage.sql  # journal 存储桶 + 公共表种子数据
│   └── functions/              # Edge Functions（Deno）
│       ├── _shared/            # 共享：CORS / Supabase 客户端 / RSS 解析 / DeepSeek / 天气
│       ├── refresh-news/  refresh-ai-frontier/  refresh-ai-insights/
│       ├── refresh-listening/  refresh-bookmovie/  refresh-stocks/
│       ├── get-weather/        # 和风天气代理（客户端调用）
│       └── daily-cron/         # 每日 0:00 编排器
├── scripts/
│   └── gen_assets.py           # 图标生成脚本
├── package.json
├── app.json                    # Expo 配置（iOS/Web/PWA）
├── eas.json                    # EAS 云构建配置
├── tsconfig.json
├── .env.example                # 环境变量模板
└── README.md                   # 本文件
```

---

## 核心功能模块

### 首页
- ⏰ **时间卡片**：实时时分显示，Times New Roman 白色大字
- ✅ **打卡卡片**：连续天数、累计天数、今日状态；完成任意板块子任务自动触发
- 📦 **六大核心板块**：英语 / AI学习 / 阅读 / 播客 / 自媒体 / 自我探索
- 🌤️ **天气组件**：按 `user_settings.weather_city`（默认宁波）调用 `get-weather` Edge Function，30 分钟缓存，失败降级占位

### 发现
- 📰 时事新闻（每日 15 条，新华网/人民网）
- 🤖 AI 前沿（每日 8 条，机器之心/36氪/量子位）
- 📈 股市信息（行业板块行情）
- 📚 书影上新（豆瓣/Letterboxd）

### 我的
- 📌 收藏归集（按板块分类）
- 📊 行为数据分析（打卡/学习统计 + 优化建议）
- 🤖 AI 学习专区（知识库收藏）

### 六大核心板块详情
| 板块 | 子模块 | 特性 |
|------|--------|------|
| 英语 | 单词学习(墨墨跳转)、每日外刊听力(原文+音频+翻译) | 完成项划线沉底 |
| AI 学习 | 前沿资讯(2条/日)、思路/技巧知识库(办公/漫剧/搭建) | 已掌握标记 |
| 阅读 | 书影(进度管理/月历打卡/完成动画+B站推荐)、公众号精选、三联中读 | 输入名自动填充 |
| 播客 | 小宇宙热榜(5篇/周)、我的关注(5条/周) | 手动刷新 |
| 自媒体 | 今日推荐(人像摄影)、灵感选题(10个)、审美搭建(6条/周) | 流量逻辑分析 |
| 自我探索 | 今日状态(情绪/外貌/衣物)、日常记录、新技能、生理期、财务、手账 | 月历情绪视图 |

---

## 数据安全与同步

| 能力 | 实现 |
|------|------|
| 本地持久化 | IndexedDB（Web）/ AsyncStorage（Native） |
| 云端双写 | 每次 CRUD 操作同时写入 Supabase Postgres |
| 离线缓存 | 操作存入本地队列，联网后自动同步至云端 |
| 图片存储 | 上传至 Supabase Storage，本地仅保留缩略图 |
| 行级权限(RLS) | 所有用户表仅本人可读写 |
| 数据备份 | 支持 JSON 导出 / Supabase 控制台导出 |
| 状态标识 | 全局底部「云端连接/断开」状态条 |

---

## 待接入 / 待你确认清单

已在代码中实现或已默认配置的项：

- [x] **RSS 可抓源** — 已定义在 `supabase/functions/_shared/sources.ts`（新华网/人民网/机器之心/36氪/量子位/BBC/NPR/VOA/Letterboxd）
- [x] **默认天气城市** — 宁波（可在「设置」中修改，存于 `user_settings.weather_city`）
- [x] **Letterboxd 书影源** — 使用热门影片 RSS（无需用户名）；豆瓣无开放 RSS，书籍上新暂为空，可后续手动补
- [x] **六大板块子任务/结构** — 已在各 `components/*Detail.tsx` 中定义
- [x] **公共表种子数据** — `0002` 迁移已写入公众号/三联/播客/自媒体/AI 知识库示例
- [x] **迁移 0003（客户端每日刷新）** — `0003_user_settings_refresh.sql` 已推送：为 `user_settings` 增加 `last_refresh_at` / `daily_refresh_enabled` 列；App 打开时若超过 24h 未刷新自动调用 `daily-cron`（见 `lib/refresh.ts`，无需 pg_cron）

仍需你提供 / 后续处理：

- [x] **AI 生成供应商（免费可平替）** — 代码已支持 Gemini / Groq / OpenRouter / DeepSeek 自动识别（`_shared/ai.ts`），设任一家密钥即可；未设时 AI 解读/中译自动跳过，不影响其他板块。推荐免费 Gemini（[aistudio.google.com/apikey](https://aistudio.google.com/apikey)）
- [x] **和风天气密钥** — 已配置并实测通过：`QWEATHER_API_KEY=<QWEATHER_API_KEY>`、`QWEATHER_API_HOST=kh6pga2v33.re.qweatherapi.com`（该 key 的 geo 城市查询被安全设置限制 403，代码改用城市经纬度直查天气）
- [x] **部署 Edge Functions + 每日刷新** — 8 个函数已部署、4 个 Secrets 已设置（已用项目自己的 service_role 密钥）；每日刷新采用「客户端启动刷新（开箱即用）+ GitHub Actions 工作流（可选无人值守）」双层机制（pg_cron 在本套餐不可用）
- [x] **AI 供应商已支持免费方案** — 不充 DeepSeek 也能用：设 `GEMINI_API_KEY`(推荐) / `GROQ_API_KEY` / `OPENROUTER_API_KEY` 任一即可，见上方密钥说明
- [x] **OpenRouter 已接入并实测通过** — `OPENROUTER_API_KEY` 已设为 Supabase Secret，当前 AI 解读/中译即由 OpenRouter 免费模型 `google/gemma-4-26b-a4b-it:free` 生成（已验证中文输出质量良好）；`ai_insights` 已生成 8 条、`listening_articles` 已生成含中译的条目
- [x] **书影上新自动抓取（TMDB）** — Letterboxd RSS 被 Cloudflare 403 已弃用，改接 **TMDB API**（电影，含海报/评分）。设 `TMDB_API_KEY`（v3，[themoviedb.org/settings/api](https://www.themoviedb.org/settings/api) 免费申请）或 `TMDB_API_READ_TOKEN`（v4）为 Supabase Secret 即可自动拉取；迁移 `0004` 已放开 `source` 约束并新增 `poster_url`/`rating` 列。
- [x] **股市行业板块（新浪财经）** — 东方财富服务端调用失败已弃用，改接**新浪财经行业板块**（`money.finance.sina.com.cn` 的 `newFLJK.php`，GBK 解码、按涨跌幅排序），无需密钥，已验证拉取 84 个板块。
- [x] **Web PWA 构建验证通过** — `pnpm build:web`（`expo export --platform web`）已实测可导出 15 个静态路由到 `dist/`。构建需 **Node 22**（静态渲染阶段 supabase realtime 需要全局 WebSocket）；`app.json` 的 plugins 已移除多余的 `expo-web-browser`（其无 config plugin，会导致 TS 插件加载报错）；已补充依赖 `react-native-web`、`@opentelemetry/api`。
- [ ] **Apple 开发者账号信息** — **非必需**：本应用的「手机端桌面版本」走 **Web PWA** 路线（见下方说明），无需 Apple 开发者账号。仅当你要把它做成上架 App Store 的原生 iOS App 时，才需在 `eas.json` 填 Team ID 并付费（$99/年）走 EAS Build/Submit。
- [ ] **APP 正式图标** — 当前为占位月亮图标，可替换为国漫形象
- [ ] **手动精选内容源** — 微信/三联/小红书/小宇宙"我的关注"无开放接口，需在 App 内手动添加或由你定期维护
- [ ] **网页端 Service Worker 离线缓存** — 当前 PWA 已配置 standalone + 主题色，离线缓存待接入

> 🔑 密钥来源提醒：你提供的 `sb_publishable_7rTv...` 与后来发的 `service_role`（ref `raueolwnbyaavjrchxgm`）都属于**另一个项目 `susuu000's Project`**，并非本 App 的 `susu-life-workbench`。部署已使用本项目的正确密钥完成，请勿把另一项目的密钥混用进来。本项目的 publishable key 为 `sb_publishable_rA1Q9XIZJsa6Lxr5fX8ZVw_oKznvatB`。

---

## 设计规范

| 属性 | 值 |
|------|-----|
| 主色调 | 秘色 `#2E6F7E` |
| 点缀色 | 金 `#C9A227` / 滇红 `#8C2230` / 土 `#B07D3C` |
| 背景色 | 米白 `#F5F4EF`（护眼） |
| 时间字体 | Times New Roman（白色加粗大号） |
| APP 图标 | 秘色底 + 月亮国漫形象 + 金/土/滇红点缀 |

---

## License

个人私有项目
