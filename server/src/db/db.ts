/**
 * DayFlow Database Client
 * Connects directly to PostgreSQL server on host port 5433
 */
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const DB_PORT = parseInt(process.env.DB_PORT || '5433', 10);
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_NAME = process.env.DB_NAME || 'dayflow_db';
const DB_USER = process.env.DB_USER || 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD || 'postgres';

// PostgreSQL Connection Pool
export const pool = new Pool({
  host: DB_HOST,
  port: DB_PORT,
  database: DB_NAME,
  user: DB_USER,
  password: DB_PASSWORD,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 3000,
});

// Test PostgreSQL Connection
pool.connect((err, client, release) => {
  if (err) {
    console.error(`❌ Connection error to PostgreSQL Database at ${DB_HOST}:${DB_PORT}:`, err.message);
  } else {
    console.log(`✅ Connected directly to PostgreSQL Database ('${DB_NAME}' on ${DB_HOST}:${DB_PORT})!`);
    release();
  }
});

// In-Memory Database Store Fallback
const MEMORY_DB: {
  users: any[];
  scheduleWeeks: Record<string, any>;
  habitLogs: Record<string, any[]>;
  todos: Record<string, any[]>;
} = {
  users: [],
  scheduleWeeks: {},
  habitLogs: {},
  todos: {}
};

export async function executeQuery(text: string, params: any[] = []) {
  try {
    return await pool.query(text, params);
  } catch (e: any) {
    console.error('❌ PostgreSQL Query Error:', e.message);
    return { rows: [] };
  }
}

export const memoryStore = MEMORY_DB;
