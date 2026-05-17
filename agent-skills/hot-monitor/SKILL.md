---
name: hot-monitor
description: >-
  Self-contained AI hotspot monitoring skill (hot-monitor): multi-source scraping from
  Bing, DuckDuckGo, Google, Sogou, Hacker News, Weibo, optional Twitter, with dedup and
  relevance filters; Claude scores genuineness 0-100. No server, database, or OpenRouter.
  Must use when the user mentions 热点工具, AI热点, 搜索热点, 热点雷达, 热点监控, 行业热点,
  盯热点, 搜热点, 热点简报, 多源热点, 紧急热点, 大模型动态, AI行业动态, 关键词监控,
  hot-monitor, hotspot radar, or wants to find/track/score AI news (GPT, Claude, Cursor,
  OpenAI, Anthropic)—even if they do not name this skill or npm run dev.
---

# Hot Monitor（AI 热点监控 Agent Skill）

自包含的热点监控能力：Python 负责**采集与过滤**，你（Claude）负责**分析与简报**。不依赖本仓库 Next.js 服务、SQLite 或 OpenRouter。

## 何时使用

触发词示例（含但不限于）：

- **核心**：热点工具、AI热点、搜索热点
- **扩展**：热点雷达、热点监控、行业热点、盯热点、搜热点、热点简报、多源热点、紧急热点、大模型动态、AI 行业动态
- **场景**：监控某关键词（GPT、Claude、Cursor 等）、跑一轮采集、查最近高分/紧急热点、出 Markdown 简报
- **项目**：`hot-monitor`、`agent-skills`、`collect.py`

## 前置条件

1. 本机 Python 3.10+
2. 安装依赖（首次）：

```bash
cd agent-skills/hot-monitor/scripts
pip install -r requirements.txt
```

3. （可选）Twitter：`export TWITTER_API_KEY=...`，未设置则自动跳过

## 标准工作流

### 1. 采集（确定性，不调 LLM）

在项目根目录执行（路径按实际仓库调整）：

```bash
python agent-skills/hot-monitor/scripts/collect.py "关键词" --pretty
```

- 输出：**仅 stdout** 的 JSON（`keyword`, `count`, `by_source`, `results[]`）
- **不要**将采集 JSON 写入仓库内文件或长期文档
- stderr 可看各源成功/失败；单源失败不影响其他源

### 2. 分析（你来完成）

1. 阅读 `references/analysis-framework.md`
2. 将 `results` 分批（每批 ≤5 条）分析
3. 输出结构化 JSON（见 analysis-framework）+ 按 `references/report-template.md` 写中文简报

### 3. 交付物

- 给用户：**Markdown 简报**（含紧急/重要/已过滤）
- 可选：附分析 JSON 摘要，**不要**粘贴完整原始采集列表

## 多关键词

对每个词分别运行 `collect.py`，分别分析，再合并简报。

## 故障排查

| 现象 | 处理 |
|------|------|
| `count: 0` | 换关键词、检查网络；Google/DDG 在国内可能为空 |
| 仅有部分来源 | 正常降级，见 `by_source` |
| Twitter 无数据 | 未配置 Key 或 API 限流 |
| 依赖缺失 | `pip install -r requirements.txt` |

## 参考文件

| 文件 | 何时读 |
|------|--------|
| `references/analysis-framework.md` | 每次分析前 |
| `references/sources.md` | 解释来源、限流、与 Web 版差异 |
| `references/report-template.md` | 生成用户可见简报时 |

## 与 Web 应用的关系

仓库 `src/` 中的 Next.js 应用可独立运行（OpenRouter + DB + UI）。本 Skill **不修改、不依赖**该服务；爬虫逻辑从 `src/lib/sources/` 移植，由 `scripts/` 维护。

## 安装为 Cursor Skill（可选）

复制到个人技能目录后即可被 Cursor 发现：

```bash
cp -r agent-skills/hot-monitor ~/.cursor/skills/hot-monitor
```

或在 Cursor 设置中添加本仓库 `agent-skills/hot-monitor` 路径。
