# 数据源说明

与 Web 版 `src/lib/sources/` 对齐，Python 实现位于 `scripts/sources/`。

| 来源 | source_type | 需要 Key | 说明 |
|------|-------------|----------|------|
| Bing | `bing` | 否 | 国内可用，主力 |
| DuckDuckGo | `duckduckgo` | 否 | 可能超时，失败自动跳过 |
| Google | `google` | 否 | 可能需代理，失败自动跳过 |
| 搜狗 | `sogou` | 否 | 国内可用 |
| Hacker News | `hackernews` | 否 | Algolia API，免费 |
| 微博 | `weibo` | 否 | 热搜 + 关键词搜索 |
| Twitter/X | `twitter` | 可选 `TWITTER_API_KEY` | 未配置则跳过 |

## 频率控制

| 类型 | 限制 | 实现 |
|------|------|------|
| 搜索引擎（Bing/DDG/Google/搜狗） | ≤2 次/分钟 | `search_limiter` |
| Twitter | ≤5 次/分钟 | `twitter_limiter` |

## 后处理（aggregator）

1. **并发采集**：8 个任务（微博热搜 + 微博搜索各一），`asyncio.gather(..., return_exceptions=True)`
2. **去重**：标题归一化 + URL 归一化（去 utm、www、尾斜杠）
3. **日期过滤**：无 `published_at` 保留；有则仅保留 7 天内
4. **相关性过滤**：多词关键词需全部匹配（≤2 词）或 n-1 匹配（>2 词）

## 采集命令

```bash
cd agent-skills/hot-monitor/scripts
pip install -r requirements.txt
python collect.py "你的关键词" --pretty
```

**输出**：仅 **stdout** JSON，不写项目内文件。stderr 为各源日志（失败、跳过 Twitter 等）。

## 与 Web 版的差异

| 能力 | Web 版 | Agent Skill |
|------|--------|-------------|
| 采集 | ✅ | ✅（本脚本） |
| AI 分析 | OpenRouter | **当前 Claude** |
| 持久化 | SQLite | 无（会话内简报） |
| 实时推送 | Socket.IO | 无 |
