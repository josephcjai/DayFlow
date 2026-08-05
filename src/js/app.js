/**
 * DayFlow Main Entry Point & Router
 */
import {
  STATE,
  getMonday,
  getWeekDates,
  getWeekKey,
  loadStateFromStorage,
  ensureSampleDataForCurrentWeek,
  saveStateToStorage,
  getCurrentWeekData
} from './state.js';
import { renderGrid } from './grid.js';
import { initModal } from './modal.js';
import { renderHabits, addHabitLog } from './habits.js';
import { renderAnalytics } from './analytics.js';
import { renderNotes } from './notes.js';

const DOM = {};

document.addEventListener('DOMContentLoaded', () => {
  cacheDomElements();
  loadStateFromStorage();
  ensureSampleDataForCurrentWeek();
  initModal(DOM.modalElements, renderAll);
  bindEvents();
  renderAll();
});

function cacheDomElements() {
  DOM.navBtns = document.querySelectorAll('.nav-btn');
  DOM.viewPanels = document.querySelectorAll('.view-panel');

  DOM.prevWeekBtn = document.getElementById('prevWeekBtn');
  DOM.nextWeekBtn = document.getElementById('nextWeekBtn');
  DOM.todayBtn = document.getElementById('todayBtn');
  DOM.weekDatePicker = document.getElementById('weekDatePicker');
  DOM.currentWeekRange = document.getElementById('currentWeekRange');
  DOM.categoryFilter = document.getElementById('categoryFilter');
  DOM.exportBtn = document.getElementById('exportBtn');
  DOM.importBtn = document.getElementById('importBtn');
  DOM.importFileInput = document.getElementById('importFileInput');

  DOM.scheduleTableBody = document.getElementById('scheduleTableBody');

  DOM.habitQuickBtns = document.querySelectorAll('.habit-btn');
  DOM.customHabitForm = document.getElementById('customHabitForm');
  DOM.habitNameInput = document.getElementById('habitNameInput');
  DOM.habitPointsInput = document.getElementById('habitPointsInput');
  DOM.habitNotesInput = document.getElementById('habitNotesInput');
  DOM.habitLogTableBody = document.getElementById('habitLogTableBody');
  DOM.totalPointsBadge = document.getElementById('totalPointsBadge');

  DOM.statPlannedHours = document.getElementById('statPlannedHours');
  DOM.statActualHours = document.getElementById('statActualHours');
  DOM.statScore = document.getElementById('statScore');
  DOM.categoryBarsContainer = document.getElementById('categoryBarsContainer');

  DOM.addTodoForm = document.getElementById('addTodoForm');
  DOM.todoInput = document.getElementById('todoInput');
  DOM.todoList = document.getElementById('todoList');
  DOM.weeklyNotesTextarea = document.getElementById('weeklyNotesTextarea');
  DOM.notesSavedStatus = document.getElementById('notesSavedStatus');

  DOM.modalElements = {
    taskModal: document.getElementById('taskModal'),
    closeModalBtn: document.getElementById('closeModalBtn'),
    modalTitle: document.getElementById('modalTitle'),
    modalSlotDay: document.getElementById('modalSlotDay'),
    modalSlotTime: document.getElementById('modalSlotTime'),
    taskForm: document.getElementById('taskForm'),
    plannedTaskInput: document.getElementById('plannedTaskInput'),
    actualTaskInput: document.getElementById('actualTaskInput'),
    plannedLockMsg: document.getElementById('plannedLockMsg'),
    taskCategorySelect: document.getElementById('taskCategorySelect'),
    taskStatusSelect: document.getElementById('taskStatusSelect'),
    plannedDurationInput: document.getElementById('plannedDurationInput'),
    actualDurationInput: document.getElementById('actualDurationInput'),
    taskNotesInput: document.getElementById('taskNotesInput'),
    deleteTaskBtn: document.getElementById('deleteTaskBtn')
  };
}

