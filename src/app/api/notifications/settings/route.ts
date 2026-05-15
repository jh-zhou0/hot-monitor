import { NextRequest, NextResponse } from 'next/server';
import { getDb, getOne, runQuery, insertAndGetId } from '@/lib/db';
import { NotificationSettings } from '@/types';

export async function GET() {
  await getDb();
  let settings = getOne<NotificationSettings>('SELECT * FROM notification_settings LIMIT 1');

  if (!settings) {
    insertAndGetId(
      'INSERT INTO notification_settings (min_score, push_enabled, email_enabled) VALUES (?, ?, ?)',
      [60, 1, 0]
    );
    settings = getOne<NotificationSettings>('SELECT * FROM notification_settings LIMIT 1');
  }

  return NextResponse.json({ settings });
}

export async function PUT(req: NextRequest) {
  await getDb();
  const body = await req.json();
  const { email, min_score, push_enabled, email_enabled, quiet_hours_start, quiet_hours_end } = body;

  let settings = getOne<NotificationSettings>('SELECT * FROM notification_settings LIMIT 1');
  if (!settings) {
    insertAndGetId(
      'INSERT INTO notification_settings (min_score, push_enabled, email_enabled) VALUES (?, ?, ?)',
      [60, 1, 0]
    );
  }

  const updates: string[] = [];
  const params: unknown[] = [];

  if (email !== undefined) { updates.push('email = ?'); params.push(email); }
  if (min_score !== undefined) { updates.push('min_score = ?'); params.push(min_score); }
  if (push_enabled !== undefined) { updates.push('push_enabled = ?'); params.push(push_enabled); }
  if (email_enabled !== undefined) { updates.push('email_enabled = ?'); params.push(email_enabled); }
  if (quiet_hours_start !== undefined) { updates.push('quiet_hours_start = ?'); params.push(quiet_hours_start); }
  if (quiet_hours_end !== undefined) { updates.push('quiet_hours_end = ?'); params.push(quiet_hours_end); }

  if (updates.length > 0) {
    runQuery(`UPDATE notification_settings SET ${updates.join(', ')} WHERE id = 1`, params);
  }

  return NextResponse.json({ success: true });
}
