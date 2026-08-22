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
} from './state.js?v=2.5.2';
import { ApiClient } from './apiClient.js?v=2.5.2';
import { renderGrid } from './grid.js?v=2.5.2';
import { initModal } from './modal.js?v=2.5.2';
import { renderHabits, addHabitLog, renderQuickPresetsUI } from './habits.js?v=2.5.2';
import { renderAnalytics } from './analytics.js?v=2.5.2';
import { renderNotes, initTodoFilterBar } from './notes.js?v=2.5.2';
import { initSettingsUI, USER_SETTINGS } from './settings.js?v=2.5.2';

const DOM = {};

document.addEventListener('DOMContentLoaded', async () => {
  cacheDomElements();
  loadStateFromStorage();
  initModal(DOM.modalElements, renderAll);
  initSettingsUI(DOM, renderAll);
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
  DOM.currentWeekRange = document.getElementById('currentWeekRange');
  DOM.weekDatePicker = document.getElementById('weekDatePicker');

  DOM.categoryFilter = document.getElementById('categoryFilter');
  DOM.exportBtn = document.getElementById('exportBtn');
  DOM.importBtn = document.getElementById('importBtn');
  DOM.importFileInput = document.getElementById('importFileInput');

  DOM.scheduleTableBody = document.getElementById('scheduleTableBody');

  DOM.habitQuickActionsContainer = document.querySelector('.habit-quick-actions');
  DOM.habitQuickBtns = document.querySelectorAll('.habit-btn');
  DOM.customHabitForm = document.getElementById('customHabitForm');
  DOM.habitDateInput = document.getElementById('habitDateInput');
  DOM.habitDateTodayBtn = document.getElementById('habitDateTodayBtn');
  DOM.habitDateYesterdayBtn = document.getElementById('habitDateYesterdayBtn');
  DOM.habitDatePrevDayBtn = document.getElementById('habitDatePrevDayBtn');
  DOM.habitNameInput = document.getElementById('habitNameInput');
  DOM.habitPointsInput = document.getElementById('habitPointsInput');
  DOM.habitNotesInput = document.getElementById('habitNotesInput');
  DOM.habitLogTableBody = document.getElementById('habitLogTableBody');
  DOM.totalPointsBadge = document.getElementById('totalPointsBadge');

  DOM.statPlannedHours = document.getElementById('statPlannedHours');
  DOM.statActualHours = document.getElementById('statActualHours');
  DOM.statScore = document.getElementById('statScore');
  DOM.statHabitPoints = document.getElementById('statHabitPoints');
  DOM.categoryBarsContainer = document.getElementById('categoryBarsContainer');
  DOM.habitTotalActionsCount = document.getElementById('habitTotalActionsCount');
  DOM.habitBreakdownContainer = document.getElementById('habitBreakdownContainer');
  DOM.habitDailyTrendContainer = document.getElementById('habitDailyTrendContainer');
  DOM.analyticsSubtitle = document.getElementById('analyticsSubtitle');
  DOM.analyticsTrendHeading = document.getElementById('analyticsTrendHeading');
  DOM.analyticsTrendSubtitle = document.getElementById('analyticsTrendSubtitle');

  DOM.addTodoForm = document.getElementById('addTodoForm');
  DOM.todoInput = document.getElementById('todoInput');
  DOM.todoPrioritySelect = document.getElementById('todoPrioritySelect');
  DOM.todoCategorySelect = document.getElementById('todoCategorySelect');
  DOM.todoFilterBar = document.getElementById('todoFilterBar');
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
  
  loadStateFromStorage();
  if (DOM.habitDateInput && !DOM.habitDateInput.value) {
    DOM.habitDateInput.value = formatDateISO(new Date());
  }
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
    btn.addEventListener('click', async () => {
      DOM.navBtns.forEach(b => b.classList.remove('active'));
      DOM.viewPanels.forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const view = btn.dataset.view;
      STATE.activeView = view;
      const targetPanel = document.getElementById(`view-${view}`);
      if (targetPanel) targetPanel.classList.add('active');

      const controlsBar = document.querySelector('.controls-bar');
      if (controlsBar) {
        if (view === 'settings') {
          controlsBar.style.display = 'none';
        } else {
          controlsBar.style.display = 'flex';
        }
      }

      renderAll();
      if (view !== 'settings') {
        await syncWeekDataWithApi(renderAll);
      }
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

  // Navigation Buttons
  DOM.prevWeekBtn.addEventListener('click', () => navigateDate('prev'));
  DOM.nextWeekBtn.addEventListener('click', () => navigateDate('next'));
  DOM.todayBtn.addEventListener('click', () => navigateDate('today'));

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



  // Habit Target Date Quick Pills & Picker
  if (DOM.habitDateTodayBtn) {
    DOM.habitDateTodayBtn.addEventListener('click', () => {
      setHabitLogDate(new Date());
    });
  }

  if (DOM.habitDateYesterdayBtn) {
    DOM.habitDateYesterdayBtn.addEventListener('click', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      setHabitLogDate(yesterday);
    });
  }

  if (DOM.habitDatePrevDayBtn) {
    DOM.habitDatePrevDayBtn.addEventListener('click', () => {
      const prevDay = new Date();
      prevDay.setDate(prevDay.getDate() - 2);
      setHabitLogDate(prevDay);
    });
  }

  if (DOM.habitDateInput) {
    DOM.habitDateInput.addEventListener('change', (e) => {
      const val = e.target.value;
      if (val) {
        const [y, m, d] = val.split('-').map(Number);
        setHabitLogDate(new Date(y, m - 1, d));
      }
    });
  }

  DOM.customHabitForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = DOM.habitNameInput.value.trim();
    const pts = parseInt(DOM.habitPointsInput.value, 10) || 0;
    const notes = DOM.habitNotesInput.value.trim();
    const selectedDate = (DOM.habitDateInput && DOM.habitDateInput.value) ? DOM.habitDateInput.value : formatDateISO(new Date());
    if (name) {
      addHabitLog(name, pts, notes, DOM.habitLogTableBody, DOM.totalPointsBadge, selectedDate);
      DOM.habitNameInput.value = '';
      DOM.habitNotesInput.value = '';
    }
  });

  if (DOM.todoFilterBar) {
    initTodoFilterBar(DOM.todoFilterBar, DOM.todoList, DOM.weeklyNotesTextarea);
  }

  DOM.addTodoForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = DOM.todoInput.value.trim();
    const priority = DOM.todoPrioritySelect ? DOM.todoPrioritySelect.value : 'Medium';
    const category = DOM.todoCategorySelect ? DOM.todoCategorySelect.value : 'General';
    if (text) {
      const weekKey = getWeekKey(STATE.currentWeekStart);
      const weekData = getCurrentWeekData();
      if (!weekData.todos) weekData.todos = [];
      const tempId = Date.now();
      const localTodo = { id: tempId, text, priority, category, completed: false };
      weekData.todos.push(localTodo);
      DOM.todoInput.value = '';
      saveStateToStorage();
      renderNotes(DOM.todoList, DOM.weeklyNotesTextarea);

      // Sync todo with API and patch server-assigned ID
      const apiRes = await ApiClient.addTodo(weekKey, text, priority, category);
      if (apiRes && apiRes.todo && apiRes.todo.id) {
        localTodo.id = apiRes.todo.id;
        saveStateToStorage();
        renderNotes(DOM.todoList, DOM.weeklyNotesTextarea);
      }
    }
  });

  DOM.weeklyNotesTextarea.addEventListener('input', () => {
    const weekKey = getWeekKey(STATE.currentWeekStart);
    const weekData = getCurrentWeekData();
    weekData.notes = DOM.weeklyNotesTextarea.value;
    saveStateToStorage();
    DOM.notesSavedStatus.textContent = 'Saving...';
    
    // Sync notes with API
    ApiClient.saveNotes(weekKey, weekData.notes);
    setTimeout(() => DOM.notesSavedStatus.textContent = 'Saved', 500);
  });
}

