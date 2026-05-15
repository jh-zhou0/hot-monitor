import * as cheerio from 'cheerio';
import { RawSearchResult } from '@/types';
import { searchLimiter } from '@/lib/utils/rate-limiter';

export async function searchBing(keyword: string): Promise<RawSearchResult[]> {
  await searchLimiter.waitForSlot();

  const searchQuery = keyword.includes(' ') ? `"${keyword}"` : keyword;
  const query = encodeURIComponent(searchQuery);
  const url = `https://www.bing.com/search?q=${query}&setlang=zh-CN&count=10&filters=${encodeURIComponent('ex1:"ez2"')}`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return [];

    const html = await res.text();
    const $ = cheerio.load(html);
    const results: RawSearchResult[] = [];

    $('li.b_algo').each((_, el) => {
      const titleEl = $(el).find('h2 a');
      const title = titleEl.text().trim();
      const href = titleEl.attr('href') || '';
      const snippet = $(el).find('.b_caption p').text().trim();

      if (title && href) {
        results.push({ title, url: href, snippet, source_type: 'bing' });
      }
    });

    return results.slice(0, 8);
  } catch (e) {
    console.error('[bing] Search failed:', e);
    return [];
  }
}
