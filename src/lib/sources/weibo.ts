import * as cheerio from 'cheerio';
import { RawSearchResult } from '@/types';

// 微博热搜榜（公开接口，不需要登录）
export async function getWeiboHotSearch(keyword: string): Promise<RawSearchResult[]> {
  try {
    // 微博热搜榜 JSON 接口
    const res = await fetch('https://weibo.com/ajax/side/hotSearch', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Referer': 'https://weibo.com/',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return [];

    const data = await res.json();
    const hotList: WeiboHotItem[] = data?.data?.realtime || [];

    // 过滤与关键词相关的热搜，没有匹配则返回空
    const keywordLower = keyword.toLowerCase();
    const filtered = hotList.filter((item) =>
      item.word?.toLowerCase().includes(keywordLower) ||
      item.note?.toLowerCase().includes(keywordLower)
    );

    if (filtered.length === 0) return [];

    return filtered.map((item: WeiboHotItem) => ({
      title: item.word || '',
      url: `https://s.weibo.com/weibo?q=${encodeURIComponent(item.word || '')}`,
      snippet: item.note || `微博热搜 · 热度 ${item.num || 0}`,
      source_type: 'weibo' as const,
      published_at: new Date().toISOString(),
    })).filter((r: RawSearchResult) => r.title);
  } catch (e) {
    console.error('[weibo] Hot search failed:', e);
    return [];
  }
}

// 微博搜索（关键词搜索）
export async function searchWeibo(keyword: string): Promise<RawSearchResult[]> {
  try {
    const query = encodeURIComponent(keyword);
    const url = `https://s.weibo.com/weibo?q=${query}&typeall=1&suball=1&timescope=custom:${getYesterday()}:${getToday()}&Refer=g`;

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html',
        'Referer': 'https://weibo.com/',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return [];

    const html = await res.text();
    const $ = cheerio.load(html);
    const results: RawSearchResult[] = [];

    $('.card-wrap[action-type="feed_list_item"]').each((_, el) => {
      const textEl = $(el).find('.txt');
      const text = textEl.text().trim().replace(/\s+/g, ' ');
      const userEl = $(el).find('.name');
      const author = userEl.text().trim();
      const timeEl = $(el).find('.from a').first();
      const timeStr = timeEl.text().trim();
      const href = timeEl.attr('href') || '';

      if (text && text.length > 10) {
        results.push({
          title: text.slice(0, 80) + (text.length > 80 ? '...' : ''),
          url: href.startsWith('http') ? href : `https:${href}`,
          snippet: text,
          source_type: 'weibo' as const,
          author,
          published_at: timeStr,
        });
      }
    });

    return results.slice(0, 8);
  } catch (e) {
    console.error('[weibo] Search failed:', e);
    return [];
  }
}

interface WeiboHotItem {
  word?: string;
  note?: string;
  num?: number;
}

function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function getYesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}
