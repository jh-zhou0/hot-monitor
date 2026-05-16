import { NextRequest, NextResponse } from 'next/server';
import { getDb, getAll, getOne } from '@/lib/db';
import { Hotspot } from '@/types';

export async function GET(req: NextRequest) {
  await getDb();
  const { searchParams } = new URL(req.url);

  const limit = Number(searchParams.get('limit') || '60');
  const offset = Number(searchParams.get('offset') || '0');

  // --- 筛选参数 ---
  const sourceType = searchParams.get('source_type');
  const minScore = searchParams.get('min_score');
  const maxScore = searchParams.get('max_score');
  const keywordId = searchParams.get('keyword_id');
  const keywordCategory = searchParams.get('keyword_category');
  const activeKeywordsOnly = searchParams.get('active_keywords_only');
  const search = searchParams.get('search');

  // 时间范围：time_range = '1h' | '6h' | '24h' | '3d' | '7d' | 'custom'
  // 自定义时使用 since / until 参数
  // time_field: 'discovered_at' | 'published_at'
  const timeRange = searchParams.get('time_range');
  const since = searchParams.get('since');
  const until = searchParams.get('until');
  const timeField = searchParams.get('time_field') || 'discovered_at';
  const timeColumn = timeField === 'published_at' ? 'h.published_at' : 'h.discovered_at';

  // --- 排序参数 ---
  // sort_by: 'score' | 'discovered_at' | 'published_at' | 'source_type' | 'keyword_id'
  // sort_order: 'asc' | 'desc'
  const sortBy = searchParams.get('sort_by') || 'score';
  const sortOrder = searchParams.get('sort_order') || 'desc';

  // --- 构建 WHERE ---
  let sql = 'SELECT h.* FROM hotspots h WHERE 1=1';
  const params: unknown[] = [];

  // 来源筛选
  if (sourceType && sourceType !== 'all') {
    sql += ' AND h.source_type = ?';
    params.push(sourceType);
  }

  // 评分区间（双滑块）
  if (minScore) {
    sql += ' AND h.ai_score >= ?';
    params.push(Number(minScore));
  }
  if (maxScore) {
    sql += ' AND h.ai_score <= ?';
    params.push(Number(maxScore));
  }

  // 关键词 ID 筛选（单个或逗号分隔多个）
  if (keywordId) {
    const ids = keywordId.split(',').map(Number).filter(n => !isNaN(n));
    if (ids.length === 1) {
      sql += ' AND h.keyword_id = ?';
      params.push(ids[0]);
    } else if (ids.length > 1) {
      sql += ` AND h.keyword_id IN (${ids.map(() => '?').join(',')})`;
      params.push(...ids);
    }
  }

  // 关键词分类筛选（通过 JOIN keywords 表）
  if (keywordCategory) {
    sql += ' AND h.keyword_id IN (SELECT id FROM keywords WHERE category = ?)';
    params.push(keywordCategory);
  }

  // 只显示活跃关键词对应的热点
  if (activeKeywordsOnly === '1') {
    sql += ' AND h.keyword_id IN (SELECT id FROM keywords WHERE is_active = 1)';
  }

  // 时间范围（支持按 discovered_at 或 published_at）
  if (timeRange && timeRange !== 'all') {
    if (timeRange === 'custom') {
      if (since) { sql += ` AND ${timeColumn} >= ?`; params.push(since); }
      if (until) { sql += ` AND ${timeColumn} <= ?`; params.push(until); }
    } else {
      const unit = timeRange.slice(-1); // 'h' or 'd'
      const value = parseInt(timeRange);
      const now = new Date();
      if (unit === 'h') {
        now.setHours(now.getHours() - value);
      } else {
        now.setDate(now.getDate() - value);
      }
      sql += ` AND ${timeColumn} >= ?`;
      params.push(now.toISOString());
    }
  }

  // 关键词搜索
  if (search) {
    sql += ' AND (h.title LIKE ? OR h.summary LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  // --- 构建 ORDER BY ---
  const sortMap: Record<string, string> = {
    'score': 'h.ai_score',
    'discovered_at': 'h.discovered_at',
    'published_at': 'h.published_at',
    'source_type': 'h.source_type',
    'keyword_id': 'h.keyword_id',
  };
  const sortColumn = sortMap[sortBy] || 'h.ai_score';
  const order = sortOrder === 'asc' ? 'ASC' : 'DESC';
  const secondaryOrder = sortColumn === 'h.ai_score' ? 'h.discovered_at DESC' : 'h.ai_score DESC';
  sql += ` ORDER BY ${sortColumn} ${order}, ${secondaryOrder}`;

  // --- LIMIT / OFFSET ---
  sql += ' LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const hotspots = getAll<Hotspot>(sql, params);

  // --- 统计 ---
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayStr = todayStart.toISOString();

  // 统计（未过滤前 + 过滤后的匹配总数用于分页）
  const totalCount   = getOne<{ count: number }>('SELECT COUNT(*) as count FROM hotspots');
  const todayCount   = getOne<{ count: number }>('SELECT COUNT(*) as count FROM hotspots WHERE discovered_at >= ?', [todayStr]);
  const urgentCount  = getOne<{ count: number }>('SELECT COUNT(*) as count FROM hotspots WHERE ai_score >= 80');
  const keywordCount = getOne<{ count: number }>('SELECT COUNT(*) as count FROM keywords WHERE is_active = 1');

  // 获取过滤后的匹配总数（用于分页）
  let countSql = 'SELECT COUNT(*) as count FROM hotspots h WHERE 1=1';
  // 复用同样的 WHERE 条件（不含 LIMIT/OFFSET）
  const countParams: unknown[] = [];
  // 复制筛选条件（不含 ORDER BY / LIMIT / OFFSET）
  // 提取 WHERE 子句部分：从 "SELECT h.* FROM hotspots h WHERE 1=1" 之后到 ORDER BY 之前
  const whereClause = sql.substring(sql.indexOf('WHERE 1=1') + 10, sql.lastIndexOf(' ORDER BY'));
  if (whereClause.trim()) {
    countSql += whereClause;
    // params 中前几个是 WHERE 参数（不含 LIMIT/OFFSET）
    countParams.push(...params.slice(0, params.length - 2));
  }
  const filteredCount = getOne<{ count: number }>(countSql, countParams);

  return NextResponse.json({
    hotspots,
    stats: {
      total:    totalCount?.count   || 0,
      today:    todayCount?.count   || 0,
      urgent:   urgentCount?.count  || 0,
      keywords: keywordCount?.count || 0,
      filtered: filteredCount?.count || 0,
    },
  });
}