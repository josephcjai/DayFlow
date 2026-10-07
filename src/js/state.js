/**
 * DayFlow State & Storage Manager
 * Supports Day, Week, and Month schedule view modes with PostgreSQL & namespaced local storage sync
 */
import { ApiClient, isDemoMode } from './apiClient.js?v=2.9.26';

export const DEFAULT_CATEGORIES = [
  { id: 'cat_work', name: 'Work', icon: '💼', color: '#3b82f6', isProductive: true, isSystem: false, isArchived: false, sortOrder: 0 },
  { id: 'cat_learning', name: 'Learning', icon: '📚', color: '#8b5cf6', isProductive: true, isSystem: false, isArchived: false, sortOrder: 1 },
  { id: 'cat_health', name: 'Health', icon: '🏃', color: '#f59e0b', isProductive: false, isSystem: false, isArchived: false, sortOrder: 2 },
  { id: 'cat_household', name: 'Household', icon: '🧹', color: '#10b981', isProductive: false, isSystem: false, isArchived: false, sortOrder: 3 },
  { id: 'cat_family', name: 'Family', icon: '👨‍👩‍👧', color: '#ec4899', isProductive: false, isSystem: false, isArchived: false, sortOrder: 4 },
  { id: 'cat_travel', name: 'Travel', icon: '✈️', color: '#06b6d4', isProductive: false, isSystem: false, isArchived: false, sortOrder: 5 },
  { id: 'cat_general', name: 'General', icon: '📌', color: '#64748b', isProductive: false, isSystem: true, isArchived: false, sortOrder: 6 }
];

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
  notesInFlightWeekKey: null,
  pendingSlotSaves: {},
  selectedSlotKeys: new Set(),
  categories: JSON.parse(JSON.stringify(DEFAULT_CATEGORIES))
};

if (typeof window !== 'undefined') {
  window.__DAYFLOW_STATE__ = STATE;
}

export function loadCategoriesFromStorage() {
  try {
    const key = getUserStorageKey('dayflow_categories');
    const stored = localStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        STATE.categories = parsed;
        return;
      }
    }
  } catch (e) {
    console.warn('Failed to load categories from storage:', e);
  }
  STATE.categories = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
}

export function saveCategoriesToStorage() {
  try {
    const key = getUserStorageKey('dayflow_categories');
    localStorage.setItem(key, JSON.stringify(STATE.categories));
  } catch (e) {
    console.warn('Failed to save categories to storage:', e);
  }
}

export function getActiveCategories() {
  if (!STATE.categories || !Array.isArray(STATE.categories) || STATE.categories.length === 0) {
    return DEFAULT_CATEGORIES.filter(c => !c.isArchived);
  }
  return STATE.categories.filter(c => !c.isArchived);
}

export function getAllCategories() {
  if (!STATE.categories || !Array.isArray(STATE.categories) || STATE.categories.length === 0) {
    return DEFAULT_CATEGORIES;
  }
  return STATE.categories;
}

export function getCategoryByName(catName) {
  if (!catName) return null;
  const list = STATE.categories && STATE.categories.length > 0 ? STATE.categories : DEFAULT_CATEGORIES;
  return list.find(c => c.name.toLowerCase() === catName.toLowerCase()) || null;
}

export function getCategoryColor(catName) {
  if (!catName) return '#64748b';
  const cat = getCategoryByName(catName);
  if (cat && cat.color) return cat.color;
  const legacyMap = {
    'learning': '#8b5cf6',
    'work': '#3b82f6',
    'household': '#10b981',
    'family': '#ec4899',
    'health': '#f59e0b',
    'travel': '#06b6d4',
    'general': '#64748b'
  };
  return legacyMap[catName.toLowerCase()] || '#64748b';
}

export function getCategoryIcon(catName) {
  if (!catName) return '📌';
  const cat = getCategoryByName(catName);
  if (cat && cat.icon) return cat.icon;
  const legacyMap = {
    'learning': '📚',
    'work': '💼',
    'household': '🧹',
    'family': '👨‍👩‍👧',
    'health': '🏃',
    'travel': '✈️',
    'general': '📌'
  };
  return legacyMap[catName.toLowerCase()] || '📌';
}

