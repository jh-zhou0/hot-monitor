import { NextRequest, NextResponse } from 'next/server';
import { getDb, getAll, getOne } from '@/lib/db';
import { Hotspot } from '@/types';

export async function GET(req: NextRequest) {
  await getDb();
  const { searchParams } = new URL(req.url);

  const limit = Number(searchParams.get('limit') || '60');
  const offset = Number(searchParams.get('offset') || '0');
  const sourceType = searchParams.get('source_type');
  const minScore = searchParams.get('min_score');
  const keywordId = searchParams.get('keyword_id');
  const since = searchParams.get('since');
  const search = searchParams.get('search');

  let sql = 'SELECT * FROM hotspots WHERE 1=1';
  const params: unknown[] = [];

  if (sourceType) { sql += ' AND source_type = ?'; params.push(sourceType); }
  if (minScore)   { sql += ' AND ai_score >= ?';   params.push(Number(minScore)); }
  if (keywordId)  { sql += ' AND keyword_id = ?';  params.push(Number(keywordId)); }
  if (since)      { sql += ' AND discovered_at >= ?'; params.push(since); }
  if (search)     { sql += ' AND (title LIKE ? OR summary LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }

  sql += ' ORDER BY ai_score DESC, discovered_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const hotspots = getAll<Hotspot>(sql, params);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayStr = todayStart.toISOString();

  const totalCount   = getOne<{ count: number }>('SELECT COUNT(*) as count FROM hotspots');
  const todayCount   = getOne<{ count: number }>('SELECT COUNT(*) as count FROM hotspots WHERE discovered_at >= ?', [todayStr]);
  const urgentCount  = getOne<{ count: number }>('SELECT COUNT(*) as count FROM hotspots WHERE ai_score >= 80');
  const keywordCount = getOne<{ count: number }>('SELECT COUNT(*) as count FROM keywords WHERE is_active = 1');

  return NextResponse.json({
    hotspots,
    stats: {
      total:    totalCount?.count   || 0,
      today:    todayCount?.count   || 0,
      urgent:   urgentCount?.count  || 0,
      keywords: keywordCount?.count || 0,
    },
  });
}
