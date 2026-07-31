// 各板块 RSS 源定义（请按可用性替换/增删；部分中文源可能为 GBK，需服务端转码）
export interface RssSource {
  url: string;
  source: string;
}

// 时事新闻：新华网 / 人民网
export const NEWS_SOURCES: RssSource[] = [
  { url: 'https://www.xinhuanet.com/politics/news_politics.xml', source: 'xinhua' },
  { url: 'http://www.people.com.cn/rss/politics.xml', source: 'renmin' },
];

// AI 前沿：机器之心 / 36氪 / 量子位
export const AI_SOURCES: RssSource[] = [
  { url: 'https://www.jiqizhixin.com/rss', source: '机器之心' },
  { url: 'https://36kr.com/feed', source: '36氪' },
  { url: 'https://www.qbitai.com/feed', source: '量子位' },
];

// 每日外刊（英语学习）：BBC / NPR / VOA
export const LISTENING_SOURCES: RssSource[] = [
  { url: 'https://feeds.bbci.co.uk/news/rss.xml', source: 'BBC' },
  { url: 'https://feeds.npr.org/1001/rss.xml', source: 'NPR' },
  { url: 'https://learningenglish.voanews.com/api/epiqqq/rss/articles', source: 'VOA' },
];

// 书影上新：改由 TMDB API 拉取（见 refreshBookMovie），不再使用 RSS。
//（原 Letterboxd RSS 被 Cloudflare 403 拦截，故迁移至 TMDB）

/** 带超时的 fetch */
export async function fetchText(url: string, timeoutMs = 12000): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SusuBot/1.0)' },
      signal: ctrl.signal,
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.text();
  } finally {
    clearTimeout(timer);
  }
}