async function navigateDate(direction) {
  if (direction === 'today') {
    const now = new Date();
    STATE.selectedDate = now;
    STATE.currentWeekStart = getMonday(now);
  } else {
    const step = direction === 'next' ? 1 : -1;
    if (STATE.scheduleViewMode === 'day') {
      const cur = STATE.selectedDate || new Date();
      STATE.selectedDate = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + step);
      STATE.currentWeekStart = getMonday(STATE.selectedDate);
    } else if (STATE.scheduleViewMode === 'month') {
      const cur = STATE.selectedDate || new Date();
      STATE.selectedDate = new Date(cur.getFullYear(), cur.getMonth() + step, 1);
      STATE.currentWeekStart = getMonday(STATE.selectedDate);
    } else {
      const cur = STATE.currentWeekStart;
      STATE.currentWeekStart = getMonday(new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + (step * 7)));
      STATE.selectedDate = STATE.currentWeekStart;
    }
  }
  ensureSampleDataForCurrentWeek();
  renderAll();
  await syncWeekDataWithApi(renderAll);
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
  if (STATE.activeView === 'habits') {
    renderQuickPresetsUI(DOM.habitQuickActionsContainer, DOM.habitLogTableBody, DOM.totalPointsBadge, () => DOM.habitDateInput?.value);
    renderHabits(DOM.habitLogTableBody, DOM.totalPointsBadge);
  }
  if (STATE.activeView === 'analytics') {
    renderAnalytics(
      DOM.statPlannedHours,
      DOM.statActualHours,
      DOM.statScore,
      DOM.statHabitPoints,
      DOM.categoryBarsContainer,
      DOM.habitTotalActionsCount,
      DOM.habitBreakdownContainer,
      DOM.habitDailyTrendContainer,
      DOM.analyticsSubtitle,
      DOM.analyticsTrendHeading,
      DOM.analyticsTrendSubtitle
    );
  }
  if (STATE.activeView === 'notes') renderNotes(DOM.todoList, DOM.weeklyNotesTextarea, renderAll);
}

