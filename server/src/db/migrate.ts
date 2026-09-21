/**
 * DayFlow Database Migration Script
 * Runs all schema definitions, DDL updates, constraint checks, and performance indexes.
 * Executed independently via: npm run migrate
 */
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const isProd = process.env.NODE_ENV === 'production';
const poolConfig: pg.PoolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DB_SSL === 'true' || isProd ? { rejectUnauthorized: false } : false
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5433', 10),
      database: process.env.DB_NAME || 'dayflow_db',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
    };

const pool = new Pool(poolConfig);

export async function runMigrations() {
  console.log('🔄 Running DayFlow PostgreSQL schema migrations...');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. UUID extension
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');

    // 2. Base tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255),
        display_name VARCHAR(100),
        google_id VARCHAR(255) UNIQUE,
        avatar_url TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS schedule_weeks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        start_date DATE NOT NULL,
        weekly_notes TEXT,
        note_sheets JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_user_week UNIQUE(user_id, start_date)
      );

      CREATE TABLE IF NOT EXISTS schedule_slots (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        week_id UUID REFERENCES schedule_weeks(id) ON DELETE CASCADE,
        slot_key VARCHAR(50) NOT NULL,
        planned_task VARCHAR(255) NOT NULL,
        actual_task VARCHAR(255) NOT NULL,
        category VARCHAR(50) NOT NULL DEFAULT 'General',
        planned_duration INT DEFAULT 30,
        actual_duration INT DEFAULT 0,
        status VARCHAR(20) DEFAULT 'Pending',
        notes TEXT,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_week_slot UNIQUE(week_id, slot_key)
      );

      CREATE TABLE IF NOT EXISTS habit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        week_start DATE NOT NULL,
        habit_name VARCHAR(255) NOT NULL,
        pts INT DEFAULT 5,
        log_time VARCHAR(20) NOT NULL,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS todo_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        week_id UUID REFERENCES schedule_weeks(id) ON DELETE CASCADE,
        text VARCHAR(255) NOT NULL,
        priority VARCHAR(20) DEFAULT 'Medium',
        category VARCHAR(50) DEFAULT 'General',
        is_completed BOOLEAN DEFAULT FALSE,
        due_date DATE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(64) NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        used BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. Incremental column upgrades
    await client.query("ALTER TABLE schedule_weeks ADD COLUMN IF NOT EXISTS note_sheets JSONB DEFAULT '[]'::jsonb;");
    await client.query("ALTER TABLE todo_items ADD COLUMN IF NOT EXISTS due_date DATE;");
    await client.query("ALTER TABLE todo_items ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'Medium';");
    await client.query("ALTER TABLE todo_items ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'General';");
    await client.query("ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;");
    await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE;");
    await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;");

    // 4. Date validation constraints
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

    // 5. Production Performance Indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_habit_logs_user_week ON habit_logs (user_id, week_start);
      CREATE INDEX IF NOT EXISTS idx_todo_items_week_id ON todo_items (week_id);
      CREATE INDEX IF NOT EXISTS idx_schedule_slots_week ON schedule_slots (week_id);
      CREATE INDEX IF NOT EXISTS idx_schedule_weeks_user ON schedule_weeks (user_id);
      CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email));
      CREATE INDEX IF NOT EXISTS idx_pwd_reset_token ON password_reset_tokens (token_hash);
      CREATE INDEX IF NOT EXISTS idx_pwd_reset_user ON password_reset_tokens (user_id);
    `);

    await client.query('COMMIT');
    console.log('✅ DayFlow schema migrations and indexes completed successfully!');
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

// Auto-run when executed directly
if (process.argv[1] && process.argv[1].includes('migrate')) {
  runMigrations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
