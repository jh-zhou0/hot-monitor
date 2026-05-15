import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import path from 'path';
import fs from 'fs';
import { SCHEMA } from './schema';

let db: SqlJsDatabase | null = null;
let initPromise: Promise<SqlJsDatabase> | null = null;

const DB_PATH = path.join(process.cwd(), 'data', 'hot-monitor.db');

export async function getDb(): Promise<SqlJsDatabase> {
  if (db) return db;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const wasmPath = path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
    const SQL = await initSqlJs({
      locateFile: () => wasmPath,
    });

    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (fs.existsSync(DB_PATH)) {
      const buffer = fs.readFileSync(DB_PATH);
      db = new SQL.Database(buffer);
    } else {
      db = new SQL.Database();
    }

    db.run('PRAGMA journal_mode = WAL');
    db.run(SCHEMA);
    // 迁移：旧的 web_search 统一改为 bing
    db.run(`UPDATE hotspots SET source_type = 'bing' WHERE source_type = 'web_search'`);
    saveDb();

    return db;
  })();

  return initPromise;
}

export function saveDb() {
  if (!db) return;
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

export function runQuery(sql: string, params: unknown[] = []) {
  if (!db) throw new Error('Database not initialized');
  db.run(sql, params as never[]);
  saveDb();
}

export function getAll<T>(sql: string, params: unknown[] = []): T[] {
  if (!db) throw new Error('Database not initialized');
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params as never[]);

  const results: T[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return results;
}

export function getOne<T>(sql: string, params: unknown[] = []): T | null {
  return getAll<T>(sql, params)[0] || null;
}

export function insertAndGetId(sql: string, params: unknown[] = []): number {
  if (!db) throw new Error('Database not initialized');
  db.run(sql, params as never[]);
  const result = db.exec('SELECT last_insert_rowid() as id');
  saveDb();
  return result[0]?.values[0]?.[0] as number;
}
