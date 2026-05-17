"""Ported from src/lib/sources/twitter.ts"""

from __future__ import annotations

import os
from urllib.parse import quote

import httpx

from models import RawSearchResult
from rate_limiter import twitter_limiter

TWITTER_API_BASE = "https://api.twitterapi.io/twitter"
MIN_LIKES = 50
MIN_RETWEETS = 20
MIN_VIEWS = 2000


async def search_twitter(keyword: str) -> list[RawSearchResult]:
    api_key = os.environ.get("TWITTER_API_KEY")
    if not api_key:
        print("[twitter] TWITTER_API_KEY not configured, skipping", flush=True)
        return []

    try:
        top_results = await _fetch_tweets(keyword, "Top", api_key)
        filtered = _filter_by_engagement(top_results)

        if len(filtered) >= 5:
            return filtered[:10]

        latest_results = await _fetch_tweets(keyword, "Latest", api_key)
        latest_filtered = _filter_by_engagement(latest_results)

        existing = {r["url"] for r in filtered}
        supplement = [r for r in latest_filtered if r["url"] not in existing]
        return (filtered + supplement)[:10]
    except Exception as e:
        print(f"[twitter] Search failed: {e}", flush=True)
        return []


async def _fetch_tweets(keyword: str, query_type: str, api_key: str) -> list[dict]:
    await twitter_limiter.wait_for_slot()
    query = quote(f"{keyword} -filter:replies")
    url = f"{TWITTER_API_BASE}/tweet/advanced_search?query={query}&queryType={query_type}"

    async with httpx.AsyncClient(timeout=30.0) as client:
        res = await client.get(
            url,
            headers={"x-api-key": api_key, "Content-Type": "application/json"},
        )
    if res.status_code != 200:
        print(f"[twitter] API returned {res.status_code}: {res.text}", flush=True)
        return []
    data = res.json()
    return data.get("tweets") or []


def _filter_by_engagement(tweets: list[dict]) -> list[RawSearchResult]:
    results: list[RawSearchResult] = []
    for t in tweets:
        likes = t.get("likeCount") or 0
        retweets = t.get("retweetCount") or 0
        views = t.get("viewCount") or 0
        if likes < MIN_LIKES or retweets < MIN_RETWEETS or views < MIN_VIEWS:
            continue
        author = (t.get("author") or {})
        username = author.get("userName") or "unknown"
        text = t.get("text") or ""
        results.append(
            {
                "title": _truncate(text, 100),
                "url": f"https://x.com/{username}/status/{t.get('id', '')}",
                "snippet": text,
                "source_type": "twitter",
                "author": author.get("userName") or author.get("name"),
                "published_at": t.get("createdAt"),
            }
        )
    return results


def _truncate(s: str, max_len: int) -> str:
    if len(s) <= max_len:
        return s
    return s[:max_len] + "..."
