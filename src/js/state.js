/**
 * DayFlow State & Storage Manager
 * Supports Day, Week, and Month schedule view modes with PostgreSQL & namespaced local storage sync
 */
import { ApiClient, isDemoMode } from './apiClient.js?v=2.9.4';

export const STATE = {
  currentWeekStart: getMonday(new Date()),
  selectedDate: new Date(),
  scheduleViewMode: 'week', // 'day' | 'week' | 'month'
  selectedCategoryFilter: 'ALL',
  activeView: 'grid',
  activeSlotKey: null,
  selectedSlotKey: null,
  gridClipboard: null,
  copiedSlotKey: null,
  undoStack: [],
  redoStack: [],
  scheduleData: {},
  notesDirty: false,
  notesDirtyWeekKey: null,
  notesDirtyContext: null,
  notesSaveFailed: false,
  failedNotesWeekKeys: new Set(),
  notesInFlightWeekKey: null
};

export function saveFailedNotesWeeksToStorage() {
  try {
    const key = getUserStorageKey('dayflow_failed_notes_weeks');
    if (STATE.failedNotesWeekKeys && STATE.failedNotesWeekKeys.size > 0) {
      localStorage.setItem(key, JSON.stringify(Array.from(STATE.failedNotesWeekKeys)));
    } else {
      localStorage.removeItem(key);
    }
  } catch (e) {}
}

export function markNotesDirty(context) {
  STATE.notesDirty = true;
  if (context) {
    STATE.notesDirtyContext = { ...context };
    if (context.weekKey) STATE.notesDirtyWeekKey = context.weekKey;
  }
}

export function clearNotesDirty() {
  STATE.notesDirty = false;
  STATE.notesDirtyContext = null;
  STATE.notesDirtyWeekKey = null;
}

export function markNotesSaveFailed(weekKey) {
  STATE.notesSaveFailed = true;
  if (weekKey) {
    if (!STATE.failedNotesWeekKeys) STATE.failedNotesWeekKeys = new Set();
    STATE.failedNotesWeekKeys.add(weekKey);
    saveFailedNotesWeeksToStorage();
  }
}

export function clearNotesSaveFailed(weekKey) {
  if (weekKey) {
    if (STATE.failedNotesWeekKeys) {
      STATE.failedNotesWeekKeys.delete(weekKey);
      saveFailedNotesWeeksToStorage();
    }
  } else {
    if (STATE.failedNotesWeekKeys) {
      STATE.failedNotesWeekKeys.clear();
      saveFailedNotesWeeksToStorage();
    }
  }
  STATE.notesSaveFailed = !!(STATE.failedNotesWeekKeys && STATE.failedNotesWeekKeys.size > 0);
}

export function setNotesInFlight(weekKey) {
  STATE.notesInFlightWeekKey = weekKey;
}

export function clearNotesInFlight() {
  STATE.notesInFlightWeekKey = null;
}

export function isDirtyNotes() {
  return !!(STATE.notesDirty || STATE.notesSaveFailed || (STATE.failedNotesWeekKeys && STATE.failedNotesWeekKeys.size > 0));
}

const MAX_UNDO_DEPTH = 30;

export function recordUndoAction(action) {
  STATE.undoStack.push(action);
  if (STATE.undoStack.length > MAX_UNDO_DEPTH) {
    STATE.undoStack.shift();
  }
  STATE.redoStack.length = 0;
}

export function setScheduleViewMode(mode) {
  if (['day', 'week', 'month'].includes(mode)) {
    STATE.scheduleViewMode = mode;
    try {
      const modeKey = getUserStorageKey('dayflow_schedule_view_mode');
      localStorage.setItem(modeKey, mode);
    } catch (e) {}
  }
}

