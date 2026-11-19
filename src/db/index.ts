import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool, type PoolConfig } from 'pg';
import * as schema from './schema.ts';

declare global {
  var _postgresPool: Pool | undefined;
}

function buildPoolConfig(): PoolConfig {
  const base: PoolConfig = {
    max: 10,
    connectionTimeoutMillis: 15000,
  };

  // Preferred for Render / Railway / Neon / Supabase: a single DATABASE_URL
  if (process.env.DATABASE_URL) {
    const needsSsl = process.env.DATABASE_SSL !== 'false';
    return {
      ...base,
      connectionString: process.env.DATABASE_URL,
      ssl: needsSsl ? { rejectUnauthorized: false } : false,
    };
  }

  // Fallback: Cloud SQL style variables (AI Studio)
  return {
    ...base,
    host: process.env.SQL_HOST,
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    database: process.env.SQL_DB_NAME,
  };
}

export const createPool = () => {
  if (!global._postgresPool) {
    global._postgresPool = new Pool(buildPoolConfig());

    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};

const pool = createPool();

export const db = drizzle(pool, { schema });
