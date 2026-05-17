"""Ported from src/lib/sources/sogou.ts"""

from __future__ import annotations

import httpx
from bs4 import BeautifulSoup
from urllib.parse import quote

from models import RawSearchResult
from sources.bing import UA


async def search_sogou(keyword: str) -> list[RawSearchResult]:
    search_query = f'"{keyword}"' if " " in keyword else keyword
    url = f"https://www.sogou.com/web?query={quote(search_query)}&num=10"

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.get(
                url,
                headers={
                    "User-Agent": UA.replace("120", "124"),
                    "Accept": "text/html,application/xhtml+xml",
                    "Accept-Language": "zh-CN,zh;q=0.9",
                    "Referer": "https://www.sogou.com/",
                },
            )
        if res.status_code != 200:
            return []

        soup = BeautifulSoup(res.text, "html.parser")
        results: list[RawSearchResult] = []

        for el in soup.select(".vrwrap, .rb, .results .result"):
            title_el = el.select_one("h3 a, .vr-title a")
            if not title_el:
                continue
            title = title_el.get_text(strip=True)
            href = title_el.get("href") or ""
            snippet_el = el.select_one(".str-text, .ft, p")
            snippet = snippet_el.get_text(strip=True) if snippet_el else ""
            if title and href:
                full_url = href if href.startswith("http") else f"https://www.sogou.com{href}"
                results.append(
                    {
                        "title": title,
                        "url": full_url,
                        "snippet": snippet,
                        "source_type": "sogou",
                    }
                )

        return results[:8]
    except Exception as e:
        print(f"[sogou] Search failed: {e}", flush=True)
        return []
