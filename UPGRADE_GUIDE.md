# 生活工作台 v3 升级指南

## 概述

本次升级融合了 **GitHub Pages 版**（完整功能）和 **CodeBuddy 版**（精致 UI）的优点，重点优化了首页视觉、侧边栏、底部导航、PWA 体验。

## 变更文件清单

### 新增文件

| 文件 | 说明 |
|------|------|
| `components/SidebarV3.tsx` | CodeBuddy 风格侧边栏组件 |
| `components/SkeletonLoader.tsx` | 骨架屏加载组件 |
| `lib/pwa-config.ts` | PWA 配置文件 |
| `public/sw.js` | Service Worker 离线缓存 |
| `public/ios-pwa.js` | iOS PWA 体验增强脚本 |

### 修改文件

| 文件 | 变更说明 |
|------|----------|
| `lib/theme.ts` | 扩展配色体系（渐变、侧边栏、骨架屏颜色 + ModuleColors 映射） |
| `app/(tabs)/index.tsx` | 首页大改：渐变背景、大字日期/星期、CodeBuddy 风格卡片、打卡动画、骨架屏 |
| `app/(tabs)/_layout.tsx` | 底部 Tab 栏重写：SVG 风格图标、选中缩放动画、safe-area 适配 |

### 需要手动更新的文件

| 文件 | 变更说明 |
|------|----------|
| `app/_layout.tsx` | 将 `Sidebar` 替换为 `SidebarV3` |
| `app.json` | 更新 PWA manifest 配置（参考 `lib/pwa-config.ts`） |
| `index.html`（Web 入口） | 添加 `ios-pwa.js` 脚本引用 + iOS meta 标签 |

## 部署步骤

### 1. 替换文件

```bash
cd life-workbench

# 复制新文件
cp /path/to/life-workbench-v3/components/SidebarV3.tsx components/
cp /path/to/life-workbench-v3/components/SkeletonLoader.tsx components/
cp /path/to/life-workbench-v3/lib/theme.ts lib/
cp /path/to/life-workbench-v3/app/\(tabs\)/index.tsx app/\(tabs\)/
cp /path/to/life-workbench-v3/app/\(tabs\)/_layout.tsx app/\(tabs\)/
cp /path/to/life-workbench-v3/public/sw.js public/
cp /path/to/life-workbench-v3/public/ios-pwa.js public/
```

### 2. 更新 app/_layout.tsx

将 `import Sidebar from '@/components/Sidebar'` 改为：
```tsx
import SidebarV3, { CustomSection, persistCustomSections } from '@/components/SidebarV3';
```

将 `<Sidebar ... />` 替换为 `<SidebarV3 ... moduleKeys={moduleKeys} />`。

### 3. 更新 app.json

在 `expo.web` 中更新 PWA manifest（参考 `lib/pwa-config.ts` 的 PWA_CONFIG）。

### 4. 添加 iOS PWA 脚本

在 `app.json` 或 Web 入口 HTML 的 `<head>` 中添加：
```html
<script src="/ios-pwa.js"></script>
```

### 5. 构建和部署

```bash
# Web 构建（需 Node 22）
pnpm build:web

# 部署到 GitHub Pages
git add -A && git commit -m "v3: UI 升级 - CodeBuddy 风格侧边栏 + 底部导航 + 骨架屏 + PWA"
git push origin main
# GitHub Actions 会自动部署
```

## 关键设计变更

### 首页视觉升级

- **渐变背景**：顶部使用秘色纯色背景，带底部圆角 + 阴影，替代原来的全页米白底
- **大字日期**：FlipClock 上方增加「星期X + 年月日」大字居中展示
- **板块卡片**：图标改为彩色圆角方块（CodeBuddy 风格），每个板块独立配色
- **打卡动画**：完成打卡时卡片弹跳动画
- **骨架屏**：首次加载时显示骨架屏替代空白

### 侧边栏升级

