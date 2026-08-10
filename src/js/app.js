/**
 * DayFlow Main Entry Point & Router
 * Enforces mandatory login screen gate, multi-view (Day/Week/Month) switching, and user-isolated PostgreSQL sync
 */
import {
  STATE,
  getMonday,
  getWeekDates,
  getWeekKey,
  formatDateISO,
  loadStateFromStorage,
  syncWeekDataWithApi,
  ensureSampleDataForCurrentWeek,
  saveStateToStorage,
  getCurrentWeekData
} from './state.js?v=2.3';
import { ApiClient } from './apiClient.js?v=2.3';
import { renderGrid } from './grid.js?v=2.3';
import { initModal } from './modal.js?v=2.3';
import { renderHabits, addHabitLog } from './habits.js?v=2.3';
import { renderAnalytics } from './analytics.js?v=2.3';
import { renderNotes } from './notes.js?v=2.3';

const DOM = {};

document.addEventListener('DOMContentLoaded', async () => {
  cacheDomElements();
  loadStateFromStorage();
  initModal(DOM.modalElements, renderAll);
  bindEvents();
  initAuthUI();
  
  // Check active user session gate
  await checkUserSessionGate();
});

function cacheDomElements() {
  DOM.loginScreen = document.getElementById('loginScreen');
  DOM.app = document.getElementById('app');

  DOM.navBtns = document.querySelectorAll('.nav-btn');
  DOM.viewPanels = document.querySelectorAll('.view-panel');

  DOM.viewModeBtns = document.querySelectorAll('.view-mode-btn');

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

  // Auth Landing Gate Elements
  DOM.userDisplayName = document.getElementById('userDisplayName');
  DOM.logoutBtn = document.getElementById('logoutBtn');
  DOM.tabLandingSignIn = document.getElementById('tabLandingSignIn');
  DOM.tabLandingRegister = document.getElementById('tabLandingRegister');
  DOM.landingLoginForm = document.getElementById('landingLoginForm');
  DOM.landingRegisterForm = document.getElementById('landingRegisterForm');
  DOM.landingLoginEmail = document.getElementById('landingLoginEmail');
  DOM.landingLoginPassword = document.getElementById('landingLoginPassword');
  DOM.landingLoginErrorMsg = document.getElementById('landingLoginErrorMsg');
  DOM.landingRegisterName = document.getElementById('landingRegisterName');
  DOM.landingRegisterEmail = document.getElementById('landingRegisterEmail');
  DOM.landingRegisterPassword = document.getElementById('landingRegisterPassword');
  DOM.landingRegisterErrorMsg = document.getElementById('landingRegisterErrorMsg');

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

function initAuthUI() {
  DOM.tabLandingSignIn.addEventListener('click', () => switchLandingTab('signin'));
  DOM.tabLandingRegister.addEventListener('click', () => switchLandingTab('register'));

  DOM.landingLoginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    DOM.landingLoginErrorMsg.style.display = 'none';
    try {
      const email = DOM.landingLoginEmail.value.trim();
      const password = DOM.landingLoginPassword.value;
      const res = await ApiClient.login(email, password);
      
      localStorage.setItem('dayflow_token', res.token);
      localStorage.setItem('dayflow_user', JSON.stringify(res.user));
      
      await onAuthSuccess(res.user);
    } catch (err) {
      DOM.landingLoginErrorMsg.textContent = err.message;
      DOM.landingLoginErrorMsg.style.display = 'block';
    }
  });

  DOM.landingRegisterForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    DOM.landingRegisterErrorMsg.style.display = 'none';
    try {
      const name = DOM.landingRegisterName.value.trim();
      const email = DOM.landingRegisterEmail.value.trim();
      const password = DOM.landingRegisterPassword.value;
      const res = await ApiClient.register(email, password, name);

      localStorage.setItem('dayflow_token', res.token);
      localStorage.setItem('dayflow_user', JSON.stringify(res.user));

      await onAuthSuccess(res.user);
    } catch (err) {
      DOM.landingRegisterErrorMsg.textContent = err.message;
      DOM.landingRegisterErrorMsg.style.display = 'block';
    }
  });

  DOM.logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('dayflow_token');
    localStorage.removeItem('dayflow_user');
    STATE.scheduleData = {};
    showLoginScreen();
  });
}

async function checkUserSessionGate() {
  const token = localStorage.getItem('dayflow_token');
  const storedUser = localStorage.getItem('dayflow_user');

  if (token && storedUser) {
    try {
      const user = JSON.parse(storedUser);
      await onAuthSuccess(user);
      return;
    } catch (e) {}
  }
  
  // Unauthenticated -> Show Login Screen
  showLoginScreen();
}

async function onAuthSuccess(user) {
  DOM.userDisplayName.textContent = user.displayName || user.email.split('@')[0];
  DOM.loginScreen.style.display = 'none';
  DOM.app.style.display = 'flex';
  
  STATE.scheduleData = {};
  ensureSampleDataForCurrentWeek();
  renderAll();
  await syncWeekDataWithApi(renderAll);
}

function showLoginScreen() {
  DOM.app.style.display = 'none';
  DOM.loginScreen.style.display = 'flex';
  switchLandingTab('signin');
}

function switchLandingTab(tab) {
  if (tab === 'signin') {
    DOM.tabLandingSignIn.classList.add('active');
    DOM.tabLandingRegister.classList.remove('active');
    DOM.landingLoginForm.style.display = 'block';
    DOM.landingRegisterForm.style.display = 'none';
  } else {
    DOM.tabLandingRegister.classList.add('active');
    DOM.tabLandingSignIn.classList.remove('active');
    DOM.landingLoginForm.style.display = 'none';
    DOM.landingRegisterForm.style.display = 'block';
  }
}