export function isCategoryProductive(catName) {
  if (!catName) return false;
  const cat = getCategoryByName(catName);
  if (cat && typeof cat.isProductive === 'boolean') return cat.isProductive;
  return ['work', 'learning'].includes(catName.toLowerCase());
}

export function cascadeCategoryRenameLocally(oldName, newName) {
  if (!oldName || !newName || oldName === newName) return;
  // Update all weeks in STATE.scheduleData
  Object.values(STATE.scheduleData).forEach(week => {
    if (week && week.slots) {
      Object.values(week.slots).forEach(slot => {
        if (slot && slot.category && slot.category.toLowerCase() === oldName.toLowerCase()) {
          slot.category = newName;
        }
      });
    }
    if (week && week.todos && Array.isArray(week.todos)) {
      week.todos.forEach(todo => {
        if (todo && todo.category && todo.category.toLowerCase() === oldName.toLowerCase()) {
          todo.category = newName;
        }
      });
    }
  });
  saveStateToStorage();
}

export async function syncCategoriesWithApi() {
  if (isDemoMode()) return;
  try {
    const serverCategories = await ApiClient.getCategories(true);
    if (serverCategories && Array.isArray(serverCategories) && serverCategories.length > 0) {
      STATE.categories = serverCategories;
      saveCategoriesToStorage();
    }
  } catch (e) {
    console.warn('Failed to sync categories with API:', e);
  }
}


export function getSelectedSlotKeys() {
  if (!STATE.selectedSlotKeys) STATE.selectedSlotKeys = new Set();
  return Array.from(STATE.selectedSlotKeys);
}

export function clearSelectedSlotKeys() {
  if (STATE.selectedSlotKeys) STATE.selectedSlotKeys.clear();
}

export function addSelectedSlotKey(slotKey) {
  if (!STATE.selectedSlotKeys) STATE.selectedSlotKeys = new Set();
  STATE.selectedSlotKeys.add(slotKey);
}

export function removeSelectedSlotKey(slotKey) {
  if (STATE.selectedSlotKeys) STATE.selectedSlotKeys.delete(slotKey);
}

export function toggleSelectedSlotKey(slotKey) {
  if (!STATE.selectedSlotKeys) STATE.selectedSlotKeys = new Set();
  if (STATE.selectedSlotKeys.has(slotKey)) {
    STATE.selectedSlotKeys.delete(slotKey);
  } else {
    STATE.selectedSlotKeys.add(slotKey);
  }
}

export function isSlotMultiSelected(slotKey) {
  return !!(STATE.selectedSlotKeys && STATE.selectedSlotKeys.has(slotKey));
}

export function savePendingSlotsToStorage() {
  try {
    const key = getUserStorageKey('dayflow_pending_slots');
    if (STATE.pendingSlotSaves && Object.keys(STATE.pendingSlotSaves).length > 0) {
      localStorage.setItem(key, JSON.stringify(STATE.pendingSlotSaves));
    } else {
      localStorage.removeItem(key);
    }
  } catch (e) {}
}

export function markSlotPendingSave(weekKey, slotKey, slotData) {
  if (!STATE.pendingSlotSaves) STATE.pendingSlotSaves = {};
  STATE.pendingSlotSaves[slotKey] = {
    weekKey,
    slotKey,
    slotData: JSON.parse(JSON.stringify(slotData)),
    timestamp: Date.now()
  };
  savePendingSlotsToStorage();
}

export function clearSlotPendingSave(slotKey) {
  if (STATE.pendingSlotSaves && STATE.pendingSlotSaves[slotKey]) {
    delete STATE.pendingSlotSaves[slotKey];
    savePendingSlotsToStorage();
  }
}

