import { NextResponse } from 'next/server';
import { getDb, runQuery } from '@/lib/db';

export async function DELETE() {
  await getDb();
  runQuery('DELETE FROM hotspots');
  return NextResponse.json({ success: true });
}
