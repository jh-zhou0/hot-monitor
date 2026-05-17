"""Ported from src/lib/sources/weibo.ts"""

from __future__ import annotations

from datetime import datetime, timedelta
from urllib.parse import quote

import httpx
from bs4 import BeautifulSoup

from models import RawSearchResult
from sources.bing import UA

WEIBO_UA = UA.replace("120", "124")


async def get_weibo_hot_search(keyword: str) -> list[RawSearchResult]:
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            res = await client.get(
                "https://weibo.com/ajax/side/hotSearch",
                headers={
                    "User-Agent": WEIBO_UA,
                    "Accept": "application/json",
                    "Referer": "https://weibo.com/",
                },
            )
        if res.status_code != 200:
            return []

        data = res.json()
        hot_list = (data.get("data") or {}).get("realtime") or []
        keyword_lower = keyword.lower()

        filtered = [
            item
            for item in hot_list
            if keyword_lower in (item.get("word") or "").lower()
            or keyword_lower in (item.get("note") or "").lower()
        ]
        if not filtered:
            return []

        now = datetime.utcnow().isoformat() + "Z"
        results: list[RawSearchResult] = []
        for item in filtered:
            word = item.get("word") or ""
            if not word:
                continue
            results.append(
                {
                    "title": word,
                    "url": f"https://s.weibo.com/weibo?q={quote(word)}",
                    "snippet": item.get("note") or f"微博热搜 · 热度 {item.get('num') or 0}",
                    "source_type": "weibo",
                    "published_at": now,
                }
            )
        return results
    except Exception as e:
        print(f"[weibo] Hot search failed: {e}", flush=True)
        return []


async def search_weibo(keyword: str) -> list[RawSearchResult]:
    try:
        today = datetime.utcnow().strftime("%Y-%m-%d")
        yesterday = (datetime.utcnow() - timedelta(days=1)).strftime("%Y-%m-%d")
        url = (
            f"https://s.weibo.com/weibo?q={quote(keyword)}"
            f"&typeall=1&suball=1&timescope=custom:{yesterday}:{today}&Refer=g"
        )

        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.get(
                url,
                headers={
                    "User-Agent": WEIBO_UA,
                    "Accept": "text/html",
                    "Referer": "https://weibo.com/",
                },
            )
        if res.status_code != 200:
            return []

        soup = BeautifulSoup(res.text, "html.parser")
        results: list[RawSearchResult] = []

        for el in soup.select('.card-wrap[action-type="feed_list_item"]'):
            text_el = el.select_one(".txt")
            text = " ".join(text_el.get_text().split()) if text_el else ""
            user_el = el.select_one(".name")
            author = user_el.get_text(strip=True) if user_el else ""
            time_el = el.select_one(".from a")
            time_str = time_el.get_text(strip=True) if time_el else ""
            href = (time_el.get("href") if time_el else "") or ""

            if text and len(text) > 10:
                title = text[:80] + ("..." if len(text) > 80 else "")
                full_url = href if href.startswith("http") else f"https:{href}"
                results.append(
                    {
                        "title": title,
                        "url": full_url,
                        "snippet": text,
                        "source_type": "weibo",
                        "author": author,
                        "published_at": time_str,
                    }
                )

        return results[:8]
    except Exception as e:
        print(f"[weibo] Search failed: {e}", flush=True)
        return []
