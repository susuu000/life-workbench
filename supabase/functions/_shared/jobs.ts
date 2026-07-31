// 各板块抓取任务：拉取 RSS -> 解析 -> 写入对应缓存表（幂等，按 url/标题去重）
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { parseRss, toIso, type RssItem } from './rss.ts';
import { fetchText, NEWS_SOURCES, AI_SOURCES, LISTENING_SOURCES } from './sources.ts';
import { deepseekChat, aiEnabled } from './ai.ts';

/** 简易日志 */
function log(...a: unknown[]) {
  console.log('[jobs]', ...a);
}

/**
 * 通用 upsert：先按 keyField 去重（避免重复运行堆积），再插入新数据。
 * 同时清理 N 天前的旧数据，保持缓存新鲜。
 */
async function upsertByKey(
  sb: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[],
  keyField: string,
  keepDays = 7
) {
  if (rows.length === 0) return 0;
  // 去重：拉取已有 key
  const { data: existing } = await sb.from(table).select(keyField).limit(5000);
  const seen = new Set((existing ?? []).map((r: any) => r[keyField]));
  const fresh = rows.filter((r) => !seen.has(r[keyField]));
  if (fresh.length === 0) return 0;

  const { error } = await sb.from(table).insert(fresh);
  if (error) throw new Error(`${table} 插入失败: ${error.message}`);

  // 清理旧数据
  const cutoff = new Date(Date.now() - keepDays * 86400000).toISOString().slice(0, 10);
  await sb.from(table).delete().lt('published_at', cutoff).then(() => {}).catch(() => {});
  return fresh.length;
}

/** 抓取单个源并解析 */
async function fetchSource(src: { url: string; source: string }): Promise<RssItem[]> {
  try {
    const xml = await fetchText(src.url);
    const items = parseRss(xml);
    log(`源 ${src.source} 解析到 ${items.length} 条`);
    return items;
  } catch (e) {
    log(`源 ${src.source} 抓取失败: ${(e as Error).message}`);
    return [];
  }
}

// ---------- 时事新闻 ----------
export async function refreshNews(sb: SupabaseClient) {
  const rows: Record<string, unknown>[] = [];
  for (const src of NEWS_SOURCES) {
    const items = await fetchSource(src);
    for (const it of items) {
      rows.push({
        source: src.source,
        title: it.title,
        url: it.link,
        summary: it.description,
        published_at: toIso(it.pubDate).slice(0, 10),
      });
    }
  }
  const n = await upsertByKey(sb, 'news_cache', rows, 'url');
  log(`news_cache 新增 ${n} 条`);
  return n;
}

// ---------- AI 前沿（发现页） ----------
export async function refreshAiFrontier(sb: SupabaseClient) {
  const rows: Record<string, unknown>[] = [];
  for (const src of AI_SOURCES) {
    const items = await fetchSource(src);
    for (const it of items) {
      rows.push({
        title: it.title,
        summary: it.description || it.title,
        source: src.source,
        url: it.link,
        published_at: toIso(it.pubDate).slice(0, 10),
      });
    }
  }
  const n = await upsertByKey(sb, 'ai_frontier_cache', rows, 'url');
  log(`ai_frontier_cache 新增 ${n} 条`);
  return n;
}

// ---------- AI 学习 · 前沿资讯（含 DeepSeek 结构化解读） ----------
export async function refreshAiInsights(sb: SupabaseClient) {
  if (!aiEnabled()) {
    log('未配置任何 AI 密钥，跳过 AI 解读生成');
    return 0;
  }
  const rows: Record<string, unknown>[] = [];
  for (const src of AI_SOURCES) {
    const items = await fetchSource(src);
    for (const it of items.slice(0, 4)) {
      const prompt =
        `请用中文输出对以下 AI 资讯的结构化解读（每项不超过 60 字）：\n` +
        `标题：${it.title}\n摘要：${it.description}\n\n` +
        `输出严格 JSON：{"highlights":"核心亮点","shortcomings":"局限/风险","value_summary":"对我的价值"}`;
      try {
        const ai = await deepseekChat(prompt, '你是 AI 领域分析师，输出简洁中文，且只输出 JSON。');
        const m = ai.match(/\{[\s\S]*\}/);
        const parsed = m ? JSON.parse(m[0]) : {};
        rows.push({
          type: 'news',
          content: it.title,
          highlights: parsed.highlights || '',
          shortcomings: parsed.shortcomings || '',
          value_summary: parsed.value_summary || '',
          source_url: it.link,
          published_at: toIso(it.pubDate).slice(0, 10),
        });
      } catch (e) {
        log(`AI 解读失败 ${it.title}: ${(e as Error).message}`);
      }
    }
  }
  const n = await upsertByKey(sb, 'ai_insights', rows, 'source_url');
  log(`ai_insights 新增 ${n} 条`);
  return n;
}

