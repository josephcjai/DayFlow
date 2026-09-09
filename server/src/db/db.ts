/**
 * DayFlow Database Client
 * Connects directly to PostgreSQL server on host port 5433
 */
// cspell:words Millis conname
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

// Handle idle client errors gracefully to prevent process crash on DB restarts or network blips
pool.on('error', (err) => {
  console.error('⚠️ Unexpected error on idle PostgreSQL client pool:', err.message);
});

// Test PostgreSQL Connection & Ensure Migrations
pool.connect(async (err, client, release) => {
  if (err || !client) {
    console.error(`❌ Connection error to PostgreSQL Database at ${DB_HOST}:${DB_PORT}:`, err ? err.message : 'No client available');
  } else {
    console.log(`✅ Connected directly to PostgreSQL Database ('${DB_NAME}' on ${DB_HOST}:${DB_PORT})!`);
    try {
      await client.query("ALTER TABLE schedule_weeks ADD COLUMN IF NOT EXISTS note_sheets JSONB DEFAULT '[]'::jsonb;");
      await client.query("ALTER TABLE todo_items ADD COLUMN IF NOT EXISTS due_date DATE;");
      await client.query("ALTER TABLE todo_items ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'Medium';");
      await client.query("ALTER TABLE todo_items ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'General';");
      await client.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_schedule_weeks_date_range') THEN
            ALTER TABLE schedule_weeks ADD CONSTRAINT check_schedule_weeks_date_range CHECK (start_date BETWEEN '1800-01-01' AND '2200-12-31');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_habit_logs_date_range') THEN
            ALTER TABLE habit_logs ADD CONSTRAINT check_habit_logs_date_range CHECK (week_start BETWEEN '1800-01-01' AND '2200-12-31');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_todo_items_date_range') THEN
            ALTER TABLE todo_items ADD CONSTRAINT check_todo_items_date_range CHECK (due_date IS NULL OR (due_date BETWEEN '1800-01-01' AND '2200-12-31'));
          END IF;
        END $$;
      `);
    } catch (migErr: any) {
      console.warn('PostgreSQL migration notice:', migErr.message);
    }
    release();
  }
});

// In-Memory Database Store Fallback for local development without DB
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
    throw e;
  }
}

export const memoryStore = MEMORY_DB;
