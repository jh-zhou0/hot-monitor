import * as cheerio from 'cheerio';
import { RawSearchResult } from '@/types';

export async function searchSogou(keyword: string): Promise<RawSearchResult[]> {
  const query = encodeURIComponent(keyword);
  const url = `https://www.sogou.com/web?query=${query}&num=10`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'Referer': 'https://www.sogou.com/',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return [];

    const html = await res.text();
    const $ = cheerio.load(html);
    const results: RawSearchResult[] = [];

    // 搜狗搜索结果选择器
    $('.vrwrap, .rb, .results .result').each((_, el) => {
      const titleEl = $(el).find('h3 a, .vr-title a').first();
      const title = titleEl.text().trim();
      const href = titleEl.attr('href') || '';
      const snippet = $(el).find('.str-text, .ft, p').first().text().trim();

      if (title && href) {
        const fullUrl = href.startsWith('http') ? href : `https://www.sogou.com${href}`;
        results.push({
          title,
          url: fullUrl,
          snippet,
          source_type: 'sogou',
        });
      }
    });

    return results.slice(0, 8);
  } catch (e) {
    console.error('[sogou] Search failed:', e);
    return [];
  }
}
