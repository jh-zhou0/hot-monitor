import { NextRequest, NextResponse } from 'next/server';
import { getDb, getAll, insertAndGetId, saveDb } from '@/lib/db';
import { aggregateSearch } from '@/lib/sources/aggregator';
import { analyzeHotspots } from '@/lib/ai/analyzer';
import { emitHotspot } from '@/lib/notifications/socket';
import { Keyword } from '@/types';

export async function POST(req: NextRequest) {
  const db = await getDb();

  const body = await req.json().catch(() => ({}));
  const keywordId = body.keyword_id;

  let keywords: Keyword[];
  if (keywordId) {
    keywords = getAll<Keyword>('SELECT * FROM keywords WHERE id = ? AND is_active = 1', [keywordId]);
  } else {
    keywords = getAll<Keyword>('SELECT * FROM keywords WHERE is_active = 1');
  }

  if (keywords.length === 0) {
    return NextResponse.json({ message: '没有活跃的监控关键词', count: 0 });
  }

  let totalInserted = 0;
  const settings = getAll<{ min_score: number }>('SELECT min_score FROM notification_settings LIMIT 1')[0];
  const minScore = settings?.min_score ?? 60;

  for (const kw of keywords) {
    try {
      const rawResults = await aggregateSearch(kw.keyword);
      if (rawResults.length === 0) continue;

      const analysis = await analyzeHotspots(rawResults);

      for (let i = 0; i < rawResults.length && i < analysis.length; i++) {
        const raw = rawResults[i];
        const ai = analysis[i];

        insertAndGetId(
          `INSERT INTO hotspots (title, summary, source_type, source_url, source_author, raw_content, ai_score, ai_verified, ai_analysis, keyword_id, published_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            raw.title,
            ai.summary,
            raw.source_type,
            raw.url,
            raw.author || null,
            raw.snippet,
            ai.score,
            ai.is_genuine ? 1 : -1,
            ai.analysis,
            kw.id,
            raw.published_at || null,
          ]
        );
        totalInserted++;

        // 达到阈值立即通过 WebSocket 推送
        if (ai.score >= minScore && ai.is_genuine) {
          emitHotspot({
            title: raw.title,
            summary: ai.summary,
            score: ai.score,
            sourceType: raw.source_type,
            sourceUrl: raw.url,
          });
        }
      }

      db.run('UPDATE keywords SET last_checked_at = datetime(?) WHERE id = ?', [new Date().toISOString(), kw.id]);
      saveDb();
    } catch (e) {
      console.error(`[monitor] Failed to process keyword "${kw.keyword}":`, e);
    }
  }

  return NextResponse.json({ message: `采集完成`, count: totalInserted });
}
