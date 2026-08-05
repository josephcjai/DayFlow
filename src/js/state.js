/**
 * DayFlow State & Storage Manager
 * Ensures entered tasks are preserved and un-entered slots remain blank
 */

export const STATE = {
  currentWeekStart: getMonday(new Date()),
  selectedCategoryFilter: 'ALL',
  activeView: 'grid',
  activeSlotKey: null,
  scheduleData: {},
};

export function getMonday(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.getFullYear(), date.getMonth(), diff, 0, 0, 0, 0);
}

export function getWeekKey(date) {
  const monday = getMonday(date);
  const y = monday.getFullYear();
  const m = String(monday.getMonth() + 1).padStart(2, '0');
  const d = String(monday.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getWeekDates(mondayDate) {
  const dates = [];
  const start = getMonday(mondayDate);
  for (let i = 0; i < 7; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${day}`);
  }
  return dates;
}

export function loadStateFromStorage() {
  try {
    const stored = localStorage.getItem('dayflow_v2_data');
    if (stored) {
      STATE.scheduleData = JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to load DayFlow state:', e);
  }
}

export function saveStateToStorage() {
  try {
    localStorage.setItem('dayflow_v2_data', JSON.stringify(STATE.scheduleData));
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
