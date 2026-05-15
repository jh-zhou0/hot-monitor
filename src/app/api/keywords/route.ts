import { NextRequest, NextResponse } from 'next/server';
import { getDb, getAll, insertAndGetId, runQuery } from '@/lib/db';
import { Keyword } from '@/types';

export async function GET() {
  await getDb();
  const keywords = getAll<Keyword>('SELECT * FROM keywords ORDER BY created_at DESC');
  return NextResponse.json({ keywords });
}

export async function POST(req: NextRequest) {
  await getDb();
  const body = await req.json();
  const { keyword, category = 'general', check_interval = 60 } = body;

  if (!keyword || typeof keyword !== 'string' || keyword.trim().length === 0) {
    return NextResponse.json({ error: '关键词不能为空' }, { status: 400 });
  }

  const id = insertAndGetId(
    'INSERT INTO keywords (keyword, category, check_interval) VALUES (?, ?, ?)',
    [keyword.trim(), category, check_interval]
  );

  return NextResponse.json({ id, keyword: keyword.trim(), category, check_interval }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  await getDb();
  const body = await req.json();
  const { id, keyword, category, check_interval, is_active } = body;

  if (!id) {
    return NextResponse.json({ error: '缺少 id' }, { status: 400 });
  }

  const updates: string[] = [];
  const params: unknown[] = [];

  if (keyword !== undefined) { updates.push('keyword = ?'); params.push(keyword); }
  if (category !== undefined) { updates.push('category = ?'); params.push(category); }
  if (check_interval !== undefined) { updates.push('check_interval = ?'); params.push(check_interval); }
  if (is_active !== undefined) { updates.push('is_active = ?'); params.push(is_active); }

  if (updates.length === 0) {
    return NextResponse.json({ error: '没有要更新的字段' }, { status: 400 });
  }

  params.push(id);
  runQuery(`UPDATE keywords SET ${updates.join(', ')} WHERE id = ?`, params);

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  await getDb();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: '缺少 id' }, { status: 400 });
  }

  runQuery('DELETE FROM keywords WHERE id = ?', [Number(id)]);
  return NextResponse.json({ success: true });
}
