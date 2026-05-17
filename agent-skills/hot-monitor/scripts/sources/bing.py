"""Ported from src/lib/sources/bing.ts"""

from __future__ import annotations

import httpx
from bs4 import BeautifulSoup
from urllib.parse import quote

from rate_limiter import search_limiter
from models import RawSearchResult

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)


async def search_bing(keyword: str) -> list[RawSearchResult]:
    await search_limiter.wait_for_slot()

    search_query = f'"{keyword}"' if " " in keyword else keyword
    url = (
        f"https://www.bing.com/search?q={quote(search_query)}"
        f"&setlang=zh-CN&count=10&filters={quote('ex1:\"ez2\"')}"
    )

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.get(
                url,
                headers={
                    "User-Agent": UA,
                    "Accept": "text/html,application/xhtml+xml",
                    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
                },
            )
        if res.status_code != 200:
            return []

        soup = BeautifulSoup(res.text, "html.parser")
        results: list[RawSearchResult] = []

        for el in soup.select("li.b_algo"):
            title_el = el.select_one("h2 a")
            if not title_el:
                continue
            title = title_el.get_text(strip=True)
            href = title_el.get("href") or ""
            caption = el.select_one(".b_caption p")
            snippet = caption.get_text(strip=True) if caption else ""
            if title and href:
                results.append(
                    {
                        "title": title,
                        "url": href,
                        "snippet": snippet,
                        "source_type": "bing",
                    }
                )

        return results[:8]
    except Exception as e:
        print(f"[bing] Search failed: {e}", flush=True)
        return []
