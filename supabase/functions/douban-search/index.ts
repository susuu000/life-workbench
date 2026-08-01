import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders, json } from '../_shared/cors.ts';

// 豆瓣搜索代理：前端传入书名/影视名，代理抓取豆瓣搜索结果返回封面/作者/简介
// GET /douban-search?q=搜索关键词
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const q = url.searchParams.get('q') || '';
    if (!q.trim()) return json({ ok: false, error: '缺少搜索关键词' }, 400);

    // 搜索豆瓣
    const searchUrl = `https://www.douban.com/search?cat=1001&q=${encodeURIComponent(q)}`;
    const resp = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!resp.ok) throw new Error(`豆瓣搜索 HTTP ${resp.status}`);

    const html = await resp.text();

    // 解析第一个搜索结果
    const result: Record<string, string> = { type: 'book' };

    // 提取标题链接和类型判断
    const titleMatch = html.match(/<a[^>]*href="https:\/\/book\.douban\.com\/subject\/(\d+)\/"[^>]*>([^<]+)<\/a>/);
    const movieMatch = html.match(/<a[^>]*href="https:\/\/movie\.douban\.com\/subject\/(\d+)\/"[^>]*>([^<]+)<\/a>/);

    if (movieMatch) {
      result.type = 'movie';
      result.id = movieMatch[1];
      result.title = movieMatch[2].trim();

      // 尝试获取电影详情页更多信息
      try {
        const detailResp = await fetch(`https://movie.douban.com/subject/${result.id}/`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15' },
          signal: AbortSignal.timeout(6000),
        });
        if (detailResp.ok) {
          const detailHtml = await detailResp.text();
          // 封面
          const imgMatch = detailHtml.match(/<img[^>]*src="([^"]*\.(?:jpg|png|webp))"[^>]*alt="([^"]*)"/);
          if (imgMatch) result.cover_url = imgMatch[1];
          // 导演/演员
          const dirMatch = detailHtml.match(/<a[^>]*href="\/celebrity\/\d+\/"[^>]*rel="v:directedBy"[^>]*>([^<]+)<\/a>/);
          if (dirMatch) result.author = `导演: ${dirMatch[1].trim()}`;
          // 简介
          const summaryMatch = detailHtml.match(/<span[^>]*property="v:summary"[^>]*>([\s\S]*?)<\/span>/);
          if (summaryMatch) result.description = summaryMatch[1].replace(/<[^>]*>/g, '').trim().slice(0, 200);
        }
      } catch { /* 详情页失败不影响 */ }
    } else if (titleMatch) {
      result.type = 'book';
      result.id = titleMatch[1];
      result.title = titleMatch[2].trim();

      try {
        const detailResp = await fetch(`https://book.douban.com/subject/${result.id}/`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15' },
          signal: AbortSignal.timeout(6000),
        });
        if (detailResp.ok) {
          const detailHtml = await detailResp.text();
          const imgMatch = detailHtml.match(/<a[^>]*class="nbg"[^>]*href="[^"]*"[^>]*>\s*<img[^>]*src="([^"]*)"/);
          if (imgMatch) result.cover_url = imgMatch[1];
          const authorMatch = detailHtml.match(/<span[^>]*>\s*<a[^>]*href="\/author\/\d+\/"[^>]*>([^<]+)<\/a>/);
          if (authorMatch) result.author = authorMatch[1].trim();
          const introMatch = detailHtml.match(/<div[^>]*class="intro"[^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/);
          if (introMatch) result.description = introMatch[1].replace(/<[^>]*>/g, '').trim().slice(0, 200);
        }
      } catch { /* 详情页失败不影响 */ }
    }

    if (!result.title) {
      return json({ ok: false, error: '未找到匹配结果' });
    }

    return json({ ok: true, data: result });
  } catch (e) {
    console.error('[douban-search] 错误:', (e as Error).message);
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
