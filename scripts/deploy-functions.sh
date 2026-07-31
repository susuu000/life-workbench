#!/usr/bin/env bash
# ============================================================
# Susu 生活工作台 · Edge Functions 一键部署脚本
# 作用：设置 Supabase Secrets + 部署全部 8 个 Edge Functions + (可选) 数据库迁移与每日定时
# 用法：
#   chmod +x scripts/deploy-functions.sh
#   ./scripts/deploy-functions.sh
# 前置：已安装 supabase CLI 并已 `supabase login`
# ============================================================
set -uo pipefail

# ===== 0. 配置（已验证的密钥值，来自用户提供的凭证）=====
PROJECT_REF="xyufbgmhjmqdanrblvit"
QWEATHER_API_KEY="<QWEATHER_API_KEY>"
QWEATHER_API_HOST="kh6pga2v33.re.qweatherapi.com"
DEEPSEEK_API_KEY="<DEEPSEEK_API_KEY>"

FUNCTIONS=(
  refresh-news
  refresh-ai-frontier
  refresh-ai-insights
  refresh-listening
  refresh-bookmovie
  refresh-stocks
  get-weather
  daily-cron
)

# ===== 1. 前置检查 =====
command -v supabase >/dev/null 2>&1 || {
  echo "❌ 未检测到 supabase CLI，请先安装：npm i -g supabase"
  exit 1
}

# ===== 2. Service Role Key（不写死，运行时提供）=====
if [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  echo "🔑 请输入 Supabase Service Role Key（控制台 Settings → API → service_role，输入不可见）："
  read -rs SUPABASE_SERVICE_ROLE_KEY
  echo
fi
if [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  echo "❌ 未提供 Service Role Key，无法部署（函数需要它写入数据库），退出。"
  exit 1
fi

# ===== 3. 链接项目 =====
echo "🔗 链接项目 $PROJECT_REF ..."
supabase link --project-ref "$PROJECT_REF" 2>/dev/null || \
  echo "ℹ️ 若已链接可忽略上面的提示"

# ===== 4. 设置 Secrets =====
echo "🔧 设置 Supabase Secrets ..."
supabase secrets set \
  QWEATHER_API_KEY="$QWEATHER_API_KEY" \
  QWEATHER_API_HOST="$QWEATHER_API_HOST" \
  DEEPSEEK_API_KEY="$DEEPSEEK_API_KEY" \
  SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY"
echo "✅ Secrets 已设置"

# ===== 5. (可选) 推送数据库迁移（含 0002 journal 桶 + 种子数据）=====
read -rp "🗄️  是否推送数据库迁移（supabase db push，含 0002）? [y/N] " PUSH
if [[ "$PUSH" =~ ^[Yy]$ ]]; then
  echo "🗄️  推送迁移 ..."
  supabase db push || echo "⚠️ 迁移推送失败，请到控制台 SQL Editor 手动执行 supabase/migrations/*.sql"
fi

# ===== 6. 逐个部署函数（单个失败不影响其余）=====
echo "🚀 开始部署 ${#FUNCTIONS[@]} 个 Edge Functions ..."
for fn in "${FUNCTIONS[@]}"; do
  echo "────────── 部署 $fn ──────────"
  if supabase functions deploy "$fn"; then
    echo "✅ $fn 部署成功"
  else
    echo "⚠️ $fn 部署失败，继续执行下一个"
  fi
done

# ===== 7. 每日定时（北京时间 0:00 = UTC 16:00）=====
echo ""
echo "🕛 配置每日定时刷新：执行下面 SQL（先把 YOUR_ANON_KEY 换成项目 anon key），"
echo "   或直接用文件 supabase/cron_daily.sql 在控制台 SQL Editor 运行："
cat <<'SQL'
select cron.schedule(
  'susu-daily-refresh',
  '0 16 * * *',
  $$
  select net.http_post(
    url := 'https://xyufbgmhjmqdanrblvit.supabase.co/functions/v1/daily-cron',
    headers := jsonb_build_object(
      'Authorization', 'Bearer YOUR_ANON_KEY',
      'Content-Type', 'application/json'
    )
  )
  $$
);
SQL

echo ""
echo "🎉 部署脚本执行完毕。"
echo "   - 天气：首页已可调用 get-weather 显示真实天气"
echo "   - AI 内容：DeepSeek 需账户有余额才会生成（否则相关函数自动跳过）"
echo "   - 定时：执行上面的 cron SQL 后，每日 0:00 自动刷新全部抓取任务"
