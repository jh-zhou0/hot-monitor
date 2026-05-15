import { RawSearchResult } from '@/types';
import { twitterLimiter } from '@/lib/utils/rate-limiter';

const TWITTER_API_BASE = 'https://api.twitterapi.io/twitter';

const MIN_LIKES = 50;
const MIN_RETWEETS = 20;
const MIN_VIEWS = 2000;

export async function searchTwitter(keyword: string): Promise<RawSearchResult[]> {
  const apiKey = process.env.TWITTER_API_KEY;
  if (!apiKey) {
    console.warn('[twitter] TWITTER_API_KEY not configured, skipping');
    return [];
  }

  try {
    const topResults = await fetchTweets(keyword, 'Top', apiKey);
    const filtered = filterByEngagement(topResults);

    if (filtered.length >= 5) {
      return filtered.slice(0, 10);
    }

    const latestResults = await fetchTweets(keyword, 'Latest', apiKey);
    const latestFiltered = filterByEngagement(latestResults);

    const existing = new Set(filtered.map(r => r.url));
    const supplement = latestFiltered.filter(r => !existing.has(r.url));

    return [...filtered, ...supplement].slice(0, 10);
  } catch (e) {
    console.error('[twitter] Search failed:', e);
    return [];
  }
}

async function fetchTweets(keyword: string, queryType: string, apiKey: string): Promise<TwitterTweet[]> {
  await twitterLimiter.waitForSlot();

  const query = encodeURIComponent(`${keyword} -filter:replies`);
  const res = await fetch(
    `${TWITTER_API_BASE}/tweet/advanced_search?query=${query}&queryType=${queryType}`,
    {
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!res.ok) {
    console.error(`[twitter] API returned ${res.status}: ${await res.text()}`);
    return [];
  }

  const data = await res.json();
  return data.tweets || [];
}

function filterByEngagement(tweets: TwitterTweet[]): RawSearchResult[] {
  return tweets
    .filter(t => {
      const likes = t.likeCount ?? 0;
      const retweets = t.retweetCount ?? 0;
      const views = t.viewCount ?? 0;
      return likes >= MIN_LIKES && retweets >= MIN_RETWEETS && views >= MIN_VIEWS;
    })
    .map(tweet => ({
      title: truncate(tweet.text, 100),
      url: `https://x.com/${tweet.author?.userName || 'unknown'}/status/${tweet.id}`,
      snippet: tweet.text,
      source_type: 'twitter' as const,
      author: tweet.author?.userName || tweet.author?.name,
      published_at: tweet.createdAt,
    }));
}

interface TwitterTweet {
  id: string;
  text: string;
  createdAt?: string;
  likeCount?: number;
  retweetCount?: number;
  viewCount?: number;
  author?: {
    userName?: string;
    name?: string;
  };
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + '...';
}