- **秘色渐变背景**：深色侧边栏，与 CodeBuddy 版完全一致
- **Logo 头部**：月亮图标 + 「月夕 · 生活台」标题
- **导航项**：金色左边条激活态、白色半透明文字
- **自定义板块**：支持添加/删除自定义板块
- **遮罩层**：移动端点击遮罩关闭

### 底部导航升级

- **选中动画**：点击 Tab 时图标弹跳缩放
- **更精致的样式**：柔和的顶部分隔线 + 阴影
- **safe-area 适配**：底部自动适配 iPhone 刘海屏

### PWA 增强

- **Service Worker**：实现静态资源缓存、网络优先策略、离线回退
- **iOS 适配**：橡皮筋禁用、standalone 检测、状态栏颜色适配
- **推送通知**：SW 中预置推送事件处理（后续可接入 Web Push）

## 第二阶段新增（PWA + 推送 + 拖拽 + 导出 + 热力图 + 暗色模式）

### 新增文件

| 文件 | 说明 |
|------|------|
| `scripts/generate-precache.js` | 预缓存清单自动生成脚本（`pnpm build:web` 后运行） |
| `components/PushNotificationManager.tsx` | Web Push 通知管理组件 |
| `components/DraggableModuleGrid.tsx` | 板块拖拽排序组件 |
| `components/DataExporter.tsx` | 数据导出（CSV/JSON）组件 |
| `components/HabitHeatmap.tsx` | GitHub 风格习惯热力图 |
| `components/ThemeSettings.tsx` | 主题设置（暗色模式 + 主题色 + 字体） |
| `lib/dark-theme.ts` | 暗色模式完整配色方案 |
| `lib/themeRuntime.ts` | 增强的运行时主题管理（暗色模式 + 跟随系统） |
| `supabase/functions/push-manage/index.ts` | Push 通知 Supabase Edge Function |
| `supabase/migrations/0004_push_and_settings.sql` | 数据库迁移（push 订阅表 + 板块排序 + 暗色模式字段） |

### 部署第二阶段

```bash
# 1. 复制新组件
cp life-workbench-v3/components/PushNotificationManager.tsx components/
cp life-workbench-v3/components/DraggableModuleGrid.tsx components/
cp life-workbench-v3/components/DataExporter.tsx components/
cp life-workbench-v3/components/HabitHeatmap.tsx components/
cp life-workbench-v3/components/ThemeSettings.tsx components/

# 2. 更新核心库
cp life-workbench-v3/lib/dark-theme.ts lib/
cp life-workbench-v3/lib/themeRuntime.ts lib/

# 3. 复制脚本
cp life-workbench-v3/scripts/generate-precache.js scripts/
cp life-workbench-v3/supabase/functions/push-manage/ -r supabase/functions/
cp life-workbench-v3/supabase/migrations/0004_push_and_settings.sql supabase/migrations/

# 4. 在 package.json 添加 postbuild 钩子
# "postbuild:web": "node scripts/generate-precache.js"

# 5. 执行数据库迁移（Supabase SQL Editor）
# 粘贴 supabase/migrations/0004_push_and_settings.sql

# 6. 部署 Push Edge Function
# supabase functions deploy push-manage
# supabase secrets set VAPID_PUBLIC_KEY=<your-key>
# supabase secrets set VAPID_PRIVATE_KEY=<your-key>
# supabase secrets set VAPID_SUBJECT=mailto:your@email.com

# 7. 在设置页中集成 ThemeSettings 和 PushNotificationManager
# 编辑 app/settings.tsx 添加导入和使用

# 8. 在我的页中集成 HabitHeatmap 和 DataExporter
# 编辑 app/(tabs)/mine.tsx 添加导入和使用

# 9. 构建部署
pnpm build:web
git add -A && git commit -m "v3.1: PWA推送 + 拖拽排序 + 热力图 + 暗色模式 + 数据导出"
git push origin main
```

### 数据库变更

