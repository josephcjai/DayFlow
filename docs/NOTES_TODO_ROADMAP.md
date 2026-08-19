# 📝 Notes & Todo Module — Development Roadmap & Technical Specifications

This document outlines the proposed enhancements and feature specifications for evolving the **Notes & Todo** tab into a high-productivity command center integrated with DayFlow's 30-minute schedule grid and habit tracking system.

---

## 🎯 Executive Summary

The **Notes & Todo** tab currently offers a clean weekly checklist and debounced journal scratchpad with PostgreSQL persistence. This roadmap details phased enhancements to turn it into an actionable, gamified, and deeply integrated system.

---

## 📋 Feature Roadmap & Implementation Specs

### 1. 📅 1-Click "Schedule to Grid" (Timeblocking Integration)
* **Goal**: Bridge the gap between planning weekly priorities and executing them on the 30-minute grid.
* **UI/UX**:
  * Each Todo item gets an interactive **`📅 Schedule`** action button.
  * Clicking **`📅 Schedule`** opens the Task Editor Modal pre-filled with the Todo text as the planned task.
  * User selects the target time slot (or drops it directly onto the grid), turning abstract goals into scheduled execution blocks.
* **Database**: Links `schedule_slots` with `todo_items.id` (optional foreign key / reference).

---

### 2. 🏷️ Priority Tags & Category Labeling
* **Goal**: Categorize and prioritize tasks for clearer focus during busy weeks.
* **Features**:
  * **Priority Levels**:
    * 🔴 **High Priority** (`+15 pts` potential reward)
    * 🟡 **Medium Priority** (`+10 pts`)
    * 🟢 **Low Priority** (`+5 pts`)
  * **Category Badges**: Tag todos with categories matching the grid (*Learning*, *Work*, *Household*, *Family*, *Health*, *Travel*, *General*).
  * **Filtering Pills**: Filter checklist view by *All*, *Pending*, *Completed*, or *High Priority*.
* **Database Schema Update**: Add `priority VARCHAR(20) DEFAULT 'Medium'` and `category VARCHAR(50) DEFAULT 'General'` columns to `todo_items`.

---

### 3. 📝 Markdown & Code Snippet Formatting in Scratchpad
* **Goal**: Transform the plain textarea into a rich developer notebook.
* **Features**:
  * **Markdown Toolbar**: Quick insertion for Headings (`#`, `##`), Bold/Italic, Bullet lists, and Task checkboxes.
  * **Code Blocks**: Syntax-highlighted blocks for C#, WPF XAML, SQL, JavaScript, and TypeScript snippets.
  * **Split / Toggle Preview**: Live side-by-side or toggleable Markdown preview.
* **Storage**: Retains standard Markdown text stored in `schedule_weeks.weekly_notes` (fully backward compatible).

---

### 4. 🏆 Gamified Todo Completion & Discipline Points
* **Goal**: Reward consistent execution of weekly goals.
* **Features**:
  * **Completion Progress Bar**: Visual tracker showing progress (e.g., `4 of 5 Goals Done — 80%`).
  * **Bonus Discipline Points**: Completing a priority item awards bonus discipline points to the **Focus & Habit Analytics** score.
* **Integration**: Updates `habit_logs` or records milestone events.

---

### 5. 📑 Multiple Categorized Note Sheets (Notebook Tabs)
* **Goal**: Support multiple focused scratchpads per week instead of a single shared textarea.
* **Features**:
  * Tabbed sub-navigation for notes:
    * 📓 *Weekly Reflections & Journal*
    * 💻 *WPF / Tech Learning Notes*
    * 💼 *Sprint & Project Backlog*
    * ⚡ *Quick Thoughts & Scratchpad*
  * Ability to add custom note tabs.
* **Database Schema Update**: Create `weekly_note_sheets` table or JSONB structure in PostgreSQL.

---

### 6. ⏰ Due Dates & Day/Week Granularity Synchronization
* **Goal**: Assign specific target deadlines within the week.
* **Features**:
  * Quick date picker for todos (*Today*, *Tomorrow*, or specific date).
  * Synchronization with top `Day / Week / Month` mode toggle so "Day" mode highlights items due today.
* **Database Schema Update**: Add `due_date DATE` column to `todo_items`.

---

## 🚦 Phased Implementation Plan

| Phase | Feature | Complexity | Dependencies |
| :---: | :--- | :---: | :--- |
| **Phase 1** | **Priority Tags (High/Med/Low) & Category Labels** | Low | `todo_items` schema migration |
| **Phase 2** | **1-Click "Schedule to Grid" (Timeblocking)** | Medium | `modal.js` + `grid.js` bridge |
| **Phase 3** | **Progress Bar & Gamification Points** | Low | `analytics.js` + `notes.js` |
| **Phase 4** | **Markdown & Code Snippet Support** | Medium | Markdown parser integration |
| **Phase 5** | **Multiple Note Sheets / Tabs** | Medium | `schedule_weeks` note structure |
| **Phase 6** | **Due Dates & Day/Week Sync** | Medium | Granularity filter alignment |

---

*Document created: August 19, 2026 for DayFlow project repository.*
