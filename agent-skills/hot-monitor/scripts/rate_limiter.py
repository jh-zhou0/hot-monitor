"""Ported from src/lib/utils/rate-limiter.ts"""

from __future__ import annotations

import asyncio
import time


class RateLimiter:
    def __init__(self, max_requests: int, window_ms: int) -> None:
        self.max_requests = max_requests
        self.window_ms = window_ms
        self.timestamps: list[float] = []

    async def wait_for_slot(self) -> None:
        while True:
            now = time.time() * 1000
            self.timestamps = [t for t in self.timestamps if now - t < self.window_ms]
            if len(self.timestamps) < self.max_requests:
                self.timestamps.append(now)
                return
            oldest = self.timestamps[0]
            wait_ms = self.window_ms - (now - oldest) + 100
            await asyncio.sleep(wait_ms / 1000)


search_limiter = RateLimiter(2, 60_000)
twitter_limiter = RateLimiter(5, 60_000)