export function isSlotPendingSave(slotKey) {
  return !!(STATE.pendingSlotSaves && STATE.pendingSlotSaves[slotKey]);
}

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
      // Ensure all slots in 30-min grid strictly have planned <= 30
      let hasOverDuration = false;
      Object.values(STATE.scheduleData).forEach(w => {
        if (w && w.slots) {
          Object.values(w.slots).forEach(slot => {
            if (slot && slot.planned > 30) {
              slot.planned = 30;
              hasOverDuration = true;
            }
          });
        }
      });
      if (hasOverDuration) {
        saveStateToStorage();
      }
    } else {
      STATE.scheduleData = {};
    }

    const modeKey = getUserStorageKey('dayflow_schedule_view_mode');
    const savedMode = localStorage.getItem(modeKey);
    if (savedMode && ['day', 'week', 'month'].includes(savedMode)) {
      STATE.scheduleViewMode = savedMode;
    }

    const pendingKey = getUserStorageKey('dayflow_pending_slots');
    const savedPending = localStorage.getItem(pendingKey);
    if (savedPending) {
      try {
        const obj = JSON.parse(savedPending);
        if (obj && typeof obj === 'object') {
          STATE.pendingSlotSaves = obj;
        }
      } catch (e) {}
    } else {
      STATE.pendingSlotSaves = {};
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

    loadCategoriesFromStorage();
  } catch (e) {
    console.error('Failed to load DayFlow state:', e);
  }
}

