/**
 * DayFlow State & Storage Manager
 * Supports Day, Week, and Month schedule view modes with PostgreSQL & namespaced local storage sync
 */
import { ApiClient } from './apiClient.js?v=2.8.5';

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
};

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
  const weekKey = getWeekKey(STATE.currentWeekStart);
  const weekData = getCurrentWeekData();

  const apiSlots = await ApiClient.fetchWeekSchedule(weekKey);
  if (apiSlots !== null && typeof apiSlots === 'object') {
    weekData.slots = apiSlots;
  }

  const apiHabits = await ApiClient.fetchHabits(weekKey);
  if (apiHabits !== null && Array.isArray(apiHabits)) {
    weekData.habits = apiHabits;
  }

  const apiTodosNotes = await ApiClient.fetchTodosAndNotes(weekKey);
  if (apiTodosNotes !== null && typeof apiTodosNotes === 'object') {
    if (apiTodosNotes.todos) weekData.todos = apiTodosNotes.todos;
    if (apiTodosNotes.notes !== undefined) weekData.notes = apiTodosNotes.notes;
    if (apiTodosNotes.noteSheets !== undefined && Array.isArray(apiTodosNotes.noteSheets)) {
      weekData.noteSheets = apiTodosNotes.noteSheets;
    }
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
      { id: 'tech', title: 'Tech & Architecture', icon: '💻', content: '', isDefault: true },
      { id: 'backlog', title: 'Sprint Backlog', icon: '💼', content: '', isDefault: true },
      { id: 'scratchpad', title: 'Quick Scratchpad', icon: '⚡', content: '', isDefault: true }
    ];
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
