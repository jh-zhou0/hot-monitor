import * as cheerio from 'cheerio';
import { RawSearchResult } from '@/types';
import { searchLimiter } from '@/lib/utils/rate-limiter';

export async function searchDuckDuckGo(keyword: string): Promise<RawSearchResult[]> {
  await searchLimiter.waitForSlot();

  const query = encodeURIComponent(keyword);
  const url = `https://html.duckduckgo.com/html/?q=${query}`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return [];

    const html = await res.text();
    const $ = cheerio.load(html);
    const results: RawSearchResult[] = [];

    $('.result').each((_, el) => {
      const titleEl = $(el).find('.result__title a');
      const title = titleEl.text().trim();
      const href = titleEl.attr('href') || '';
      const snippet = $(el).find('.result__snippet').text().trim();

      if (title && href) {
        results.push({
          title,
          url: href.startsWith('//') ? `https:${href}` : href,
          snippet,
          source_type: 'duckduckgo',
        });
      }
    });

    return results.slice(0, 8);
  } catch (e) {
    console.error('[duckduckgo] Search failed:', e);
    return [];
  }
}
