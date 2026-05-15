import { RawSearchResult } from '@/types';
import { twitterLimiter } from '@/lib/utils/rate-limiter';

const TWITTER_API_BASE = 'https://api.twitterapi.io/twitter';

export async function searchTwitter(keyword: string): Promise<RawSearchResult[]> {
  const apiKey = process.env.TWITTER_API_KEY;
  if (!apiKey) {
    console.warn('[twitter] TWITTER_API_KEY not configured, skipping');
    return [];
  }

  await twitterLimiter.waitForSlot();

  try {
    const query = encodeURIComponent(keyword);
    const res = await fetch(
      `${TWITTER_API_BASE}/tweet/advanced_search?query=${query}&queryType=Latest`,
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
    const tweets = data.tweets || [];

    return tweets.slice(0, 10).map((tweet: TwitterTweet) => ({
      title: truncate(tweet.text, 100),
      url: `https://x.com/${tweet.author?.userName || 'unknown'}/status/${tweet.id}`,
      snippet: tweet.text,
      source_type: 'twitter' as const,
      author: tweet.author?.userName || tweet.author?.name,
      published_at: tweet.createdAt,
    }));
  } catch (e) {
    console.error('[twitter] Search failed:', e);
    return [];
  }
}

interface TwitterTweet {
  id: string;
  text: string;
  createdAt?: string;
  author?: {
    userName?: string;
    name?: string;
  };
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + '...';
}
