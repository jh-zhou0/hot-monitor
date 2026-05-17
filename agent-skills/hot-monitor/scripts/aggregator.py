"""Ported from src/lib/sources/aggregator.ts"""

from __future__ import annotations

import asyncio
import re
from datetime import datetime, timedelta, timezone
from urllib.parse import unquote

from models import RawSearchResult
from sources import (
    get_hackernews_top,
    get_weibo_hot_search,
    search_bing,
    search_duckduckgo,
    search_google,
    search_sogou,
    search_twitter,
    search_weibo,
)


async def aggregate_search(keyword: str) -> list[RawSearchResult]:
    tasks = [
        search_bing(keyword),
        search_duckduckgo(keyword),
        search_google(keyword),
        search_sogou(keyword),
        get_hackernews_top(keyword),
        get_weibo_hot_search(keyword),
        search_weibo(keyword),
        search_twitter(keyword),
    ]
    settled = await asyncio.gather(*tasks, return_exceptions=True)

    all_results: list[RawSearchResult] = []
    for task in settled:
        if isinstance(task, Exception):
            print(f"[aggregator] source failed: {task}", flush=True)
            continue
        all_results.extend(task)

    deduped = _deduplicate_results(all_results)
    date_filtered = _filter_by_date(deduped)
    return _filter_by_relevance(date_filtered, keyword)


def _deduplicate_results(results: list[RawSearchResult]) -> list[RawSearchResult]:
    seen_by_title: dict[str, RawSearchResult] = {}
    seen_by_url: dict[str, RawSearchResult] = {}

    for r in results:
        title_key = _normalize_for_dedup(r.get("title") or "")
        url_key = _normalize_url(r.get("url") or "")

        if (title_key and title_key in seen_by_title) or (url_key and url_key in seen_by_url):
            continue

        if title_key:
            seen_by_title[title_key] = r
        if url_key:
            seen_by_url[url_key] = r

    result_map: dict[str, RawSearchResult] = {}
    for r in seen_by_title.values():
        url = r.get("url") or ""
        if url:
            result_map[url] = r
    for r in seen_by_url.values():
        url = r.get("url") or ""
        if url:
            result_map[url] = r

    return list(result_map.values())


def _normalize_for_dedup(text: str) -> str:
    lowered = text.lower()
    cleaned = re.sub(r"[^\w\u4e00-\u9fff]", "", lowered)
    return cleaned[:50]


def _normalize_url(url: str) -> str:
    try:
        normalized = url.lower().strip()
        normalized = re.sub(r"^https?://", "", normalized)
        normalized = re.sub(r"^www\.", "", normalized)
        normalized = re.sub(r"/+$", "", normalized)
        normalized = re.sub(
            r"[?&](utm_[^&=]+|fbclid|gclid|ref|source)=[^&]+", "", normalized
        )
        normalized = re.sub(r"#.*$", "", normalized)
        return unquote(normalized)
    except Exception:
        return ""


def _filter_by_date(results: list[RawSearchResult]) -> list[RawSearchResult]:
    seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
    filtered: list[RawSearchResult] = []

    for r in results:
        pub = r.get("published_at")
        if not pub:
            filtered.append(r)
            continue
        try:
            pub_date = datetime.fromisoformat(pub.replace("Z", "+00:00"))
            if pub_date.tzinfo is None:
                pub_date = pub_date.replace(tzinfo=timezone.utc)
        except ValueError:
            filtered.append(r)
            continue
        if pub_date >= seven_days_ago:
            filtered.append(r)

    return filtered


def _filter_by_relevance(results: list[RawSearchResult], keyword: str) -> list[RawSearchResult]:
    terms = [t for t in keyword.lower().split() if t]
    if not terms:
        return results

    filtered: list[RawSearchResult] = []
    for r in results:
        text = f"{r.get('title', '')} {r.get('snippet', '')}".lower()
        matched = sum(1 for term in terms if _term_matches(text, term))
        if len(terms) <= 2:
            if matched == len(terms):
                filtered.append(r)
        elif matched >= len(terms) - 1:
            filtered.append(r)

    return filtered


def _term_matches(text: str, term: str) -> bool:
    if term.isdigit():
        return bool(re.search(rf"(?<!\d\.){re.escape(term)}\b", text))
    return term in text
