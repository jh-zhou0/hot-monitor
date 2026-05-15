import { RawSearchResult } from '@/types';
import { searchBing } from './bing';
import { searchDuckDuckGo } from './duckduckgo';
import { searchGoogle } from './google';
import { searchSogou } from './sogou';
import { getHackerNewsTop } from './hackernews';
import { getWeiboHotSearch, searchWeibo } from './weibo';
import { searchTwitter } from './twitter';

export async function aggregateSearch(keyword: string): Promise<RawSearchResult[]> {
  const tasks = await Promise.allSettled([
    searchBing(keyword),
    searchDuckDuckGo(keyword),
    searchGoogle(keyword),
    searchSogou(keyword),
    getHackerNewsTop(keyword),
    getWeiboHotSearch(keyword),
    searchWeibo(keyword),
    searchTwitter(keyword),
  ]);

  const allResults: RawSearchResult[] = [];

  for (const task of tasks) {
    if (task.status === 'fulfilled') {
      allResults.push(...task.value);
    }
  }

  return deduplicateResults(allResults);
}

function deduplicateResults(results: RawSearchResult[]): RawSearchResult[] {
  const seen = new Map<string, RawSearchResult>();

  for (const r of results) {
    const key = normalizeForDedup(r.title);
    if (!seen.has(key)) {
      seen.set(key, r);
    }
  }

  return Array.from(seen.values());
}

function normalizeForDedup(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w一-鿿]/g, '')
    .slice(0, 50);
}