export function formatDateISO(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function getActiveDateFormat() {
  if (typeof window !== 'undefined' && window.__DAYFLOW_DATE_FORMAT__) {
    return window.__DAYFLOW_DATE_FORMAT__;
  }
  return 'DD/MM/YYYY';
}

export function setActiveDateFormat(format) {
  if (typeof window !== 'undefined') {
    window.__DAYFLOW_DATE_FORMAT__ = format;
  }
}

/**
 * Format a Date object or 'YYYY-MM-DD' ISO string according to the active (or passed) dateFormat.
 * Supported formats:
 * - 'DD/MM/YYYY'   -> '07/09/2026'
 * - 'MM/DD/YYYY'   -> '09/07/2026'
 * - 'YYYY-MM-DD'   -> '2026-09-07'
 * - 'DD-MMM-YYYY'  -> '07-Sep-2026'
 */
export function formatDateDisplay(dateInput, format = null) {
  if (!dateInput) return '';
  let y, m, d;
  if (typeof dateInput === 'string') {
    const match = dateInput.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      y = match[1];
      m = match[2];
      d = match[3];
    } else {
      const parsed = new Date(dateInput);
      if (isNaN(parsed.getTime())) return dateInput;
      y = String(parsed.getFullYear());
      m = String(parsed.getMonth() + 1).padStart(2, '0');
      d = String(parsed.getDate()).padStart(2, '0');
    }
  } else if (dateInput instanceof Date) {
    if (isNaN(dateInput.getTime())) return '';
    y = String(dateInput.getFullYear());
    m = String(dateInput.getMonth() + 1).padStart(2, '0');
    d = String(dateInput.getDate()).padStart(2, '0');
  } else {
    return '';
  }

  const fmt = format || getActiveDateFormat();
  const monthIdx = parseInt(m, 10) - 1;
  const monthName = MONTH_NAMES_SHORT[monthIdx] || m;

  switch (fmt) {
    case 'MM/DD/YYYY':
      return `${m}/${d}/${y}`;
    case 'YYYY-MM-DD':
      return `${y}-${m}-${d}`;
    case 'DD-MMM-YYYY':
      return `${d}-${monthName}-${y}`;
    case 'DD/MM/YYYY':
    default:
      return `${d}/${m}/${y}`;
  }
}

/**
 * Format a Date object or 'YYYY-MM-DD' ISO string into short (Day & Month) representation:
 * - 'DD/MM/YYYY'   -> '07/09'
 * - 'MM/DD/YYYY'   -> '09/07'
 * - 'YYYY-MM-DD'   -> '09-07'
 * - 'DD-MMM-YYYY'  -> '07-Sep'
 */
export function formatDateDisplayShort(dateInput, format = null) {
  if (!dateInput) return '';
  let m, d;
  if (typeof dateInput === 'string') {
    const match = dateInput.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      m = match[2];
      d = match[3];
    } else {
      const parsed = new Date(dateInput);
      if (isNaN(parsed.getTime())) return dateInput;
      m = String(parsed.getMonth() + 1).padStart(2, '0');
      d = String(parsed.getDate()).padStart(2, '0');
    }
  } else if (dateInput instanceof Date) {
    if (isNaN(dateInput.getTime())) return '';
    m = String(dateInput.getMonth() + 1).padStart(2, '0');
    d = String(dateInput.getDate()).padStart(2, '0');
  } else {
    return '';
  }

  const fmt = format || getActiveDateFormat();
  const monthIdx = parseInt(m, 10) - 1;
  const monthName = MONTH_NAMES_SHORT[monthIdx] || m;

  switch (fmt) {
    case 'MM/DD/YYYY':
      return `${m}/${d}`;
    case 'YYYY-MM-DD':
      return `${m}-${d}`;
    case 'DD-MMM-YYYY':
      return `${d}-${monthName}`;
    case 'DD/MM/YYYY':
    default:
      return `${d}/${m}`;
  }
}

export function getMonday(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.getFullYear(), date.getMonth(), diff, 0, 0, 0, 0);
}

export function getWeekKey(date) {
  const monday = getMonday(date);
  return formatDateISO(monday);
}

export function getWeekDates(mondayDate) {
  const dates = [];
  const start = getMonday(mondayDate);
  for (let i = 0; i < 7; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    dates.push(formatDateISO(d));
  }
  return dates;
}

