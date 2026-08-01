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
  keepDays = 7,
  maxTotal?: number
) {
  if (rows.length === 0) return 0;
  const { data: existing } = await sb.from(table).select(keyField).limit(5000);
  const seen = new Set((existing ?? []).map((r: any) => r[keyField]));
  const fresh = rows.filter((r) => !seen.has(r[keyField]));
  if (fresh.length === 0) return 0;

  const { error } = await sb.from(table).insert(fresh);
  if (error) throw new Error(`${table} 插入失败: ${error.message}`);

  // 若设了最大条数，删除超出部分
  if (maxTotal) {
    const { data: all } = await sb.from(table).select(keyField).order('published_at', { ascending: false });
    if (all && all.length > maxTotal) {
      const toDelete = all.slice(maxTotal).map((r: any) => r[keyField]);
      await sb.from(table).delete().in(keyField, toDelete);
    }
  }

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

// ---------- 时事新闻（每日最多 15 条） ----------
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
  // 按发布日期倒序排列，保留最新 15 条
  rows.sort((a, b) => (a.published_at as string) < (b.published_at as string) ? 1 : -1);
  const top = rows.slice(0, 15);
  const n = await upsertByKey(sb, 'news_cache', top, 'url', 7, 15);
  log(`news_cache 新增 ${n} 条（共保留最新 15 条）`);
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

  // 兜底抓取豆瓣热映/即将上映（网页抓取，失败不阻塞）
  try {
    const doubanRows = await fetchDoubanMovies();
    if (doubanRows.length > 0) {
      // 用 title 去重（db 已存在的不重复插入）
      const existing = new Set(rows.map((r: any) => (r.title as string).trim()));
      const fresh = doubanRows.filter((r: any) => !existing.has((r.title as string).trim()));
      if (fresh.length > 0) {
        const n2 = await upsertByKey(sb, 'book_movie_new', fresh, 'url', 8);
        log(`豆瓣抓取 新增 ${n2} 条`);
        return n + n2;
      }
    }
  } catch (e) {
    log(`豆瓣抓取失败（不影响 TMDB）: ${(e as Error).message}`);
  }

  return n;
}

/** 豆瓣电影「正在热映」网页抓取（仅兜底，失败返回空） */
async function fetchDoubanMovies(): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  const today = new Date().toISOString().slice(0, 10);

  for (const tag of ['nowplaying', 'later']) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 10000);
      const resp = await fetch(`https://movie.douban.com/cinema/${tag}/ningbo/`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15' },
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (!resp.ok) continue;
      const html = await resp.text();
      // 简单解析：提取 <li class="list-item" ...> 内的电影标题与链接
      const re = /<li[^>]*class="list-item"[^>]*>[\s\S]*?<a[^>]*href="(\/subject\/(\d+)\/)"[^>]*>([^<]+)<\/a>[\s\S]*?<\/li>/gi;
      let match;
      while ((match = re.exec(html)) !== null) {
        const id = match[2];
        const title = match[3].trim();
        if (!id || !title || title.length > 60) continue;
        rows.push({
          type: 'movie',
          title,
          author: '',
          source: 'douban',
          url: `https://movie.douban.com/subject/${id}/`,
          published_at: today,
          poster_url: null,
          rating: null,
        });
        if (rows.length >= 8) break;
      }
    } catch {
      /* 豆瓣抓取失败静默 */
    }
    if (rows.length >= 8) break;
  }

  return rows;
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

