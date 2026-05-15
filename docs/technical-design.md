# AI 热点监控系统 - 技术方案

## 技术选型

| 维度 | 选择 | 版本 | 理由 |
|------|------|------|------|
| 框架 | Next.js (App Router) | v15+ | 全栈一体，API Routes + SSR |
| 样式 | Tailwind CSS | v4 | 零运行时，v4 用 CSS @theme 配置 |
| 数据库 | sql.js | v1.14+ | 纯 JS 实现 SQLite，无需编译原生模块 |
| 数据源 | 7 个信息源爬虫 + twitterapi.io | - | 多源聚合，任意来源失败自动降级 |
| AI | OpenRouter | - | 统一入口，灵活切换模型 |
| 实时推送 | Socket.IO | v4.8+ | WebSocket 实时推送，后端发现热点主动通知前端 |
| 邮件 | nodemailer | v8+ | Node.js 标准邮件库 |
| 定时 | node-cron | v4+ | 内嵌进程，每 60 分钟自动采集 |
| HTML 解析 | cheerio | v1.0+ | 轻量 DOM 解析 |
| 运行时 | tsx | v4+ | 直接运行 TypeScript 自定义 server |

## API 对接规范

### OpenRouter API

```
端点: POST https://openrouter.ai/api/v1/chat/completions
认证: Authorization: Bearer <OPENROUTER_API_KEY>
请求体:
{
  "model": "anthropic/claude-sonnet-4-6",
  "messages": [
    { "role": "system", "content": "..." },
    { "role": "user", "content": "..." }
  ],
  "max_tokens": 1000,
  "temperature": 0.3
}
响应: data.choices[0].message.content
```

### twitterapi.io API

```
端点: GET https://api.twitterapi.io/twitter/tweet/advanced_search
认证: x-api-key: <TWITTER_API_KEY>
参数:
  - query: 搜索关键词
  - queryType: "Latest" | "Top"
  - cursor: 分页游标
响应: { tweets: [...], has_next_page, next_cursor }
```

### HackerNews Algolia API（免费，无需 key）

```
搜索: GET https://hn.algolia.com/api/v1/search_by_date?query=<keyword>&tags=(story,show_hn)
首页: GET https://hn.algolia.com/api/v1/search?query=<keyword>&tags=front_page
```

### Socket.IO 实时推送

```typescript
// server.ts - 自定义 server 同时启动 Next.js 和 Socket.IO
const io = new SocketIOServer(httpServer, { path: '/api/socketio' });
(global as Record<string, unknown>).__socketIO = io;

// 后端发现热点时主动推送
io.emit('new-hotspot', { title, summary, score, sourceType, sourceUrl });

// 前端监听
const socket = io({ path: '/api/socketio' });
socket.on('new-hotspot', (data) => { /* 更新通知面板 */ });
```

## Tailwind CSS v4 配置

v4 不再使用 `tailwind.config.js`，改为在 CSS 中用 `@theme` 定义：

```css
@import "tailwindcss";

@theme {
  --color-bg-primary: #0a0a0f;
  --color-bg-secondary: #12121a;
  --color-bg-card: #0f0f1a;
  --color-neon-cyan: #00f5ff;
  --color-neon-magenta: #ff00ff;
  --color-neon-yellow: #f5ff00;
  --color-neon-green: #00ff88;
  --color-neon-red: #ff3366;
  --color-text-primary: #e0e0e8;
  --color-text-muted: #666680;
  --color-text-dim: #3a3a50;
  --font-display: "Orbitron", sans-serif;
  --font-mono: "JetBrains Mono", monospace;
}
```

## 数据库 Schema

```sql
CREATE TABLE keywords (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  keyword TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  is_active INTEGER DEFAULT 1,
  check_interval INTEGER DEFAULT 60,   -- 单位：分钟
  last_checked_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE hotspots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  summary TEXT,                        -- AI 生成中文摘要
  source_type TEXT NOT NULL,           -- bing|duckduckgo|google|sogou|hackernews|weibo|twitter
  source_url TEXT,
  source_author TEXT,
  raw_content TEXT,
  ai_score REAL DEFAULT 0,            -- AI 评分 0-100（同时作为匹配度）
  ai_verified INTEGER DEFAULT 0,      -- 1=真实 -1=疑似假
  ai_analysis TEXT,                    -- AI 分析说明
  keyword_id INTEGER,
  is_notified INTEGER DEFAULT 0,
  published_at TEXT,
  discovered_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (keyword_id) REFERENCES keywords(id)
);

CREATE TABLE notification_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT,
  min_score REAL DEFAULT 60,          -- 推送阈值
  push_enabled INTEGER DEFAULT 1,
  email_enabled INTEGER DEFAULT 0,
  quiet_hours_start TEXT,
  quiet_hours_end TEXT
);
```