// ---------- 每日外刊（含 DeepSeek 中译） ----------
export async function refreshListening(sb: SupabaseClient) {
  const rows: Record<string, unknown>[] = [];
  for (const src of LISTENING_SOURCES) {
    const items = await fetchSource(src);
    for (const it of items.slice(0, 3)) {
      let translation = '';
      if (aiEnabled()) {
        try {
          translation = await deepseekChat(
            `请将以下英文新闻译成中文，保留关键信息：\n${it.title}\n${it.description}`,
            '你是专业英文翻译，输出流畅中文，不要加解释。'
          );
        } catch (e) {
          log(`翻译失败: ${(e as Error).message}`);
        }
      }
      rows.push({
        title: it.title,
        audio_url: it.link,
        transcript: it.description,
        translation,
        date: toIso(it.pubDate).slice(0, 10),
      });
    }
  }
  const n = await upsertByKey(sb, 'listening_articles', rows, 'title');
  log(`listening_articles 新增 ${n} 条`);
  return n;
}

// ---------- 书影上新（TMDB 电影） ----------
export async function refreshBookMovie(sb: SupabaseClient) {
  const apiKey = Deno.env.get('TMDB_API_KEY');
  const readToken = Deno.env.get('TMDB_API_READ_TOKEN');
  if (!apiKey && !readToken) {
    log('book_movie_new 跳过：未配置 TMDB_API_KEY / TMDB_API_READ_TOKEN');
    return 0;
  }
  const authHeader: Record<string, string> = { 'User-Agent': 'Mozilla/5.0' };
  if (readToken) authHeader['Authorization'] = `Bearer ${readToken}`;
  const withKey = (path: string) => (apiKey ? `${path}${path.includes('?') ? '&' : '?'}api_key=${apiKey}` : path);

  const tmdbGet = async (path: string): Promise<any> => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    try {
      const resp = await fetch(`https://api.themoviedb.org/3${withKey(path)}`, {
        headers: authHeader,
        signal: ctrl.signal,
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return await resp.json();
    } finally {
      clearTimeout(timer);
    }
  };

  const rows: Record<string, unknown>[] = [];
  const seenId = new Set<number>();
  const today = new Date().toISOString().slice(0, 10);
  for (const kind of ['now_playing', 'upcoming']) {
    try {
      const json = await tmdbGet(`/movie/${kind}?region=CN&language=zh-CN&page=1`);
      for (const m of (json?.results ?? []) as any[]) {
        if (!m?.id || seenId.has(m.id)) continue;
        seenId.add(m.id);
        rows.push({
          type: 'movie',
          title: m.title || m.original_title || '',
          author: '',
          source: 'tmdb',
          url: `https://www.themoviedb.org/movie/${m.id}`,
          published_at: (m.release_date || '').slice(0, 10) || today,
          poster_url: m.poster_path ? `https://image.tmdb.org/t/p/w342${m.poster_path}` : null,
          rating: m.vote_average != null ? Number(Number(m.vote_average).toFixed(1)) : null,
        });
      }
    } catch (e) {
      log(`TMDB ${kind} 抓取失败: ${(e as Error).message}`);
    }
  }
  const n = await upsertByKey(sb, 'book_movie_new', rows, 'url', 45);
  log(`book_movie_new 新增 ${n} 条`);
  return n;
}

// ---------- 股市行业板块（新浪财经） ----------
export async function refreshStocks(sb: SupabaseClient) {
  try {
    const url =
      'https://money.finance.sina.com.cn/q/view/newFLJK.php?param=hy&sort=amount&asc=0&num=40';
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://finance.sina.com.cn' },
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    // 新浪返回 GBK 编码的 JS 变量（var x = {...};），需按字节解码
    const buf = new Uint8Array(await resp.arrayBuffer());
    const text = new TextDecoder('gbk').decode(buf);
    const m = text.match(/=\s*(\{[\s\S]*\})\s*;?\s*$/);
    if (!m) throw new Error('无法解析新浪板块数据');
    const obj = JSON.parse(m[1]);
    const today = new Date().toISOString().slice(0, 10);
    const rows: Record<string, unknown>[] = [];
    for (const key of Object.keys(obj)) {
      const parts = String(obj[key]).split(',');
      const name = (parts[1] || '').trim();
      const changePct = Number(parts[5]);
      if (!name) continue;
      rows.push({ sector: name, change_pct: isNaN(changePct) ? 0 : changePct, data_date: today });
    }
    if (rows.length === 0) return 0;

    // 每个交易日重建：先删当日，再插入
    await sb.from('stock_sector_info').delete().eq('data_date', today);
    const { error } = await sb.from('stock_sector_info').insert(rows);
    if (error) throw new Error(error.message);
    log(`stock_sector_info 新增 ${rows.length} 条`);
    return rows.length;
  } catch (e) {
    log(`stock 抓取失败: ${(e as Error).message}`);
    return 0;
  }
}
