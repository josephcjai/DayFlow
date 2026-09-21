-- DayFlow PostgreSQL Database Schema Definition

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users Entity
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    display_name VARCHAR(100),
    google_id VARCHAR(255) UNIQUE,
    avatar_url TEXT,
    token_version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Weekly Schedule Container (Unique per user + start_date between 1800 and 2200)
CREATE TABLE IF NOT EXISTS schedule_weeks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    start_date DATE NOT NULL CHECK (start_date BETWEEN '1800-01-01' AND '2200-12-31'), -- Monday date YYYY-MM-DD
    weekly_notes TEXT,
    note_sheets JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_week UNIQUE(user_id, start_date)
);

-- 30-Minute Time Slots
CREATE TABLE IF NOT EXISTS schedule_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    week_id UUID REFERENCES schedule_weeks(id) ON DELETE CASCADE,
    slot_key VARCHAR(50) NOT NULL, -- Format: YYYY-MM-DD_HH:MM
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

-- Habit Ledger
CREATE TABLE IF NOT EXISTS habit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    week_start DATE NOT NULL CHECK (week_start BETWEEN '1800-01-01' AND '2200-12-31'),
    habit_name VARCHAR(255) NOT NULL,
    pts INT DEFAULT 5,
    log_time VARCHAR(20) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Todo Checklist
CREATE TABLE IF NOT EXISTS todo_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    week_id UUID REFERENCES schedule_weeks(id) ON DELETE CASCADE,
    text VARCHAR(255) NOT NULL,
    priority VARCHAR(20) DEFAULT 'Medium',
    category VARCHAR(50) DEFAULT 'General',
    is_completed BOOLEAN DEFAULT FALSE,
    due_date DATE CHECK (due_date IS NULL OR (due_date BETWEEN '1800-01-01' AND '2200-12-31')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Password Reset Tokens
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Production Indexes
CREATE INDEX IF NOT EXISTS idx_pwd_reset_token ON password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_pwd_reset_user ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_habit_logs_user_week ON habit_logs (user_id, week_start);
CREATE INDEX IF NOT EXISTS idx_todo_items_week_id ON todo_items (week_id);
CREATE INDEX IF NOT EXISTS idx_schedule_slots_week ON schedule_slots (week_id);
CREATE INDEX IF NOT EXISTS idx_schedule_weeks_user ON schedule_weeks (user_id);