## 热点等级划分

| 等级 | 分数范围 | 颜色 | 说明 |
|------|----------|------|------|
| 高 | ≥ 80 | 黄色（neon-yellow） | 紧急热点，立即推送 |
| 中 | 50-79 | 青色（neon-cyan） | 重要热点 |
| 低 | < 50 | 灰色（text-muted） | 一般信息 |

## 项目结构

```
hot-monitor/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                  # 热点雷达首页
│   │   ├── globals.css               # 赛博朋克主题样式
│   │   ├── keywords/page.tsx         # 监控词管理
│   │   ├── settings/page.tsx         # 通知设置
│   │   └── api/
│   │       ├── keywords/route.ts
│   │       ├── hotspots/route.ts
│   │       ├── hotspots/clear/route.ts
│   │       ├── monitor/trigger/route.ts
│   │       └── notifications/
│   │           ├── subscribe/route.ts
│   │           └── settings/route.ts
│   ├── lib/
│   │   ├── db/
│   │   │   ├── index.ts              # sql.js 数据库连接
│   │   │   └── schema.ts             # 建表语句
│   │   ├── sources/
│   │   │   ├── bing.ts
│   │   │   ├── duckduckgo.ts
│   │   │   ├── google.ts
│   │   │   ├── sogou.ts
│   │   │   ├── hackernews.ts
│   │   │   ├── weibo.ts
│   │   │   ├── twitter.ts
│   │   │   └── aggregator.ts         # 多源聚合 + 去重
│   │   ├── ai/
│   │   │   ├── openrouter.ts         # OpenRouter 客户端
│   │   │   ├── analyzer.ts           # 热点分析流程
│   │   │   └── prompts.ts            # Prompt 模板
│   │   ├── notifications/
│   │   │   ├── socket.ts             # Socket.IO 推送
│   │   │   └── email.ts              # 邮件通知
│   │   ├── hooks/
│   │   │   └── use-socket.ts         # 前端 Socket.IO hook
│   │   ├── scheduler/
│   │   │   └── index.ts              # node-cron 定时任务
│   │   └── utils/
│   │       └── rate-limiter.ts       # 频率控制
│   ├── components/
│   │   ├── ui/
│   │   │   ├── cyber-card.tsx
│   │   │   ├── cyber-button.tsx
│   │   │   ├── cyber-input.tsx
│   │   │   ├── neon-text.tsx
│   │   │   └── particle-bg.tsx
│   │   ├── hotspot-card.tsx          # 热点卡片组件
│   │   └── nav-bar.tsx               # 导航栏（含采集按钮+通知面板）
│   ├── types/
│   │   ├── index.ts                  # 全局类型定义
│   │   └── sql.js.d.ts               # sql.js 类型声明
│   └── instrumentation.ts            # Next.js 启动钩子（初始化定时任务）
├── server.ts                         # 自定义 server（Next.js + Socket.IO）
├── data/                             # SQLite 数据库文件（gitignore）
├── docs/                             # 需求和技术文档
├── .env.example                      # 环境变量模板
├── postcss.config.mjs
├── next.config.ts
└── package.json
```

## 数据流

```
[手动触发 / 定时任务]
        │
        ▼
┌─────────────────────────────┐
│  aggregator.ts              │
│  并发调用 7 个数据源         │
│  bing / ddg / google /      │
│  sogou / hn / weibo / twitter│
└─────────────┬───────────────┘
              │ 原始数据（去重后）
              ▼
┌─────────────────────────────┐
│  ai/analyzer.ts             │
│  OpenRouter 批量分析         │
│  · 真伪识别                  │
│  · 评分 0-100               │
│  · 中文摘要生成              │
└─────────────┬───────────────┘
              │ 结构化热点
              ▼
┌─────────────────────────────┐
│  SQLite (sql.js)            │
│  持久化到 data/hot-monitor.db│
└──────┬──────────────────────┘
       │
  ┌────┴────┐
  ▼         ▼
Web UI   Socket.IO
(轮询)   (实时推送)
```

## 频率控制策略

| 数据源 | 限制 | 实现 |
|--------|------|------|
| 搜索引擎（Bing/DDG/Google/搜狗） | ≤ 2次/分钟 | RateLimiter 令牌桶 |
| twitterapi.io | 遵循响应头 rate limit | 自动降级 |
| OpenRouter | 最多 3 并发，10s 窗口 | RateLimiter 信号量 |

## 环境变量

```env
# OpenRouter AI（必填）
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=anthropic/claude-sonnet-4-6

# Twitter/X（可选）
TWITTER_API_KEY=your-twitterapi-io-key

# 邮件通知（可选）
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@email.com
SMTP_PASS=your-password
NOTIFY_EMAIL=notify@email.com

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```
