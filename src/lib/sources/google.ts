import * as cheerio from 'cheerio';
import { RawSearchResult } from '@/types';

export async function searchGoogle(keyword: string): Promise<RawSearchResult[]> {
  const searchQuery = keyword.includes(' ') ? `"${keyword}"` : keyword;
  const query = encodeURIComponent(searchQuery);
  const url = `https://www.google.com/search?q=${query}&hl=zh-CN&num=10&tbs=qdr:w`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'Accept-Encoding': 'gzip, deflate',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return [];

    const html = await res.text();
    const $ = cheerio.load(html);
    const results: RawSearchResult[] = [];

    // Google 搜索结果选择器
    $('div.g, div[data-sokoban-container]').each((_, el) => {
      const titleEl = $(el).find('h3').first();
      const linkEl = $(el).find('a[href^="http"]').first();
      const snippetEl = $(el).find('[data-sncf], .VwiC3b, .s3v9rd').first();

      const title = titleEl.text().trim();
      const href = linkEl.attr('href') || '';
      const snippet = snippetEl.text().trim();

      if (title && href && !href.includes('google.com')) {
        results.push({
          title,
          url: href,
          snippet,
          source_type: 'google',
        });
      }
    });

    return results.slice(0, 8);
  } catch (e) {
    console.error('[google] Search failed:', e);
    return [];
  }
}
