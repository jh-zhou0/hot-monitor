"""Ported from src/lib/sources/google.ts"""

from __future__ import annotations

import httpx
from bs4 import BeautifulSoup
from urllib.parse import quote

from models import RawSearchResult
from sources.bing import UA


async def search_google(keyword: str) -> list[RawSearchResult]:
    search_query = f'"{keyword}"' if " " in keyword else keyword
    url = f"https://www.google.com/search?q={quote(search_query)}&hl=zh-CN&num=10&tbs=qdr:w"

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.get(
                url,
                headers={
                    "User-Agent": UA.replace("120", "124"),
                    "Accept": "text/html,application/xhtml+xml",
                    "Accept-Language": "zh-CN,zh;q=0.9",
                },
            )
        if res.status_code != 200:
            return []

        soup = BeautifulSoup(res.text, "html.parser")
        results: list[RawSearchResult] = []

        for el in soup.select("div.g, div[data-sokoban-container]"):
            title_el = el.select_one("h3")
            link_el = el.select_one('a[href^="http"]')
            snippet_el = el.select_one("[data-sncf], .VwiC3b, .s3v9rd")
            if not title_el or not link_el:
                continue
            title = title_el.get_text(strip=True)
            href = link_el.get("href") or ""
            snippet = snippet_el.get_text(strip=True) if snippet_el else ""
            if title and href and "google.com" not in href:
                results.append(
                    {
                        "title": title,
                        "url": href,
                        "snippet": snippet,
                        "source_type": "google",
                    }
                )

        return results[:8]
    except Exception as e:
        print(f"[google] Search failed: {e}", flush=True)
        return []
