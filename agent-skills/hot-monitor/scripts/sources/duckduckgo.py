"""Ported from src/lib/sources/duckduckgo.ts"""

from __future__ import annotations

import httpx
from bs4 import BeautifulSoup
from urllib.parse import quote

from rate_limiter import search_limiter
from models import RawSearchResult
from sources.bing import UA


async def search_duckduckgo(keyword: str) -> list[RawSearchResult]:
    await search_limiter.wait_for_slot()

    search_query = f'"{keyword}"' if " " in keyword else keyword
    url = f"https://html.duckduckgo.com/html/?q={quote(search_query)}&df=w"

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            res = await client.get(
                url,
                headers={"User-Agent": UA, "Accept": "text/html"},
            )
        if res.status_code != 200:
            return []

        soup = BeautifulSoup(res.text, "html.parser")
        results: list[RawSearchResult] = []

        for el in soup.select(".result"):
            title_el = el.select_one(".result__title a")
            if not title_el:
                continue
            title = title_el.get_text(strip=True)
            href = title_el.get("href") or ""
            snippet_el = el.select_one(".result__snippet")
            snippet = snippet_el.get_text(strip=True) if snippet_el else ""
            if title and href:
                if href.startswith("//"):
                    href = f"https:{href}"
                results.append(
                    {
                        "title": title,
                        "url": href,
                        "snippet": snippet,
                        "source_type": "duckduckgo",
                    }
                )

        return results[:8]
    except Exception as e:
        print(f"[duckduckgo] Search failed: {e}", flush=True)
        return []
