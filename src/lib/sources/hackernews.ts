import { RawSearchResult } from '@/types';

// HackerNews Algolia API - 免费，无需 key，实时性好
const HN_API = 'https://hn.algolia.com/api/v1';

export async function searchHackerNews(keyword: string): Promise<RawSearchResult[]> {
  try {
    const query = encodeURIComponent(keyword);
    // 搜索最近 7 天内的帖子，按时间排序
    const url = `${HN_API}/search_by_date?query=${query}&tags=(story,show_hn)&numericFilters=created_at_i>${Math.floor(Date.now() / 1000) - 7 * 86400}&hitsPerPage=10`;

    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return [];

    const data = await res.json();
    const hits = data.hits || [];

    return hits
      .filter((h: HNHit) => h.title && h.points >= 5)
      .map((h: HNHit) => ({
        title: h.title,
        url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
        snippet: `HN ${h.points} points · ${h.num_comments} comments · by ${h.author}`,
        source_type: 'hackernews' as const,
        author: h.author,
        published_at: h.created_at,
      }));
  } catch (e) {
    console.error('[hackernews] Search failed:', e);
    return [];
  }
}

// 获取 HN 热门故事（不依赖关键词，直接拿热榜）
export async function getHackerNewsTop(keyword: string): Promise<RawSearchResult[]> {
  try {
    // 先搜索相关内容
    const searchResults = await searchHackerNews(keyword);

    // 再从热门故事里过滤相关的
    const topRes = await fetch(`${HN_API}/search?query=${encodeURIComponent(keyword)}&tags=front_page&hitsPerPage=5`, {
      signal: AbortSignal.timeout(8000),
    });

    if (!topRes.ok) return searchResults;

    const topData = await topRes.json();
    const keywordLower = keyword.toLowerCase();
    const topHits = (topData.hits || [])
      .filter((h: HNHit) => h.title?.toLowerCase().includes(keywordLower))
      .map((h: HNHit) => ({
        title: h.title,
        url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
        snippet: `🔥 HN Front Page · ${h.points} points · ${h.num_comments} comments`,
        source_type: 'hackernews' as const,
        author: h.author,
        published_at: h.created_at,
      }));

    return [...topHits, ...searchResults].slice(0, 10);
  } catch (e) {
    console.error('[hackernews] Top fetch failed:', e);
    return [];
  }
}

interface HNHit {
  objectID: string;
  title: string;
  url?: string;
  points: number;
  num_comments: number;
  author: string;
  created_at: string;
}
