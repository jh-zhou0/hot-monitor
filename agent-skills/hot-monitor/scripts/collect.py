#!/usr/bin/env python3
"""
Multi-source hotspot collector for hot-monitor Agent Skill.
Outputs JSON to stdout only (no file writes).
Ported from hot-monitor src/lib/sources/* and aggregator.ts
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from aggregator import aggregate_search  # noqa: E402


async def _run(keyword: str) -> dict:
    results = await aggregate_search(keyword)
    by_source: dict[str, int] = {}
    for r in results:
        st = r.get("source_type") or "unknown"
        by_source[st] = by_source.get(st, 0) + 1

    return {
        "keyword": keyword,
        "count": len(results),
        "by_source": by_source,
        "results": results,
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Collect AI hotspot candidates from 7 sources (stdout JSON)."
    )
    parser.add_argument("keyword", help="Monitor keyword, e.g. Claude or GPT-5")
    parser.add_argument(
        "--pretty",
        action="store_true",
        help="Pretty-print JSON (default: compact)",
    )
    args = parser.parse_args()

    payload = asyncio.run(_run(args.keyword.strip()))
    indent = 2 if args.pretty else None
    print(json.dumps(payload, ensure_ascii=False, indent=indent))


if __name__ == "__main__":
    main()
