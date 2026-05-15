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

  const deduped = deduplicateResults(allResults);
  const dateFiltered = filterByDate(deduped);
  return filterByRelevance(dateFiltered, keyword);
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

function filterByDate(results: RawSearchResult[]): RawSearchResult[] {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  return results.filter(r => {
    if (!r.published_at) return true;
    const pubDate = new Date(r.published_at);
    if (isNaN(pubDate.getTime())) return true;
    return pubDate >= sevenDaysAgo;
  });
}

function filterByRelevance(results: RawSearchResult[], keyword: string): RawSearchResult[] {
  const terms = keyword.toLowerCase().split(/\s+/).filter(t => t.length > 0);
  if (terms.length === 0) return results;

  return results.filter(r => {
    const text = `${r.title} ${r.snippet}`.toLowerCase();
    let matchedCount = 0;

    for (const term of terms) {
      if (termMatches(text, term)) {
        matchedCount++;
      }
    }

    if (terms.length <= 2) {
      return matchedCount === terms.length;
    }
    return matchedCount >= terms.length - 1;
  });
}

function termMatches(text: string, term: string): boolean {
  if (/^\d+$/.test(term)) {
    // Numeric term: avoid "5" matching inside "3.5"
    const regex = new RegExp(`(?<!\\d\\.)${term}\\b`);
    return regex.test(text);
  }
  return text.includes(term);
}