export function saveStateToStorage() {
  try {
    const key = getUserStorageKey();
    localStorage.setItem(key, JSON.stringify(STATE.scheduleData));
    savePendingSlotsToStorage();
    saveCategoriesToStorage();
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

  // Run all fetches concurrently to shrink the network latency window
  const [apiSlots, apiHabits, apiTodosNotes, apiCategories] = await Promise.all([
    ApiClient.fetchWeekSchedule(weekKey),
    ApiClient.fetchHabits(weekKey),
    ApiClient.fetchTodosAndNotes(weekKey),
    ApiClient.getCategories(true)
  ]);

  if (apiCategories !== null && Array.isArray(apiCategories) && apiCategories.length > 0) {
    STATE.categories = apiCategories;
    saveCategoriesToStorage();
  }

  if (apiSlots !== null && typeof apiSlots === 'object') {
    // Merge server slots, but preserve any local slots that have pending unsaved edits (Finding 41)
    const pending = STATE.pendingSlotSaves || {};
    const mergedSlots = { ...apiSlots };
    for (const [pKey, pEntry] of Object.entries(pending)) {
      if (getSlotWeekKey(pKey) === weekKey && weekData.slots && weekData.slots[pKey]) {
        mergedSlots[pKey] = weekData.slots[pKey];
      }
    }
    weekData.slots = mergedSlots;
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
        const pending = STATE.pendingSlotSaves || {};
        const mergedOther = { ...otherSlots };
        for (const [pKey, pEntry] of Object.entries(pending)) {
          if (getSlotWeekKey(pKey) === mKey && STATE.scheduleData[mKey].slots && STATE.scheduleData[mKey].slots[pKey]) {
            mergedOther[pKey] = STATE.scheduleData[mKey].slots[pKey];
          }
        }
        STATE.scheduleData[mKey].slots = mergedOther;
      }
      if (otherHabits !== null && Array.isArray(otherHabits)) {
        STATE.scheduleData[mKey].habits = otherHabits;
      }
    }));
  }

  // Auto-retry syncing any pending slots that failed to save to server earlier (Finding 41)
  if (STATE.pendingSlotSaves && Object.keys(STATE.pendingSlotSaves).length > 0) {
    const entries = Object.entries(STATE.pendingSlotSaves);
    for (const [pKey, pEntry] of entries) {
      try {
        const ok = await ApiClient.saveSlot(pEntry.weekKey, pKey, pEntry.slotData);
        if (ok) {
          clearSlotPendingSave(pKey);
        }
      } catch (err) {}
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
      [`${monISO}_09:00`]: { title: 'Sprint Planning & Objectives', plannedTask: 'Sprint Planning & Objectives', actualTask: 'Sprint Planning & Objectives', category: 'Work', planned: 60, actual: 60, status: 'Completed', notes: 'Defined weekly priorities and roadmap' },
      [`${monISO}_14:00`]: { title: 'System Architecture Design', plannedTask: 'System Architecture Design', actualTask: 'System Architecture Design', category: 'Work', planned: 90, actual: 90, status: 'Completed', notes: 'Reviewed database schema and scaling' },
      [`${tueISO}_10:30`]: { title: 'Deep Work: Core API Modules', plannedTask: 'Deep Work: Core API Modules', actualTask: 'Deep Work: Core API Modules', category: 'Learning', planned: 60, actual: 60, status: 'Completed', notes: 'Implemented caching & query optimization' },
      [`${wedISO}_09:00`]: { title: 'Focus Session: Responsive UI Revamp', plannedTask: 'Focus Session: Responsive UI Revamp', actualTask: 'Focus Session: Responsive UI Revamp', category: 'Work', planned: 60, actual: 60, status: 'Completed', notes: 'Mobile, tablet and desktop layout audits' },
      [`${wedISO}_14:30`]: { title: 'Algorithm Study & Code Review', plannedTask: 'Algorithm Study & Code Review', actualTask: 'Algorithm Study & Code Review', category: 'Learning', planned: 60, actual: 30, status: 'In-Progress', notes: 'Reviewing performance bottlenecks' },
      [`${thuISO}_11:00`]: { title: 'Client Sync & Deliverable Prep', plannedTask: 'Client Sync & Deliverable Prep', actualTask: 'Client Sync & Deliverable Prep', category: 'Work', planned: 60, actual: 0, status: 'Pending', notes: 'Prepare slide deck and demo' }
    };

    if (weekData.habits.length === 0) {
      weekData.habits = [
        { id: 'demo_h1', name: 'Morning Focus & Planning', pts: 15, time: `${monISO} 08:30`, notes: 'Completed morning routine & planning' },
        { id: 'demo_h2', name: 'Deep Coding & Architecture (2h+)', pts: 15, time: `${tueISO} 10:00`, notes: '2 hours deep coding focus session' },
        { id: 'demo_h3', name: 'Physical Exercise / Health', pts: 15, time: `${wedISO} 07:30`, notes: '30-minute cardio & stretch workout' }
      ];
    }

    if (weekData.todos.length === 0) {
      weekData.todos = [
        { id: 'demo_t1', text: 'Deliver responsive UI revamp across mobile and tablet', priority: 'High', category: 'Work', dueDate: wedISO, completed: true },
        { id: 'demo_t2', text: 'Review weekly focus score and habit completion', priority: 'Medium', category: 'General', dueDate: thuISO, completed: false },
        { id: 'demo_t3', text: 'Study advanced distributed systems patterns', priority: 'High', category: 'Learning', dueDate: '', completed: false }
      ];
    }

    const demoNotes = `# Weekly Focus & Objectives\n\n- [x] Complete responsive UI design revamp\n- [x] Test continuous sweeping across all breakpoints\n- [ ] Ship production update\n\n### Key Highlights\nDiscipline score reached 92% with consistent deep work blocks.`;
    if (weekData.noteSheets && weekData.noteSheets.length > 0) {
      const journalSheet = weekData.noteSheets.find(s => s.id === 'journal') || weekData.noteSheets[0];
      if (journalSheet && !journalSheet.content) {
        journalSheet.content = demoNotes;
      }
      const dailySheet = weekData.noteSheets.find(s => s.id === 'daily_journal');
      if (dailySheet && !dailySheet.content) {
        dailySheet.content = demoNotes;
        if (!dailySheet.dailyContent) dailySheet.dailyContent = {};
        dailySheet.dailyContent[monISO] = demoNotes;
        dailySheet.dailyContent[formatDateISO(new Date())] = demoNotes;
      }
    }
    if (!weekData.notes) {
      weekData.notes = demoNotes;
    }
    const ta = typeof document !== 'undefined' ? document.getElementById('weeklyNotesTextarea') : null;
    if (ta && !ta.value) {
      ta.value = demoNotes;
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