function bindEvents() {
  DOM.navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      DOM.navBtns.forEach(b => b.classList.remove('active'));
      DOM.viewPanels.forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const view = btn.dataset.view;
      STATE.activeView = view;
      document.getElementById(`view-${view}`).classList.add('active');
      renderAll();
    });
  });

  DOM.prevWeekBtn.addEventListener('click', () => {
    const cur = STATE.currentWeekStart;
    STATE.currentWeekStart = getMonday(new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() - 7));
    ensureSampleDataForCurrentWeek();
    renderAll();
  });

  DOM.nextWeekBtn.addEventListener('click', () => {
    const cur = STATE.currentWeekStart;
    STATE.currentWeekStart = getMonday(new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 7));
    ensureSampleDataForCurrentWeek();
    renderAll();
  });

  DOM.todayBtn.addEventListener('click', () => {
    STATE.currentWeekStart = getMonday(new Date());
    ensureSampleDataForCurrentWeek();
    renderAll();
  });

  DOM.weekDatePicker.addEventListener('change', (e) => {
    const val = e.target.value;
    if (val) {
      const [y, m, d] = val.split('-').map(Number);
      const pickedDate = new Date(y, m - 1, d);
      STATE.currentWeekStart = getMonday(pickedDate);
      ensureSampleDataForCurrentWeek();
      renderAll();
    }
  });

  DOM.categoryFilter.addEventListener('change', (e) => {
    STATE.selectedCategoryFilter = e.target.value;
    renderGrid(DOM.scheduleTableBody);
    renderAnalytics(DOM.statPlannedHours, DOM.statActualHours, DOM.statScore, DOM.categoryBarsContainer);
  });

  DOM.exportBtn.addEventListener('click', exportDataJson);
  DOM.importBtn.addEventListener('click', () => DOM.importFileInput.click());
  DOM.importFileInput.addEventListener('change', importDataJson);

  DOM.habitQuickBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      addHabitLog(btn.dataset.habit, parseInt(btn.dataset.pts, 10), "Quick trigger action", DOM.habitLogTableBody, DOM.totalPointsBadge);
    });
  });

  DOM.customHabitForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = DOM.habitNameInput.value.trim();
    const pts = parseInt(DOM.habitPointsInput.value, 10) || 0;
    const notes = DOM.habitNotesInput.value.trim();
    if (name) {
      addHabitLog(name, pts, notes, DOM.habitLogTableBody, DOM.totalPointsBadge);
      DOM.habitNameInput.value = '';
      DOM.habitNotesInput.value = '';
    }
  });

  DOM.addTodoForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = DOM.todoInput.value.trim();
    if (text) {
      const weekData = getCurrentWeekData();
      weekData.todos.push({ id: Date.now(), text, completed: false });
      DOM.todoInput.value = '';
      saveStateToStorage();
      renderNotes(DOM.todoList, DOM.weeklyNotesTextarea);
    }
  });

  DOM.weeklyNotesTextarea.addEventListener('input', () => {
    const weekData = getCurrentWeekData();
    weekData.notes = DOM.weeklyNotesTextarea.value;
    saveStateToStorage();
    DOM.notesSavedStatus.textContent = 'Saving...';
    setTimeout(() => DOM.notesSavedStatus.textContent = 'Saved', 500);
  });
}

function renderAll() {
  renderWeekHeader();
  if (STATE.activeView === 'grid') renderGrid(DOM.scheduleTableBody);
  if (STATE.activeView === 'habits') renderHabits(DOM.habitLogTableBody, DOM.totalPointsBadge);
  if (STATE.activeView === 'analytics') renderAnalytics(DOM.statPlannedHours, DOM.statActualHours, DOM.statScore, DOM.categoryBarsContainer);
  if (STATE.activeView === 'notes') renderNotes(DOM.todoList, DOM.weeklyNotesTextarea);
}

function renderWeekHeader() {
  const dates = getWeekDates(STATE.currentWeekStart);
  const monDate = new Date(dates[0] + 'T00:00:00');
  const sunDate = new Date(dates[6] + 'T00:00:00');

  const startStr = formatDateShort(monDate);
  const endStr = formatDateShort(sunDate);
  const yearStr = sunDate.getFullYear();

  DOM.currentWeekRange.textContent = `Mon, ${startStr} – Sun, ${endStr}, ${yearStr}`;
  DOM.weekDatePicker.value = dates[0];

  for (let i = 1; i <= 7; i++) {
    const parts = dates[i - 1].split('-');
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    const el = document.getElementById(`date-${i}`);
    if (el) el.textContent = `${m}/${d}`;
  }
}

function formatDateShort(dateObj) {
  return dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function exportDataJson() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(STATE.scheduleData, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `DayFlow_Backup_${getWeekKey(STATE.currentWeekStart)}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

function importDataJson(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (evt) => {
    try {
      const imported = JSON.parse(evt.target.result);
      if (typeof imported === 'object') {
        STATE.scheduleData = imported;
        saveStateToStorage();
        renderAll();
        alert('DayFlow schedule data imported successfully!');
      }
    } catch (err) {
      alert('Invalid JSON file format.');
    }
  };
  reader.readAsText(file);
}