在 Supabase SQL Editor 中执行 `0004_push_and_settings.sql`，新增：

| 表/字段 | 说明 |
|---------|------|
| `push_subscriptions` 表 | 存储 Web Push 订阅信息 |
| `user_settings.push_enabled` | 推送开关 |
| `user_settings.push_reminder_time` | 提醒时间 HH:MM |
| `user_settings.dark_mode` | 暗色模式开关 |
| `user_settings.module_order` | 板块排序 JSON |
| `user_settings.module_visibility` | 板块可见性 JSON |
| `export_records` 表 | 导出记录 |

## 兼容性

- iOS Safari（添加到主屏幕）：完全支持
- iOS Safari 16.4+：支持 Web Push（需添加到主屏幕）
- Chrome Android（PWA）：完全支持（含 Web Push）
- 桌面浏览器：完全支持
- 原有 Supabase 后端：完全兼容，需执行 0004 迁移
- VAPID 密钥：需在 Supabase Dashboard 设置 Secrets

## 第三阶段新增（便签 + 手势 + 书影优化 + 性能 + 同步 + 每日金句）

### 新增文件

| 文件 | 说明 |
|------|------|
| `components/StickyNotes.tsx` | 便签/备忘录组件（多彩便签纸 + 拖拽 + 归档） |
| `components/SwipeableCard.tsx` | 左滑手势卡片（完成/跳过快捷操作） |
| `components/ReadingDetail.tsx` | 书影板块优化版（添加时可选书籍/影视类型 + 豆瓣匹配） |
| `components/DailyQuote.tsx` | 每日金句组件（20+ 内置名言 + 收藏 + 分享） |
| `lib/swr-cache.ts` | SWR 数据缓存 + 图片懒加载 + 代码分割工具 |
| `lib/sync-manager.ts` | 多端同步冲突处理 + 离线队列 + 同步指示器 |
| `supabase/migrations/0005_phase3_tables.sql` | 第三阶段数据库迁移 |

### 部署第三阶段

```bash
# 1. 复制新组件
cp life-workbench-v3/components/StickyNotes.tsx components/
cp life-workbench-v3/components/SwipeableCard.tsx components/
cp life-workbench-v3/components/ReadingDetail.tsx components/    # 覆盖旧版
cp life-workbench-v3/components/DailyQuote.tsx components/

# 2. 复制核心库
cp life-workbench-v3/lib/swr-cache.ts lib/
cp life-workbench-v3/lib/sync-manager.ts lib/

# 3. 数据库迁移（Supabase SQL Editor）
# 粘贴 supabase/migrations/0005_phase3_tables.sql

# 4. 在首页集成 DailyQuote 和 StickyNotes
# 编辑 app/(tabs)/index.tsx，在打卡卡片下方添加：
#   <DailyQuote />
#   <StickyNotes />

# 5. 构建部署
pnpm build:web
git add -A && git commit -m "v3.2: 便签 + 手势 + 书影类型 + 金句 + 性能优化 + 同步"
git push origin main
```

### 数据库变更（第三阶段）

| 表/字段 | 说明 |
|---------|------|
| `sticky_notes` 表 | 便签（内容 + 颜色 + 位置 + 归档） |
| `daily_quotes` 表 | 每日名言（含 5 条种子数据） |
| `favorite_quotes` 表 | 名言收藏 |
| `book_movie_entries.director` | 导演字段 |
| `book_movie_entries.rating` | 评分字段 |
| `sync_log` 表 | 同步操作日志 |

### 关键功能说明

#### 📝 便签组件
- 8 种配色可选（淡黄/暖黄/薄荷绿/天空蓝/樱花粉/淡紫/蜜桃/牛皮纸）
- 点击编辑、长按删除、一键归档
- 数据持久化到 Supabase

#### 👆 左滑手势
- 板块卡片左滑露出「完成」「跳过」按钮
- 阈值触发 + 松手回弹
- 可配置操作按钮颜色和数量