export function getUserStorageKey(prefix = 'dayflow_data') {
  const userJson = localStorage.getItem('dayflow_user');
  if (userJson) {
    try {
      const u = JSON.parse(userJson);
      if (u && (u.id || u.email)) {
        const identifier = u.id || u.email;
        return `${prefix}_${identifier}`;
      }
    } catch (e) {}
  }
  return `${prefix}_guest`;
}

export function loadStateFromStorage() {
  try {
    const key = getUserStorageKey();
    const stored = localStorage.getItem(key);
    if (stored) {
      STATE.scheduleData = JSON.parse(stored);
    } else {
      STATE.scheduleData = {};
    }

    const modeKey = getUserStorageKey('dayflow_schedule_view_mode');
    const savedMode = localStorage.getItem(modeKey);
    if (savedMode && ['day', 'week', 'month'].includes(savedMode)) {
      STATE.scheduleViewMode = savedMode;
    }

    const failedKey = getUserStorageKey('dayflow_failed_notes_weeks');
    const savedFailed = localStorage.getItem(failedKey);
    if (savedFailed) {
      try {
        const arr = JSON.parse(savedFailed);
        if (Array.isArray(arr)) {
          STATE.failedNotesWeekKeys = new Set(arr);
          STATE.notesSaveFailed = STATE.failedNotesWeekKeys.size > 0;
        }
      } catch (e) {}
    }
  } catch (e) {
    console.error('Failed to load DayFlow state:', e);
  }
}

export function saveStateToStorage() {
  try {
    const key = getUserStorageKey();
    localStorage.setItem(key, JSON.stringify(STATE.scheduleData));
  } catch (e) {
    console.error('Failed to save DayFlow state:', e);
  }
}

export function getCurrentWeekData() {
  const weekKey = getWeekKey(STATE.currentWeekStart);
  if (!STATE.scheduleData[weekKey]) {
    STATE.scheduleData[weekKey] = {
      slots: {},
      habits: [],
      todos: [],
      notes: '',
      noteSheets: []
    };
  }
  return STATE.scheduleData[weekKey];
}

export async function syncWeekDataWithApi(onRender) {
  if (isDemoMode()) {
    if (typeof onRender === 'function') onRender();
    return;
  }
  const weekKey = getWeekKey(STATE.currentWeekStart);
  const weekData = getCurrentWeekData();

  // Run all 3 fetches concurrently to shrink the network latency window (Addresses Finding 06)
  const [apiSlots, apiHabits, apiTodosNotes] = await Promise.all([
    ApiClient.fetchWeekSchedule(weekKey),
    ApiClient.fetchHabits(weekKey),
    ApiClient.fetchTodosAndNotes(weekKey)
  ]);

  if (apiSlots !== null && typeof apiSlots === 'object') {
    weekData.slots = apiSlots;
  }

  if (apiHabits !== null && Array.isArray(apiHabits)) {
    weekData.habits = apiHabits;
  }

  if (apiTodosNotes !== null && typeof apiTodosNotes === 'object') {
    if (apiTodosNotes.todos) weekData.todos = apiTodosNotes.todos;

    // Scoped sync guard (Addresses Findings 06, 10, 11, 12):
    // Only skip updating notes if THIS week has pending local edits, a failed save needing retry,
    // or an in-flight save request. Never block other weeks, and never block purely on focus.
    const isThisWeekFailed = !!(STATE.failedNotesWeekKeys && STATE.failedNotesWeekKeys.has(weekKey));
    const hasUnsavedOrInFlight = (
      (STATE.notesDirty && STATE.notesDirtyWeekKey === weekKey) ||
      isThisWeekFailed ||
      (STATE.notesInFlightWeekKey === weekKey)
    );

    if (!hasUnsavedOrInFlight) {
      if (apiTodosNotes.notes !== undefined) weekData.notes = apiTodosNotes.notes;
      if (apiTodosNotes.noteSheets !== undefined && Array.isArray(apiTodosNotes.noteSheets)) {
        weekData.noteSheets = apiTodosNotes.noteSheets;
      }
    }
  }

  // If in month mode, also fetch the other weeks in this month so Month Grid & Monthly Analytics are fully populated
  if (STATE.scheduleViewMode === 'month') {
    const selDate = STATE.selectedDate || new Date();
    const y = selDate.getFullYear();
    const m = selDate.getMonth();
    const firstDay = new Date(y, m, 1);
    const lastDay = new Date(y, m + 1, 0);
    const mondaySet = new Set();
    for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
      mondaySet.add(getWeekKey(d));
    }
    const otherKeys = Array.from(mondaySet).filter(mKey => mKey !== weekKey);
    await Promise.all(otherKeys.map(async (mKey) => {
      if (!STATE.scheduleData[mKey]) {
        STATE.scheduleData[mKey] = { slots: {}, habits: [], todos: [], notes: '', noteSheets: [] };
      }
      const [otherSlots, otherHabits] = await Promise.all([
        ApiClient.fetchWeekSchedule(mKey),
        ApiClient.fetchHabits(mKey)
      ]);
      if (otherSlots !== null && typeof otherSlots === 'object') {
        STATE.scheduleData[mKey].slots = otherSlots;
      }
      if (otherHabits !== null && Array.isArray(otherHabits)) {
        STATE.scheduleData[mKey].habits = otherHabits;
      }
    }));
  }

  saveStateToStorage();
  if (onRender) onRender();
}

