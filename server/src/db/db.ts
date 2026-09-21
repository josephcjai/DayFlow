/**
 * DayFlow Database Client
 * Connects directly to PostgreSQL server on host port 5433
 */
// cspell:words Millis conname
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const isProd = process.env.NODE_ENV === 'production';
const DB_PORT = parseInt(process.env.DB_PORT || '5433', 10);
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_NAME = process.env.DB_NAME || 'dayflow_db';
const DB_USER = process.env.DB_USER || 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD || 'postgres';
const DB_POOL_MAX = parseInt(process.env.DB_POOL_MAX || '10', 10);

const poolConfig: pg.PoolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DB_SSL === 'true' || isProd ? { rejectUnauthorized: false } : false,
      max: DB_POOL_MAX,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    }
  : {
      host: DB_HOST,
      port: DB_PORT,
      database: DB_NAME,
      user: DB_USER,
      password: DB_PASSWORD,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      max: DB_POOL_MAX,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    };

// PostgreSQL Connection Pool
export const pool = new Pool(poolConfig);

// Handle idle client errors gracefully to prevent process crash on DB restarts or network blips
pool.on('error', (err) => {
  console.error('⚠️ Unexpected error on idle PostgreSQL client pool:', err.message);
});

// Verify PostgreSQL Connection on Startup
pool.query('SELECT 1', (err) => {
  if (err) {
    console.error(`❌ Connection error to PostgreSQL Database at ${DB_HOST}:${DB_PORT}:`, err.message);
  } else {
    console.log(`✅ Connected directly to PostgreSQL Database ('${DB_NAME}' on ${DB_HOST}:${DB_PORT})!`);
  }
});

// In-Memory Database Store Fallback for local development without DB
const MEMORY_DB: {
  users: any[];
  scheduleWeeks: Record<string, any>;
  habitLogs: Record<string, any[]>;
  todos: Record<string, any[]>;
  passwordResetTokens: any[];
} = {
  users: [],
  scheduleWeeks: {},
  habitLogs: {},
  todos: {},
  passwordResetTokens: []
};

export async function executeQuery(text: string, params: any[] = []) {
  try {
    return await pool.query(text, params);
  } catch (e: any) {
    console.error('❌ PostgreSQL Query Error:', e.message);
    throw e;
  }
}

export const memoryStore = MEMORY_DB;