// ---------- AI 知识库 · 实操教程（Seedance 2.5 等） ----------
export async function refreshAiKnowledge(sb: SupabaseClient) {
  if (!aiEnabled()) {
    log('未配置任何 AI 密钥，跳过 AI 知识库生成');
    return 0;
  }

  // 实操知识主题
  const topics = [
    {
      category: 'ai_video',
      title: 'Seedance 2.5 更新：AI 视频生成新突破',
      prompt: `请以中文输出关于「Seedance 2.5 AI视频生成工具」的实操教程，包含以下结构化内容，每项不超过 100 字：
1. 核心更新亮点
2. CG质感：如何设置参数让画面更有电影感
3. 追逐节奏：镜头跟随主体的节奏控制技巧
4. 镜头切换：多镜头无缝衔接的方法
5. 角色一致性：跨镜头保持角色外貌一致的方法
输出严格 JSON 格式：{"title":"...","summary":"一句话概述","steps":[{"step":1,"title":"步骤标题","detail":"操作细节"},...],"core_tip":"最核心的一个技巧","category":"ai_video"}`,
    },
    {
      category: 'ai_video',
      title: 'AI 视频 CG 质感打造指南',
      prompt: `请以中文输出关于「AI视频 CG质感打造」的实操教程。包含：光影设置、材质纹理、色彩分级、渲染参数等具体操作步骤。输出严格 JSON 格式：{"title":"...","summary":"...","steps":[{"step":1,"title":"...","detail":"..."},...],"core_tip":"...","category":"ai_video"}`,
    },
    {
      category: 'ai_video',
      title: 'AI 视频追逐节奏与运镜技巧',
      prompt: `请以中文输出关于「AI视频追逐场景的节奏与运镜」实操教程。包含：速度曲线设置、景深控制、跟随镜头参数、紧张感营造。输出严格 JSON 格式：{"title":"...","summary":"...","steps":[{"step":1,"title":"...","detail":"..."},...],"core_tip":"...","category":"ai_video"}`,
    },
    {
      category: 'ai_video',
      title: 'AI 视频镜头切换与转场设计',
      prompt: `请以中文输出关于「AI视频镜头切换与转场」实操教程。包含：切换时机、转场类型选择、节奏把控、情绪引导。输出严格 JSON 格式：{"title":"...","summary":"...","steps":[{"step":1,"title":"...","detail":"..."},...],"core_tip":"...","category":"ai_video"}`,
    },
    {
      category: 'ai_video',
      title: 'AI 角色一致性：跨镜头保持人物形象',
      prompt: `请以中文输出关于「AI视频角色一致性保持」实操教程。包含：Seed 种子管理、参考图使用、Prompt 描述技巧、负面提示词。输出严格 JSON 格式：{"title":"...","summary":"...","steps":[{"step":1,"title":"...","detail":"..."},...],"core_tip":"...","category":"ai_video"}`,
    },
    {
      category: 'ai_office',
      title: 'AI 办公效率提升：自动化工作流搭建',
      prompt: `请以中文输出关于「AI办公自动化工作流」实操教程。包含：常用工具推荐、自动化场景、Prompt模板、效率对比。输出严格 JSON 格式：{"title":"...","summary":"...","steps":[{"step":1,"title":"...","detail":"..."},...],"core_tip":"...","category":"ai_office"}`,
    },
  ];

  const rows: Record<string, unknown>[] = [];
  for (const topic of topics) {
    try {
      const ai = await deepseekChat(topic.prompt, '你是 AI 工具实操专家，只输出 JSON，内容专业且可操作。');
      const m = ai.match(/\{[\s\S]*\}/);
      const parsed = m ? JSON.parse(m[0]) : null;
      if (parsed) {
        rows.push({
          category: parsed.category || topic.category,
          title: parsed.title || topic.title,
          summary: parsed.summary || '',
          steps: parsed.steps || [],
          core_tip: parsed.core_tip || '',
          content_type: 'tutorial',
          published_at: new Date().toISOString().slice(0, 10),
        });
      }
    } catch (e) {
      log(`AI 知识库生成失败 ${topic.title}: ${(e as Error).message}`);
    }
  }

  // 同时保留一些提示词类知识（通过不同 content_type 区分）
  const promptTopics = [
    {
      category: 'ai_office',
      title: '万能 AI 办公提示词模板',
      prompt: `请输出一个实用的 AI 办公提示词公式，包含：公式模板、四要素说明、使用场景、核心技巧。输出严格 JSON：{"title":"...","prompt_formula":"...","four_elements":"...","summary":"...","core_tip":"...","category":"ai_office","content_type":"prompt"}`,
    },
    {
      category: 'ai_comic',
      title: 'AI 漫剧分镜提示词技巧',
      prompt: `请输出关于 AI 漫剧分镜的提示词技巧，包含：公式、四要素、场景案例。输出严格 JSON：{"title":"...","prompt_formula":"...","four_elements":"...","summary":"...","core_tip":"...","category":"ai_comic","content_type":"prompt"}`,
    },
    {
      category: 'ai_build',
      title: 'AI 应用搭建最佳实践',
      prompt: `请输出关于用 AI 搭建应用的最佳实践，包含：工具选择、架构思路、提示词模板。输出严格 JSON：{"title":"...","prompt_formula":"...","four_elements":"...","summary":"...","core_tip":"...","category":"ai_build","content_type":"prompt"}`,
    },
  ];

  for (const topic of promptTopics) {
    try {
      const ai = await deepseekChat(topic.prompt, '你是 AI 应用专家，只输出 JSON。');
      const m = ai.match(/\{[\s\S]*\}/);
      const parsed = m ? JSON.parse(m[0]) : null;
      if (parsed) {
        rows.push({
          category: parsed.category || topic.category,
          title: parsed.title || topic.title,
          prompt_formula: parsed.prompt_formula || '',
          four_elements: parsed.four_elements || '',
          summary: parsed.summary || '',
          core_tip: parsed.core_tip || '',
          content_type: 'prompt',
          published_at: new Date().toISOString().slice(0, 10),
        });
      }
    } catch (e) {
      log(`AI 提示词生成失败 ${topic.title}: ${(e as Error).message}`);
    }
  }

  if (rows.length === 0) return 0;

  // 删除旧的 AI 生成内容，全量替换
  await sb.from('ai_knowledge_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  const { error } = await sb.from('ai_knowledge_items').insert(rows);
  if (error) throw new Error(`ai_knowledge_items 写入失败: ${error.message}`);
  log(`ai_knowledge_items 刷新 ${rows.length} 条（${rows.filter(r => r.content_type === 'tutorial').length} 教程 + ${rows.filter(r => r.content_type === 'prompt').length} 提示词）`);
  return rows.length;
}

// ---------- 自媒体内容生成（今日推荐 / 灵感 / 审美各 8 条） ----------
export async function refreshSocialMedia(sb: SupabaseClient) {
  if (!aiEnabled()) {
    log('未配置 AI 密钥，跳过自媒体内容生成');
    return 0;
  }

  const today = new Date().toISOString().slice(0, 10);
  const allRows: Record<string, unknown>[] = [];

  // 今日推荐（8条）：小红书/抖音爆款选题推荐
  try {
    const prompt = `请生成 8 条今日自媒体爆款选题推荐（小红书/抖音平台）。每条包含：标题、内容摘要（30字内）、平台(xiaohongshu/douyin)、流量逻辑分析（50字内）。输出严格 JSON 数组格式：[{"title":"...","content":"...","platform":"xiaohongshu","traffic_analysis":"...","source_url":"https://www.xiaohongshu.com/explore"},...]`;
    const ai = await deepseekChat(prompt, '你是自媒体运营专家，只输出 JSON 数组，内容具体可操作。');
    const m = ai.match(/\[[\s\S]*\]/);
    const items = m ? JSON.parse(m[0]) : [];
    for (const item of items) {
      allRows.push({
        type: 'today_rec',
        title: item.title,
        content: item.content || '',
        platform: item.platform || 'xiaohongshu',
        traffic_analysis: item.traffic_analysis || '',
        source_url: item.source_url || '',
        published_at: today,
      });
    }
  } catch (e) {
    log(`今日推荐生成失败: ${(e as Error).message}`);
  }

  // 今日灵感（8条）：创意选题灵感
  try {
    const prompt = `请生成 8 条今日自媒体创意灵感选题。每条包含：标题（有吸引力的选题）、内容简述（30字）。输出严格 JSON 数组：[{"title":"...","content":"..."},...]`;
    const ai = await deepseekChat(prompt, '你是创意内容策划专家，只输出 JSON 数组，选题新颖有爆款潜力。');
    const m = ai.match(/\[[\s\S]*\]/);
    const items = m ? JSON.parse(m[0]) : [];
    for (const item of items) {
      allRows.push({
        type: 'inspiration',
        title: item.title,
        content: item.content || '',
        platform: 'other',
        published_at: today,
      });
    }
  } catch (e) {
    log(`今日灵感生成失败: ${(e as Error).message}`);
  }

  // 审美搭建（8条）：视觉审美参考
  try {
    const prompt = `请生成 8 条今日审美搭建参考（适合小红书/Instagram 视觉风格）。每条包含：风格名称、描述（30字）、适合平台。输出严格 JSON 数组：[{"title":"...","content":"...","platform":"xiaohongshu"},...]`;
    const ai = await deepseekChat(prompt, '你是视觉审美专家，只输出 JSON 数组，风格描述具体可参考。');
    const m = ai.match(/\[[\s\S]*\]/);
    const items = m ? JSON.parse(m[0]) : [];
    for (const item of items) {
      allRows.push({
        type: 'aesthetic',
        title: item.title,
        content: item.content || '',
        platform: item.platform || 'xiaohongshu',
        published_at: today,
      });
    }
  } catch (e) {
    log(`审美搭建生成失败: ${(e as Error).message}`);
  }

  if (allRows.length === 0) return 0;

  // 删除当日旧数据，全量替换
  await sb.from('social_media_recs').delete().eq('published_at', today);
  const { error } = await sb.from('social_media_recs').insert(allRows);
  if (error) throw new Error(`social_media_recs 写入失败: ${error.message}`);
  log(`social_media_recs 刷新 ${allRows.length} 条（推荐/灵感/审美）`);
  return allRows.length;
}
