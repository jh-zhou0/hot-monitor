"""Ported from src/lib/sources/hackernews.ts"""

from __future__ import annotations

import time
from urllib.parse import quote

import httpx

from models import RawSearchResult

HN_API = "https://hn.algolia.com/api/v1"


async def search_hackernews(keyword: str) -> list[RawSearchResult]:
    try:
        since = int(time.time()) - 7 * 86400
        url = (
            f"{HN_API}/search_by_date?query={quote(keyword)}"
            f"&tags=(story,show_hn)&numericFilters=created_at_i>{since}&hitsPerPage=10"
        )
        async with httpx.AsyncClient(timeout=8.0) as client:
            res = await client.get(url)
        if res.status_code != 200:
            return []

        data = res.json()
        hits = data.get("hits") or []
        results: list[RawSearchResult] = []

        for h in hits:
            if not h.get("title") or (h.get("points") or 0) < 5:
                continue
            results.append(
                {
                    "title": h["title"],
                    "url": h.get("url") or f"https://news.ycombinator.com/item?id={h['objectID']}",
                    "snippet": (
                        f"HN {h.get('points', 0)} points · "
                        f"{h.get('num_comments', 0)} comments · by {h.get('author', '')}"
                    ),
                    "source_type": "hackernews",
                    "author": h.get("author"),
                    "published_at": h.get("created_at"),
                }
            )
        return results
    except Exception as e:
        print(f"[hackernews] Search failed: {e}", flush=True)
        return []


async def get_hackernews_top(keyword: str) -> list[RawSearchResult]:
    try:
        search_results = await search_hackernews(keyword)

        url = f"{HN_API}/search?query={quote(keyword)}&tags=front_page&hitsPerPage=5"
        async with httpx.AsyncClient(timeout=8.0) as client:
            top_res = await client.get(url)
        if top_res.status_code != 200:
            return search_results

        top_data = top_res.json()
        keyword_lower = keyword.lower()
        top_hits: list[RawSearchResult] = []

        for h in top_data.get("hits") or []:
            title = h.get("title") or ""
            if keyword_lower not in title.lower():
                continue
            top_hits.append(
                {
                    "title": title,
                    "url": h.get("url") or f"https://news.ycombinator.com/item?id={h['objectID']}",
                    "snippet": (
                        f"🔥 HN Front Page · {h.get('points', 0)} points · "
                        f"{h.get('num_comments', 0)} comments"
                    ),
                    "source_type": "hackernews",
                    "author": h.get("author"),
                    "published_at": h.get("created_at"),
                }
            )

        return (top_hits + search_results)[:10]
    except Exception as e:
        print(f"[hackernews] Top fetch failed: {e}", flush=True)
        return []
