import { NextRequest, NextResponse } from 'next/server';
import { getDb, insertAndGetId, runQuery } from '@/lib/db';

export async function POST(req: NextRequest) {
  await getDb();
  const body = await req.json();
  const { endpoint, keys } = body;

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: '无效的订阅数据' }, { status: 400 });
  }

  try {
    insertAndGetId(
      'INSERT OR REPLACE INTO push_subscriptions (endpoint, keys_p256dh, keys_auth) VALUES (?, ?, ?)',
      [endpoint, keys.p256dh, keys.auth]
    );
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[subscribe] Failed:', e);
    return NextResponse.json({ error: '订阅失败' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  await getDb();
  const body = await req.json();
  const { endpoint } = body;

  if (!endpoint) {
    return NextResponse.json({ error: '缺少 endpoint' }, { status: 400 });
  }

  runQuery('DELETE FROM push_subscriptions WHERE endpoint = ?', [endpoint]);
  return NextResponse.json({ success: true });
}
