/**
 * DayFlow State & Storage Manager
 * Supports Day, Week, and Month schedule view modes with PostgreSQL & namespaced local storage sync
 */
import { ApiClient } from './apiClient.js?v=2.4.0';

export const STATE = {
  currentWeekStart: getMonday(new Date()),
  selectedDate: new Date(),
  scheduleViewMode: 'week', // 'day' | 'week' | 'month'
  selectedCategoryFilter: 'ALL',
  activeView: 'grid',
  activeSlotKey: null,
  scheduleData: {},
};

export function setScheduleViewMode(mode) {
  STATE.scheduleViewMode = mode;
}

export function formatDateISO(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
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

export function getUserStorageKey() {
  const userJson = localStorage.getItem('dayflow_user');
  if (userJson) {
    try {
      const u = JSON.parse(userJson);
      if (u && u.id) return `dayflow_data_${u.id}`;
    } catch (e) {}
  }
  return 'dayflow_data_guest';
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
      notes: ''
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
