# DayFlow V2 — Comprehensive Technical Specification

**Version:** 2.1.0  
**Document Status:** Approved & Finalized  
**Target Environment:** Cross-Platform (Web & Mobile) — Antigravity IDE Development Context  

---

## 1. Executive Summary & Identity

**DayFlow** is a focus-driven daily scheduler, habit enforcement ledger, and productivity analytics application. It modernizes manual multi-tab spreadsheet schedule workflows into an intuitive 30-minute time-blocking application with actual time logging, persistent habit enforcement, and focus category analytics.

### Key Value Propositions
- **Granular Time-Blocking**: 30-minute interval slots from early morning (04:00 AM) to late night (11:00 PM / 24-hour cycle).
- **Explicit Planned vs. Actual Tasks**: Dedicated fields for `Planned Task` and `Actual Task`.
- **Scheduled Time-Lock Rule**: `Planned Task` becomes read-only (locked baseline) once a 30-minute slot's scheduled time has passed.
- **Post-Completion Flexibility**: `Actual Task`, actual duration (mins), completion status, and notes remain **100% editable** at any time after slot completion.
- **Habit & Rule Ledger**: Rapid logging for routine habits (meals, cleaning, discipline rules) and non-working hours tracking.
- **Focus Analytics**: Aggregated weekly visualization of planned vs. actual hours across defined activity categories.

---

## 2. System Architecture & Modular Project Structure

```
DayFlow/
├── docs/
│   ├── API_DOCUMENTATION.md        # Interactive REST API endpoint contracts
│   ├── DEPLOYMENT_LIGHTSAIL.md     # Production cloud deployment guide
│   ├── NOTES_TODO_ROADMAP.md       # Notes & Todo module feature roadmap
│   └── TECHNICAL_SPECIFICATION.md  # Comprehensive technical specification
├── src/
│   ├── css/
│   │   └── styles.css              # Modular design system & components stylesheet
│   ├── data/
│   │   └── initialData.js          # Default initial schedule dataset generator
│   └── js/
│       ├── state.js                # Central state manager & time-lock validator
│       ├── grid.js                 # 30-min schedule timeline grid renderer
│       ├── modal.js                # Task Editor modal (Planned vs Actual rules)
│       ├── habits.js               # Habit & discipline ledger module
│       ├── analytics.js            # Focus category analytics engine
│       ├── notes.js                # Weekly notes & to-do checklist engine
│       └── app.js                  # Main application entry point & router
├── index.html                      # Semantic single-page application entry
├── README.md                       # Repository documentation & guide
└── .gitignore                      # Workspace git ignore rules
```

---

## 3. Database Schema Design (PostgreSQL Relational Specification)

```sql
-- Users Entity
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(100),
    timezone VARCHAR(50) DEFAULT 'UTC',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Weekly Schedule Container
CREATE TABLE schedule_weeks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    start_date DATE NOT NULL, -- Monday date of the week
    notes TEXT,
    earned_points INT DEFAULT 0,
    redeemed_points INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_week UNIQUE(user_id, start_date)
);

-- 30-Minute Time Slots Entity
CREATE TABLE schedule_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    week_id UUID REFERENCES schedule_weeks(id) ON DELETE CASCADE,
    slot_time TIME NOT NULL, -- e.g., '08:30:00'
    day_of_week INT NOT NULL, -- 1=Monday, 2=Tuesday, ... 7=Sunday
    planned_task VARCHAR(255) NOT NULL, -- Scheduled baseline task
    actual_task VARCHAR(255) NOT NULL,  -- Task actually executed (editable post-completion)
    category VARCHAR(50) NOT NULL DEFAULT 'General', -- 'Learning', 'Work', 'Household', 'Family', etc.
    planned_duration INT DEFAULT 30, -- minutes
    actual_duration INT DEFAULT 0, -- minutes actually spent
    status VARCHAR(20) DEFAULT 'Pending', -- 'Pending', 'Done', 'Partially Done', 'Not Done'
    notes TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Habit & Discipline Ledger
CREATE TABLE habit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    habit_name VARCHAR(255) NOT NULL,
    logged_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    category VARCHAR(50) DEFAULT 'Habit',
    points_impact INT DEFAULT 0,
    notes TEXT
);

-- Todo Checklist Entity
CREATE TABLE todo_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    week_id UUID REFERENCES schedule_weeks(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    is_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

---

## 4. Functional Requirements & Task Lifecycle Rules

### 4.1 Planned Task vs. Actual Task Rules
1. **Creation & Auto-Sync**: When scheduling a task, typing in the `Planned Task` field automatically populates `Actual Task` by default.
2. **Scheduled Time-Lock Rule**:
   - For future/current time slots, the user can edit both `Planned Task` and `Actual Task`.
   - Once a 30-minute slot's scheduled time has passed (evaluated against local date & slot end time), `Planned Task` becomes **locked (read-only)** to preserve the original baseline plan.
3. **Post-Completion Flexibility**:
   - The `Actual Task` field remains **100% editable** at any time, even after completing the 30-minute slot.
   - Users can update `Actual Task`, actual duration (mins), completion status, and notes whenever plans change during execution.

---

## 5. Development Roadmap & Milestones

- **Milestone 1 (Complete)**: Documentation & Modular Web Application Architecture. Separate `Planned Task` & `Actual Task` fields, time-lock enforcement, Habit Ledger, Focus Analytics, and Local Storage.
- **Milestone 2**: Node.js / Express REST API server integration with PostgreSQL database.
- **Milestone 3**: Cross-Platform Flutter Mobile Application deployment for Android & iOS.
