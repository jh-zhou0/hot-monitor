from __future__ import annotations

from typing import Literal, TypedDict

SourceType = Literal[
    "bing",
    "duckduckgo",
    "google",
    "sogou",
    "hackernews",
    "weibo",
    "twitter",
]


class RawSearchResult(TypedDict, total=False):
    title: str
    url: str
    snippet: str
    source_type: SourceType
    author: str
    published_at: str
