import cron from 'node-cron';
import { getDb, getAll, saveDb } from '@/lib/db';
import { aggregateSearch } from '@/lib/sources/aggregator';
import { analyzeHotspots } from '@/lib/ai/analyzer';
import { emitHotspot } from '@/lib/notifications/socket';
import { sendEmailNotification, buildHotspotEmailHtml } from '@/lib/notifications/email';
import { Keyword, NotificationSettings } from '@/types';

let schedulerRunning = false;

export function initScheduler() {
  if (schedulerRunning) return;
  schedulerRunning = true;

  console.log('[scheduler] Starting cron job - every 60 minutes');

  cron.schedule('0 * * * *', async () => {
    console.log('[scheduler] Running scheduled check...');
    await runMonitorCycle();
  });
}

async function runMonitorCycle() {
  try {
    const db = await getDb();
    const keywords = getAll<Keyword>(
      'SELECT * FROM keywords WHERE is_active = 1'
    );

    if (keywords.length === 0) return;

    const settings = getAll<NotificationSettings>(
      'SELECT * FROM notification_settings LIMIT 1'
    )[0];
    const minScore = settings?.min_score || 60;

    for (const kw of keywords) {
      if (shouldSkip(kw)) continue;

      try {
        const rawResults = await aggregateSearch(kw.keyword);
        if (rawResults.length === 0) continue;

        const analysis = await analyzeHotspots(rawResults, kw.keyword);

        for (let i = 0; i < rawResults.length && i < analysis.length; i++) {
          const raw = rawResults[i];
          const ai = analysis[i];

          db.run(
            `INSERT INTO hotspots (title, summary, source_type, source_url, source_author, raw_content, ai_score, ai_verified, ai_analysis, keyword_id, published_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [raw.title, ai.summary, raw.source_type, raw.url, raw.author || null, raw.snippet, ai.score, ai.is_genuine ? 1 : -1, ai.analysis, kw.id, raw.published_at || null]
          );

          if (ai.score >= minScore && ai.is_genuine) {
            await notifyUser(raw.title, ai.summary, ai.score, raw.url, settings);
          }
        }

        db.run('UPDATE keywords SET last_checked_at = datetime(?) WHERE id = ?', [new Date().toISOString(), kw.id]);
        saveDb();
      } catch (e) {
        console.error(`[scheduler] Error processing "${kw.keyword}":`, e);
      }
    }
  } catch (e) {
    console.error('[scheduler] Cycle failed:', e);
  }
}

function shouldSkip(kw: Keyword): boolean {
  if (!kw.last_checked_at) return false;
  const lastCheck = new Date(kw.last_checked_at).getTime();
  const intervalMs = kw.check_interval * 60 * 1000;
  return Date.now() - lastCheck < intervalMs;
}

async function notifyUser(
  title: string,
  summary: string,
  score: number,
  url: string | undefined,
  settings?: NotificationSettings
) {
  if (isQuietHours(settings)) return;

  emitHotspot({
    title,
    summary,
    score,
    sourceType: 'monitor',
    sourceUrl: url,
  });

  if (settings?.email_enabled && settings.email) {
    const html = buildHotspotEmailHtml(title, summary, score, url);
    await sendEmailNotification(`⚡ AI热点: ${title}`, html);
  }
}

function isQuietHours(settings?: NotificationSettings): boolean {
  if (!settings?.quiet_hours_start || !settings?.quiet_hours_end) return false;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [startH, startM] = settings.quiet_hours_start.split(':').map(Number);
  const [endH, endM] = settings.quiet_hours_end.split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  }
  return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
}