function bindEvents() {
  // Navigation Tabs
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

  // Schedule View Granularity Selector (Day / Week / Month)
  DOM.viewModeBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      DOM.viewModeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      STATE.scheduleViewMode = btn.dataset.mode;
      renderAll();
      await syncWeekDataWithApi(renderAll);
    });
  });

  // Prev Button (Day / Week / Month)
  DOM.prevWeekBtn.addEventListener('click', async () => {
    if (STATE.scheduleViewMode === 'day') {
      const cur = STATE.selectedDate || new Date();
      STATE.selectedDate = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() - 1);
      STATE.currentWeekStart = getMonday(STATE.selectedDate);
    } else if (STATE.scheduleViewMode === 'month') {
      const cur = STATE.selectedDate || new Date();
      STATE.selectedDate = new Date(cur.getFullYear(), cur.getMonth() - 1, 1);
      STATE.currentWeekStart = getMonday(STATE.selectedDate);
    } else {
      const cur = STATE.currentWeekStart;
      STATE.currentWeekStart = getMonday(new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() - 7));
      STATE.selectedDate = STATE.currentWeekStart;
    }
    ensureSampleDataForCurrentWeek();
    renderAll();
    await syncWeekDataWithApi(renderAll);
  });

  // Next Button (Day / Week / Month)
  DOM.nextWeekBtn.addEventListener('click', async () => {
    if (STATE.scheduleViewMode === 'day') {
      const cur = STATE.selectedDate || new Date();
      STATE.selectedDate = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1);
      STATE.currentWeekStart = getMonday(STATE.selectedDate);
    } else if (STATE.scheduleViewMode === 'month') {
      const cur = STATE.selectedDate || new Date();
      STATE.selectedDate = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
      STATE.currentWeekStart = getMonday(STATE.selectedDate);
    } else {
      const cur = STATE.currentWeekStart;
      STATE.currentWeekStart = getMonday(new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 7));
      STATE.selectedDate = STATE.currentWeekStart;
    }
    ensureSampleDataForCurrentWeek();
    renderAll();
    await syncWeekDataWithApi(renderAll);
  });

  // Today Button
  DOM.todayBtn.addEventListener('click', async () => {
    const now = new Date();
    STATE.selectedDate = now;
    STATE.currentWeekStart = getMonday(now);
    ensureSampleDataForCurrentWeek();
    renderAll();
    await syncWeekDataWithApi(renderAll);
  });

  // Date Picker
  DOM.weekDatePicker.addEventListener('change', async (e) => {
    const val = e.target.value;
    if (val) {
      const [y, m, d] = val.split('-').map(Number);
      const pickedDate = new Date(y, m - 1, d);
      STATE.selectedDate = pickedDate;
      STATE.currentWeekStart = getMonday(pickedDate);
      ensureSampleDataForCurrentWeek();
      renderAll();
      await syncWeekDataWithApi(renderAll);
    }
  });

  DOM.categoryFilter.addEventListener('change', (e) => {
    STATE.selectedCategoryFilter = e.target.value;
    renderGrid(DOM.scheduleTableBody, handleSwitchToDayView);
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

async function handleSwitchToDayView(targetDateStr) {
  const [y, m, d] = targetDateStr.split('-').map(Number);
  const targetDate = new Date(y, m - 1, d);
  STATE.selectedDate = targetDate;
  STATE.currentWeekStart = getMonday(targetDate);
  STATE.scheduleViewMode = 'day';

  DOM.viewModeBtns.forEach(b => {
    if (b.dataset.mode === 'day') b.classList.add('active');
    else b.classList.remove('active');
  });

  renderAll();
  await syncWeekDataWithApi(renderAll);
}

function renderAll() {
  renderHeaderRangeText();
  if (STATE.activeView === 'grid') renderGrid(DOM.scheduleTableBody, handleSwitchToDayView);
  if (STATE.activeView === 'habits') renderHabits(DOM.habitLogTableBody, DOM.totalPointsBadge);
  if (STATE.activeView === 'analytics') renderAnalytics(DOM.statPlannedHours, DOM.statActualHours, DOM.statScore, DOM.categoryBarsContainer);
  if (STATE.activeView === 'notes') renderNotes(DOM.todoList, DOM.weeklyNotesTextarea);
}

function renderHeaderRangeText() {
  const selDate = STATE.selectedDate || new Date();

  if (STATE.scheduleViewMode === 'day') {
    const dayFull = selDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
    DOM.currentWeekRange.textContent = dayFull;
    DOM.weekDatePicker.value = formatDateISO(selDate);
  } else if (STATE.scheduleViewMode === 'month') {
    const monthFull = selDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    DOM.currentWeekRange.textContent = monthFull;
    DOM.weekDatePicker.value = formatDateISO(selDate);
  } else {
    const dates = getWeekDates(STATE.currentWeekStart);
    const monDate = new Date(dates[0] + 'T00:00:00');
    const sunDate = new Date(dates[6] + 'T00:00:00');

    const startStr = formatDateShort(monDate);
    const endStr = formatDateShort(sunDate);
    const yearStr = sunDate.getFullYear();

    DOM.currentWeekRange.textContent = `Mon, ${startStr} – Sun, ${endStr}, ${yearStr}`;
    DOM.weekDatePicker.value = dates[0];
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