export function ensureSampleDataForCurrentWeek() {
  const weekData = getCurrentWeekData();
  if (!weekData.slots) {
    weekData.slots = {};
  }
  if (!weekData.habits) {
    weekData.habits = [];
  }
  if (!weekData.todos) {
    weekData.todos = [];
  }
  if (!weekData.noteSheets || !Array.isArray(weekData.noteSheets) || weekData.noteSheets.length === 0) {
    weekData.noteSheets = [
      { id: 'journal', title: 'Weekly Journal', icon: '📓', content: weekData.notes || '', isDefault: true },
      { id: 'daily_journal', title: 'Daily Journal', icon: '📅', content: '', dailyContent: {}, isDefault: true },
      { id: 'tech', title: 'Tech & Architecture', icon: '💻', content: '', isDefault: true },
      { id: 'backlog', title: 'Sprint Backlog', icon: '💼', content: '', isDefault: true },
      { id: 'scratchpad', title: 'Quick Scratchpad', icon: '⚡', content: '', isDefault: true }
    ];
  } else if (!weekData.noteSheets.some(s => s.id === 'daily_journal')) {
    const journalIdx = weekData.noteSheets.findIndex(s => s.id === 'journal');
    const dailySheet = { id: 'daily_journal', title: 'Daily Journal', icon: '📅', content: '', dailyContent: {}, isDefault: true };
    if (journalIdx >= 0) {
      weekData.noteSheets.splice(journalIdx + 1, 0, dailySheet);
    } else {
      weekData.noteSheets.unshift(dailySheet);
    }
  }

  // If in demo mode and schedule is empty, seed rich sample content for instant preview
  if (isDemoMode() && Object.keys(weekData.slots).length === 0) {
    const monday = getMonday(STATE.currentWeekStart || new Date());
    const monISO = formatDateISO(monday);
    const tueDate = new Date(monday); tueDate.setDate(tueDate.getDate() + 1);
    const tueISO = formatDateISO(tueDate);
    const wedDate = new Date(monday); wedDate.setDate(wedDate.getDate() + 2);
    const wedISO = formatDateISO(wedDate);
    const thuDate = new Date(monday); thuDate.setDate(thuDate.getDate() + 3);
    const thuISO = formatDateISO(thuDate);

    weekData.slots = {
      [`${monISO}_09:00`]: { title: 'Sprint Planning & Objectives', category: 'Work', plannedDuration: 60, actualDuration: 60, status: 'Completed', notes: 'Defined weekly priorities and roadmap' },
      [`${monISO}_14:00`]: { title: 'System Architecture Design', category: 'Work', plannedDuration: 90, actualDuration: 90, status: 'Completed', notes: 'Reviewed database schema and scaling' },
      [`${tueISO}_10:30`]: { title: 'Deep Work: Core API Modules', category: 'Learning', plannedDuration: 60, actualDuration: 60, status: 'Completed', notes: 'Implemented caching & query optimization' },
      [`${wedISO}_09:00`]: { title: 'Focus Session: Responsive UI Revamp', category: 'Work', plannedDuration: 60, actualDuration: 60, status: 'Completed', notes: 'Mobile, tablet and desktop layout audits' },
      [`${wedISO}_14:30`]: { title: 'Algorithm Study & Code Review', category: 'Learning', plannedDuration: 60, actualDuration: 30, status: 'In-Progress', notes: 'Reviewing performance bottlenecks' },
      [`${thuISO}_11:00`]: { title: 'Client Sync & Deliverable Prep', category: 'Work', plannedDuration: 60, actualDuration: 0, status: 'Pending', notes: 'Prepare slide deck and demo' }
    };

    if (weekData.habits.length === 0) {
      weekData.habits = [
        { id: 'demo_h1', name: 'Morning Focus & Planning', category: 'General', targetDays: 7, history: { [monISO]: true, [tueISO]: true, [wedISO]: true } },
        { id: 'demo_h2', name: 'Deep Coding & Architecture (2h+)', category: 'Learning', targetDays: 5, history: { [monISO]: true, [tueISO]: true, [wedISO]: true } },
        { id: 'demo_h3', name: 'Physical Exercise / Health', category: 'Health', targetDays: 5, history: { [monISO]: true, [wedISO]: true } }
      ];
    }

    if (weekData.todos.length === 0) {
      weekData.todos = [
        { id: 'demo_t1', text: 'Deliver responsive UI revamp across mobile and tablet', priority: 'High', category: 'Work', dueDate: wedISO, completed: true },
        { id: 'demo_t2', text: 'Review weekly focus score and habit completion', priority: 'Medium', category: 'General', dueDate: thuISO, completed: false },
        { id: 'demo_t3', text: 'Study advanced distributed systems patterns', priority: 'High', category: 'Learning', dueDate: '', completed: false }
      ];
    }

    if (weekData.noteSheets && weekData.noteSheets[0] && !weekData.noteSheets[0].content) {
      weekData.noteSheets[0].content = `# Weekly Focus & Objectives\n\n- [x] Complete responsive UI design revamp\n- [x] Test continuous sweeping across all breakpoints\n- [ ] Ship production update\n\n### Key Highlights\nDiscipline score reached 92% with consistent deep work blocks.`;
      weekData.notes = weekData.noteSheets[0].content;
    }
  }

  saveStateToStorage();
}

export function isSlotTimePassed(slotKey) {
  if (!slotKey) return false;
  const parts = slotKey.split('_');
  if (parts.length < 2) return false;

  const [y, m, d] = parts[0].split('-').map(Number);
  const [hours, mins] = parts[1].split(':').map(Number);

  const slotEndTime = new Date(y, m - 1, d, hours, mins + 30, 0, 0);
  return new Date() > slotEndTime;
}

export function isSlotInFuture(slotKey) {
  if (!slotKey) return false;
  const parts = slotKey.split('_');
  if (parts.length < 2) return false;

  const [y, m, d] = parts[0].split('-').map(Number);
  const [hours, mins] = parts[1].split(':').map(Number);

  const slotStartTime = new Date(y, m - 1, d, hours, mins, 0, 0);
  return slotStartTime > new Date();
}

export function getSlotWeekKey(slotKey) {
  if (!slotKey) return getWeekKey(STATE.currentWeekStart);
  const parts = slotKey.split('_');
  if (parts.length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(parts[0])) {
    const [y, m, d] = parts[0].split('-').map(Number);
    return getWeekKey(new Date(y, m - 1, d));
  }
  return getWeekKey(STATE.currentWeekStart);
}
