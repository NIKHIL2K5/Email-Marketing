import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

declare global {
  var pgPool: Pool | undefined;
  var pgPoolConnectionString: string | undefined;
}

import { isDocker } from '../runtime';

function getConnectionString(): string {
  if (process.env.DATABASE_URL) {
    let url = process.env.DATABASE_URL;
    if (isDocker()) {
      url = url.replace(/localhost:5433|127\.0\.0\.1:5433/g, 'postgres:5432');
      url = url.replace(/localhost:5432|127\.0\.0\.1:5432/g, 'postgres:5432');
    }
    return url;
  }
  const user = encodeURIComponent(process.env.PGUSER || 'emailapp');
  const password = encodeURIComponent(process.env.PGPASSWORD || '');
  let host = process.env.PGHOST || 'localhost';
  let port = process.env.PGPORT || '5432';
  if (isDocker()) {
    if (host === 'localhost' || host === '127.0.0.1') {
      host = 'postgres';
      port = '5432';
    }
  }
  const database = process.env.PGDATABASE || 'contacts';
  return `postgresql://${user}:${password}@${host}:${port}/${database}`;
}

export function getPool(): Pool {
  const connStr = getConnectionString();
  if (!globalThis.pgPool || globalThis.pgPoolConnectionString !== connStr) {
    if (globalThis.pgPool) {
      globalThis.pgPool.end().catch(() => {});
    }
    globalThis.pgPool = new Pool({
      connectionString: connStr,
      max: 30,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 15000,
    });
    globalThis.pgPoolConnectionString = connStr;
  }
  return globalThis.pgPool;
}

export const pool = getPool();

/**
 * Execute a parameterized query against PostgreSQL.
 * Parameterized queries prevent SQL injection by design.
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  const start = Date.now();
  const currentPool = getPool();
  try {
    const res = await currentPool.query<T>(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV === 'development' && duration > 500) {
      console.warn(`[db:slow-query] ${duration}ms: ${text.substring(0, 80)}...`);
    }
    return res;
  } catch (error) {
    console.error('[db:error]', error instanceof Error ? error.message : error);
    throw error;
  }
}

/**
 * Execute multiple database operations within a single atomic transaction.
 * Automatically commits on success and rolls back on error.
 */
export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const currentPool = getPool();
  const client = await currentPool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
