# AI 热点监控系统 - 技术方案

## 技术选型

| 维度 | 选择 | 版本 | 理由 |
|------|------|------|------|
| 框架 | Next.js (App Router) | v15+ | 全栈一体，API Routes + SSR |
| 样式 | Tailwind CSS | v4 | 零运行时，v4 用 CSS @theme 配置 |
| 数据库 | sql.js | v1.14+ | 纯JS实现SQLite，无需编译原生模块 |
| 数据源 | 搜索引擎爬虫 + twitterapi.io | - | 多源聚合 |
| AI | OpenRouter | - | 统一入口，灵活切换模型 |
| 实时推送 | Socket.IO | v4.8+ | WebSocket实时推送，后端发现热点主动通知前端 |
| 邮件 | nodemailer | v8+ | Node.js 标准邮件库 |
| 定时 | node-cron | v4+ | 内嵌进程，轻量 |
| HTML解析 | cheerio | v1.0+ | 轻量DOM解析 |
| 运行时 | tsx | v4+ | 直接运行 TypeScript 自定义 server |

## API 对接规范（基于最新文档）

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

### Socket.IO 实时推送

```typescript
// server.ts - 自定义 server 同时启动 Next.js 和 Socket.IO
import { createServer } from 'http';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';

const httpServer = createServer(handler);
const io = new SocketIOServer(httpServer, { path: '/api/socketio' });

// 全局存储 io 实例供 API routes 使用
(global as any).__socketIO = io;

// 后端发现热点时主动推送:
io.emit('new-hotspot', { title, summary, score, sourceType, sourceUrl });

// 前端通过 socket.io-client 监听:
const socket = io({ path: '/api/socketio' });
socket.on('new-hotspot', (data) => { /* 弹出通知 */ });
```

## Tailwind CSS v4 配置方式

v4 不再使用 `tailwind.config.js`，改为在 CSS 中用 `@theme` 定义：

```css
@import "tailwindcss";

@custom-variant dark (&:where(.dark, .dark *));

@theme {
  --color-bg-primary: #0a0a0f;
  --color-bg-secondary: #12121a;
  --color-neon-cyan: #00f5ff;
  --color-neon-magenta: #ff00ff;
  --color-neon-green: #00ff88;
  --color-neon-red: #ff3366;
  --font-display: "Orbitron", sans-serif;
  --font-mono: "JetBrains Mono", monospace;
}
```

安装命令: `npm install tailwindcss @tailwindcss/postcss postcss`

## sql.js 使用方式（纯JS SQLite，无需编译原生模块）

```typescript
import initSqlJs from 'sql.js';
import fs from 'fs';

const SQL = await initSqlJs();
const buffer = fs.existsSync(DB_PATH) ? fs.readFileSync(DB_PATH) : null;
const db = buffer ? new SQL.Database(buffer) : new SQL.Database();
db.run('PRAGMA journal_mode = WAL');

// 建表
db.run(SCHEMA);

// 查询
const stmt = db.prepare('SELECT * FROM hotspots WHERE ai_score >= ?');
stmt.bind([60]);
while (stmt.step()) { const row = stmt.getAsObject(); }
stmt.free();

// 持久化（sql.js 是内存数据库，需手动写入文件）
const data = db.export();
fs.writeFileSync(DB_PATH, Buffer.from(data));
```

## Next.js instrumentation（定时任务启动点）

```typescript
// src/instrumentation.ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // 在服务端启动时初始化 node-cron 定时任务
    const { initScheduler } = await import('./lib/scheduler');
    initScheduler();
  }
}
```

## 数据库 Schema

```sql
CREATE TABLE keywords (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  keyword TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  is_active INTEGER DEFAULT 1,
  check_interval INTEGER DEFAULT 30,
  last_checked_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE hotspots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  summary TEXT,
  source_type TEXT NOT NULL,
  source_url TEXT,
  source_author TEXT,
  raw_content TEXT,
  ai_score REAL DEFAULT 0,
  ai_verified INTEGER DEFAULT 0,
  ai_analysis TEXT,
  keyword_id INTEGER,
  is_notified INTEGER DEFAULT 0,
  published_at TEXT,
  discovered_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (keyword_id) REFERENCES keywords(id)
);

CREATE TABLE notification_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT,
  min_score REAL DEFAULT 60,
  push_enabled INTEGER DEFAULT 1,
  email_enabled INTEGER DEFAULT 0,
  quiet_hours_start TEXT,
  quiet_hours_end TEXT
);
```

## 项目结构

```
hot-monitor/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── globals.css
│   │   ├── keywords/page.tsx
│   │   ├── settings/page.tsx
│   │   └── api/
│   │       ├── keywords/route.ts
│   │       ├── hotspots/route.ts
│   │       ├── monitor/trigger/route.ts
│   │       └── notifications/
│   │           ├── subscribe/route.ts
│   │           └── settings/route.ts
│   ├── lib/
│   │   ├── db/index.ts
│   │   ├── db/schema.ts
│   │   ├── sources/web-search.ts
│   │   ├── sources/twitter.ts
│   │   ├── sources/aggregator.ts
│   │   ├── ai/openrouter.ts
│   │   ├── ai/analyzer.ts
│   │   ├── ai/prompts.ts
│   │   ├── notifications/socket.ts
│   │   ├── notifications/email.ts
│   │   ├── scheduler/index.ts
│   │   └── utils/rate-limiter.ts
│   ├── components/
│   │   ├── ui/cyber-card.tsx
│   │   ├── ui/cyber-button.tsx
│   │   ├── ui/cyber-input.tsx
│   │   ├── ui/neon-text.tsx
│   │   ├── ui/particle-bg.tsx
│   │   ├── hotspot-feed.tsx
│   │   ├── hotspot-card.tsx
│   │   ├── keyword-manager.tsx
│   │   └── nav-bar.tsx
│   ├── types/index.ts
│   └── instrumentation.ts
├── server.ts                   # 自定义 server（Next.js + Socket.IO）
├── data/
├── docs/
├── .env.local
├── postcss.config.mjs
├── next.config.ts
└── package.json
```

## 频率控制策略

| 数据源 | 限制 | 实现 |
|--------|------|------|
| 搜索引擎爬虫 | 每关键词间隔 ≥ 30s，总体 ≤ 2次/分 | 令牌桶 |
| twitterapi.io | 遵循其 rate limit | 响应头检测 |
| OpenRouter | 最多 3 并发 | 信号量 |

## 环境变量

```env
# OpenRouter
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=anthropic/claude-sonnet-4-6

# Twitter (twitterapi.io)
TWITTER_API_KEY=...

# Email (可选)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
NOTIFY_EMAIL=kayson@example.com

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```
