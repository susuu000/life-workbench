// 轻量 RSS 2.0 / Atom 解析器（正则实现，避免引入额外依赖）
export interface RssItem {
  title: string;
  link: string;
  description: string;
  pubDate: string; // 原始日期字符串
  guid: string;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#0?39;/g, "'")
    .replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&amp;/g, '&');
}

function tag(block: string, name: string): string {
  // 匹配 <name>...</name> 或 <name attr>...</name>
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  if (!m) return '';
  // 去除 <![CDATA[ ... ]]> 包装
  let inner = m[1].trim();
  inner = inner.replace(/^<!\[CDATA\[([\s\S]*?)\]\]>\s*$/i, '$1').trim();
  return decodeEntities(inner);
}

function attr(block: string, tagName: string, attrName: string): string {
  const m = block.match(
    new RegExp(`<${tagName}\\b[^>]*\\b${attrName}=["']([^"']*)["'][^>]*/?>`, 'i')
  );
  return m ? m[1] : '';
}

function stripHtml(s: string): string {
  return s
    .replace(/<\/(p|div|br|li)>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 解析 RSS / Atom XML，返回条目数组 */
export function parseRss(xml: string): RssItem[] {
  const items: RssItem[] = [];
  const isAtom = /<feed[^>]*xmlns="[^"]*Atom"/i.test(xml) || /<entry\b/i.test(xml);

  // RSS 2.0 的 <item>，以及 Atom 的 <entry>
  const blockTag = isAtom ? 'entry' : 'item';
  const blocks = xml.match(new RegExp(`<${blockTag}\\b[\\s\\S]*?</${blockTag}>`, 'gi')) || [];

  for (const b of blocks) {
    let link = tag(b, 'link');
    if (!link && isAtom) {
      // Atom: <link href="..."/>
      link = attr(b, 'link', 'href');
    }
    const title = tag(b, 'title');
    const description = stripHtml(tag(b, 'description') || tag(b, 'summary') || tag(b, 'content'));
    const pubDate = tag(b, 'pubDate') || tag(b, 'published') || tag(b, 'updated') || '';
    const guid = tag(b, 'guid') || tag(b, 'id') || link;

    if (title && link) {
      items.push({ title, link, description: description.slice(0, 500), pubDate, guid });
    }
  }
  return items;
}

/** 将各种日期格式归一化为 ISO 字符串；失败返回当前时间 */
export function toIso(d: string): string {
  const t = Date.parse(d);
  return isNaN(t) ? new Date().toISOString() : new Date(t).toISOString();
}