#### 📚 书影类型选择
- 添加条目时先选择「书籍」或「影视」
- 书籍显示总页数，影视显示总集数
- 列表项上显示类型徽标（📖 书籍 / 🎬 影视）
- 豆瓣自动匹配封面和简介

#### 💬 每日金句
- 20 条内置中文经典名言
- 支持随机切换、收藏、分享
- 每日固定展示（基于日期）

#### ⚡ 性能优化
- SWR 缓存策略（5 分钟 TTL + 内存缓存）
- 图片懒加载（IntersectionObserver）
- 代码分割工具（React.lazy 包装器）

#### 🔄 同步增强
- Last-Write-Wins 冲突策略
- 离线操作队列（localStorage）
- 自动重试（最多 3 次）
- 同步进度动画指示器

---

## 第四阶段：主题完善 & 最终整合

### 新增文件

#### 新增或更新的文件
```
lib/DarkModeProvider.tsx        — 全局暗色模式 Provider
lib/design-tokens.ts            — Design Token 体系
lib/types.ts                    — 全局类型定义
lib/supabase.ts                 — Supabase 客户端
components/HomeWidgetAssembler.tsx — 首页 Widget 组装器
app/_layout.tsx                 — 根布局（全局 Provider 集成）
scripts/generate-icons.js       — App 图标 & 启动画面生成
public/icons/                   — PWA 多尺寸 SVG 图标
public/splash/                  — iOS 启动画面
public/favicon.svg              — 网站图标
public/pwa-head-tags.html       — PWA HTML 标签
public/manifest-icons-ref.json  — Manifest 图标配置
```

#### 🌙 暗色模式 Provider
- 系统主题跟随（Web `matchMedia` + Native `Appearance`）
- 手动切换持久化到 Supabase `user_settings`
- `useDarkMode()` hook 供所有组件使用
- `useThemedStyles(factory)` 便捷 hook
- 自动同步 StatusBar 样式

#### 🎨 Design Token 体系
- **Space**：4px 基础网格，none → giant 共 10 级
- **Shadow**：5 级（none/subtle/standard/elevated/floating/heavy）
- **Radius**：7 级（xs → full）
- **Motion**：fast/normal/slow/spring/lightSpring
- **ZIndex**：7 级（content → top）
- **Type**：heading/body/caption/special 排版层级
- **Breakpoint**：mobile/tablet/desktop/wide 响应式断点
- **CardPreset/ButtonPreset/InputPreset**：常用组合预设

#### 🧩 首页 Widget 组装器
- 启用/禁用每日金句、便签、习惯热力图
- 拖拽排序
- 配置持久化到 Supabase

#### 📱 App 图标生成
- SVG 多尺寸图标（72-512px）
- iOS 启动画面（8 种设备尺寸）
- Favicon + Apple Touch Icon
- 月亮 + 星星 + "夕" 字设计
- 秘色渐变配色

#### 🏗️ 根布局集成
- Provider 嵌套：SafeArea → DarkMode → ErrorBoundary → Sync → Navigator
- 桌面端固定侧边栏 + 移动端 Modal 侧边栏
- 离线提示条（断网自动显示）
- 同步状态浮动指示器
- 全局错误边界（捕获未处理异常 + 重试按钮）
- SplashScreen 启动画面控制

### 部署检查清单

- [ ] 确保所有新增文件已提交
- [ ] 运行 `node scripts/generate-icons.js` 生成图标
- [ ] 将 `public/pwa-head-tags.html` 内容复制到根 HTML `<head>`
- [ ] 更新 `app.json` / `manifest.json` 的图标配置
- [ ] 验证暗色模式在 iOS Safari 和 Chrome 中正常工作
- [ ] 测试离线队列：断网 → 操作 → 联网 → 自动同步
- [ ] 测试移动端侧边栏：点击 ☰ → 滑出 → 选择 → 关闭