function updateHabitDatePillStates(dateStr) {
  const todayStr = formatDateISO(new Date());
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = formatDateISO(yesterday);
  const prevDay = new Date();
  prevDay.setDate(prevDay.getDate() - 2);
  const prevDayStr = formatDateISO(prevDay);

  if (DOM.habitDateTodayBtn) DOM.habitDateTodayBtn.classList.toggle('active', dateStr === todayStr);
  if (DOM.habitDateYesterdayBtn) DOM.habitDateYesterdayBtn.classList.toggle('active', dateStr === yesterdayStr);
  if (DOM.habitDatePrevDayBtn) DOM.habitDatePrevDayBtn.classList.toggle('active', dateStr === prevDayStr);
}

function setHabitLogDate(targetDate) {
  const dateStr = formatDateISO(targetDate);
  if (DOM.habitDateInput) {
    DOM.habitDateInput.value = dateStr;
  }
  updateHabitDatePillStates(dateStr);

  // If in Day view mode, synchronize the schedule view date as well
  if (STATE.scheduleViewMode === 'day') {
    STATE.selectedDate = targetDate;
    STATE.currentWeekStart = getMonday(targetDate);
    ensureSampleDataForCurrentWeek();
    renderAll();
  }
}

function renderHeaderRangeText() {
  const selDate = STATE.selectedDate || new Date();

  if (DOM.habitDateInput && !DOM.habitDateInput.value) {
    DOM.habitDateInput.value = formatDateISO(selDate);
    updateHabitDatePillStates(DOM.habitDateInput.value);
  } else if (DOM.habitDateInput) {
    updateHabitDatePillStates(DOM.habitDateInput.value);
  }

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
  const viewMode = STATE.scheduleViewMode || 'week';
  const selDate = STATE.selectedDate || new Date();
  const selDateISO = formatDateISO(selDate);
  const currentWeekKey = getWeekKey(STATE.currentWeekStart);

  let exportPayload = {};
  let filename = '';

  if (viewMode === 'day') {
    // Day Scope
    const weekData = STATE.scheduleData[currentWeekKey] || { slots: {}, habits: [], todos: [], notes: '' };
    const daySlots = {};
    Object.entries(weekData.slots || {}).forEach(([k, s]) => {
      if (k.startsWith(selDateISO)) {
        daySlots[k] = s;
      }
    });

    const dayHabits = (weekData.habits || []).filter(h => {
      if (h.time && h.time.startsWith(selDateISO)) return true;
      return false;
    });

    exportPayload = {
      exportType: 'Day',
      exportVersion: '2.5.1',
      exportDate: selDateISO,
      weekKey: currentWeekKey,
      slots: daySlots,
      habits: dayHabits,
      notes: weekData.notes || ''
    };
    filename = `DayFlow_Export_Day_${selDateISO}.json`;

  } else if (viewMode === 'month') {
    // Month Scope
    const monthPrefix = selDateISO.slice(0, 7); // e.g. "2026-08"
    const monthWeeks = {};

    Object.entries(STATE.scheduleData || {}).forEach(([wKey, wData]) => {
      const monthSlots = {};
      let hasMonthData = false;

      Object.entries(wData.slots || {}).forEach(([sKey, slot]) => {
        if (sKey.startsWith(monthPrefix)) {
          monthSlots[sKey] = slot;
          hasMonthData = true;
        }
      });

      const monthHabits = (wData.habits || []).filter(h => {
        if (h.time && h.time.startsWith(monthPrefix)) return true;
        return false;
      });
      if (monthHabits.length > 0) hasMonthData = true;

      if (hasMonthData || wKey.startsWith(monthPrefix)) {
        monthWeeks[wKey] = {
          slots: monthSlots,
          habits: monthHabits,
          todos: wData.todos || [],
          notes: wData.notes || ''
        };
      }
    });

    exportPayload = {
      exportType: 'Month',
      exportVersion: '2.5.1',
      exportMonth: monthPrefix,
      weeks: monthWeeks
    };
    filename = `DayFlow_Export_Month_${monthPrefix}.json`;

  } else {
    // Week Scope (Default)
    const weekData = STATE.scheduleData[currentWeekKey] || { slots: {}, habits: [], todos: [], notes: '' };
    exportPayload = {
      exportType: 'Week',
      exportVersion: '2.5.1',
      exportWeekStart: currentWeekKey,
      weekKey: currentWeekKey,
      slots: weekData.slots || {},
      habits: weekData.habits || [],
      todos: weekData.todos || [],
      notes: weekData.notes || ''
    };
    filename = `DayFlow_Export_Week_${currentWeekKey}.json`;
  }

  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportPayload, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", filename);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

function importDataJson(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (evt) => {
    try {
      const imported = JSON.parse(evt.target.result);
      if (!imported || typeof imported !== 'object') {
        alert('Invalid JSON file format.');
        return;
      }

      if (imported.exportType === 'Day' && imported.weekKey) {
        // Merge single Day
        const wKey = imported.weekKey;
        if (!STATE.scheduleData[wKey]) {
          STATE.scheduleData[wKey] = { slots: {}, habits: [], todos: [], notes: '' };
        }
        Object.assign(STATE.scheduleData[wKey].slots, imported.slots || {});
        if (Array.isArray(imported.habits)) {
          STATE.scheduleData[wKey].habits = (STATE.scheduleData[wKey].habits || []).concat(imported.habits);
        }
        alert(`DayFlow data for ${imported.exportDate} imported successfully!`);

      } else if (imported.exportType === 'Week' && (imported.exportWeekStart || imported.weekKey)) {
        // Merge single Week
        const wKey = imported.exportWeekStart || imported.weekKey;
        STATE.scheduleData[wKey] = {
          slots: imported.slots || {},
          habits: imported.habits || [],
          todos: imported.todos || [],
          notes: imported.notes || ''
        };
        alert(`DayFlow weekly schedule for week ${wKey} imported successfully!`);

      } else if (imported.exportType === 'Month' && imported.weeks) {
        // Merge Month weeks
        Object.entries(imported.weeks).forEach(([wKey, wData]) => {
          STATE.scheduleData[wKey] = wData;
        });
        alert(`DayFlow monthly data for ${imported.exportMonth} imported successfully!`);

      } else if (imported.scheduleData && typeof imported.scheduleData === 'object') {
        // Full user archive format (from Settings page)
        STATE.scheduleData = imported.scheduleData;
        alert('DayFlow full database archive imported successfully!');

      } else {
        // Legacy raw scheduleData format
        STATE.scheduleData = imported;
        alert('DayFlow schedule data imported successfully!');
      }

      saveStateToStorage();
      renderAll();
      await syncWeekDataWithApi(renderAll);
    } catch (err) {
      console.error('Import error:', err);
      alert('Error parsing JSON file.');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}
