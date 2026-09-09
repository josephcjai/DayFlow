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
  formatDateDisplay,
  formatDateDisplayShort,
  loadStateFromStorage,
  syncWeekDataWithApi,
  ensureSampleDataForCurrentWeek,
  saveStateToStorage,
  getCurrentWeekData,
  isSlotInFuture,
  getSlotWeekKey,
  recordUndoAction
} from './state.js?v=2.6.3';
import { ApiClient } from './apiClient.js?v=2.6.3';
import { renderGrid, selectSlotCell, clearSlotSelection, clearCopiedSource, getAdjacentSlotKey } from './grid.js?v=2.6.3';
import { initModal, openTaskModal } from './modal.js?v=2.6.3';
import { renderHabits, addHabitLog, renderQuickPresetsUI } from './habits.js?v=2.6.3';
import { renderAnalytics, initPointsBreakdownModal } from './analytics.js?v=2.6.3';
import { renderNotes, initTodoFilterBar, initMarkdownScratchpad, getActiveSheetId } from './notes.js?v=2.6.3';
import { initSettingsUI, USER_SETTINGS, saveUserSettings } from './settings.js?v=2.6.3';
import { showToast } from './utils.js?v=2.6.3';
import {
  initNotificationEngine,
  updateNotificationBellUI,
  requestNotificationPermission,
  getNotificationPermissionStatus,
  playNotificationSound
} from './notifications.js?v=2.7.1';

const DOM = {};

document.addEventListener('DOMContentLoaded', async () => {
  cacheDomElements();
  loadStateFromStorage();
  initModal(DOM.modalElements, renderAll);
  initSettingsUI(DOM, renderAll);
  initPointsBreakdownModal();
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
  DOM.todoDueDateInput = document.getElementById('todoDueDateInput');
  DOM.todoDueTodayBtn = document.getElementById('todoDueTodayBtn');
  DOM.todoDueTomorrowBtn = document.getElementById('todoDueTomorrowBtn');
  DOM.todoDueClearBtn = document.getElementById('todoDueClearBtn');
  DOM.todoFilterBar = document.getElementById('todoFilterBar');
  DOM.todoList = document.getElementById('todoList');
  DOM.weeklyNotesTextarea = document.getElementById('weeklyNotesTextarea');
  DOM.notesSavedStatus = document.getElementById('notesSavedStatus');
  DOM.weeklyNotesPreview = document.getElementById('weeklyNotesPreview');
  DOM.notesMarkdownToolbar = document.getElementById('notesMarkdownToolbar');
  DOM.notesDualPaneContainer = document.getElementById('notesDualPaneContainer');
  DOM.notesModeEditBtn = document.getElementById('notesModeEditBtn');
  DOM.notesModeSplitBtn = document.getElementById('notesModeSplitBtn');
  DOM.notesModePreviewBtn = document.getElementById('notesModePreviewBtn');
  DOM.notesSnippetSelect = document.getElementById('notesSnippetSelect');
  DOM.notesWordCount = document.getElementById('notesWordCount');

  // Auth Landing Gate Elements
  DOM.userDisplayName = document.getElementById('userDisplayName');
  DOM.notificationBellBtn = document.getElementById('notificationBellBtn');
  DOM.notificationBellIcon = document.getElementById('notificationBellIcon');
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

  // Handle Session Expiry (401 from API)
  window.addEventListener('dayflow:session-expired', () => {
    const hadToken = !!localStorage.getItem('dayflow_token');
    if (hadToken) {
      localStorage.removeItem('dayflow_token');
      localStorage.removeItem('dayflow_user');
      STATE.scheduleData = {};
      showToast('⚠️ Your session has expired. Please sign in again.', 'warning', 5000);
      showLoginScreen();
      if (DOM.landingLoginErrorMsg) {
        DOM.landingLoginErrorMsg.textContent = 'Session expired. Please sign in to reconnect.';
        DOM.landingLoginErrorMsg.style.display = 'block';
      }
    }
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
  initNotificationEngine();
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
  // Notification Bell Quick Toggle / Permission
  if (DOM.notificationBellBtn) {
    DOM.notificationBellBtn.addEventListener('click', async () => {
      const perm = getNotificationPermissionStatus();
      if (perm !== 'granted') {
        await requestNotificationPermission();
      } else {
        // Toggle sound mute
        USER_SETTINGS.notificationSound = !USER_SETTINGS.notificationSound;
        saveUserSettings(USER_SETTINGS);
        updateNotificationBellUI();
        if (USER_SETTINGS.notificationSound) {
          playNotificationSound(USER_SETTINGS.notificationTone, USER_SETTINGS.notificationVolume);
          showToast('🔔 Sound alarms enabled', 'success');
        } else {
          showToast('🔕 Sound alarms muted', 'info');
        }
      }
    });
  }

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
      if (y < 1800 || y > 2200) {
        alert('Please select a date between year 1800 and 2200.');
        DOM.weekDatePicker.value = formatDateISO(STATE.selectedDate || new Date());
        return;
      }
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

  // Todo Due Date Quick Pills & Clear Controls
  const updateDuePillState = () => {
    if (!DOM.todoDueDateInput) return;
    const val = DOM.todoDueDateInput.value;
    const todayStr = formatDateISO(new Date());
    const tom = new Date();
    tom.setDate(tom.getDate() + 1);
    const tomorrowStr = formatDateISO(tom);

    if (DOM.todoDueTodayBtn) DOM.todoDueTodayBtn.classList.toggle('active', val === todayStr);
    if (DOM.todoDueTomorrowBtn) DOM.todoDueTomorrowBtn.classList.toggle('active', val === tomorrowStr);
    if (DOM.todoDueClearBtn) DOM.todoDueClearBtn.style.display = val ? 'inline-block' : 'none';
  };

  if (DOM.todoDueDateInput) {
    DOM.todoDueDateInput.addEventListener('change', updateDuePillState);
  }

  if (DOM.todoDueTodayBtn) {
    DOM.todoDueTodayBtn.addEventListener('click', () => {
      const todayStr = formatDateISO(new Date());
      if (DOM.todoDueDateInput) DOM.todoDueDateInput.value = todayStr;
      updateDuePillState();
    });
  }

  if (DOM.todoDueTomorrowBtn) {
    DOM.todoDueTomorrowBtn.addEventListener('click', () => {
      const tom = new Date();
      tom.setDate(tom.getDate() + 1);
      const tomorrowStr = formatDateISO(tom);
      if (DOM.todoDueDateInput) DOM.todoDueDateInput.value = tomorrowStr;
      updateDuePillState();
    });
  }

  if (DOM.todoDueClearBtn) {
    DOM.todoDueClearBtn.addEventListener('click', () => {
      if (DOM.todoDueDateInput) DOM.todoDueDateInput.value = '';
      updateDuePillState();
    });
  }

  DOM.addTodoForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = DOM.todoInput.value.trim();
    const priority = DOM.todoPrioritySelect ? DOM.todoPrioritySelect.value : 'Medium';
    const category = DOM.todoCategorySelect ? DOM.todoCategorySelect.value : 'General';
    const dueDate = DOM.todoDueDateInput && DOM.todoDueDateInput.value ? DOM.todoDueDateInput.value : null;

    if (dueDate) {
      const dueYear = parseInt(dueDate.split('-')[0], 10);
      if (dueYear < 1800 || dueYear > 2200) {
        alert('Due date must be between year 1800 and 2200.');
        return;
      }
    }

    if (text) {
      const weekKey = getWeekKey(STATE.currentWeekStart);
      const weekData = getCurrentWeekData();
      if (!weekData.todos) weekData.todos = [];
      const tempId = Date.now();
      const localTodo = { id: tempId, text, priority, category, dueDate, completed: false };
      weekData.todos.push(localTodo);
      DOM.todoInput.value = '';
      if (DOM.todoDueDateInput) {
        DOM.todoDueDateInput.value = '';
        updateDuePillState();
      }
      saveStateToStorage();
      renderNotes(DOM.todoList, DOM.weeklyNotesTextarea);

      // Sync todo with API and patch server-assigned ID & date
      const apiRes = await ApiClient.addTodo(weekKey, text, priority, category, dueDate);
      if (apiRes && apiRes.todo && apiRes.todo.id) {
        localTodo.id = apiRes.todo.id;
        if (apiRes.todo.dueDate) localTodo.dueDate = apiRes.todo.dueDate;
        saveStateToStorage();
        renderNotes(DOM.todoList, DOM.weeklyNotesTextarea);
      }
    }
  });

  if (DOM.weeklyNotesTextarea) {
    initMarkdownScratchpad(DOM);
    let notesAutosaveTimer = null;

    const flushNotesToApi = () => {
      if (notesAutosaveTimer) {
        clearTimeout(notesAutosaveTimer);
        notesAutosaveTimer = null;
      }
      const weekKey = getWeekKey(STATE.currentWeekStart);
      const weekData = getCurrentWeekData();
      ApiClient.saveNotes(weekKey, weekData.notes, weekData.noteSheets);
      DOM.notesSavedStatus.textContent = 'Saved';
    };

    DOM.weeklyNotesTextarea.addEventListener('input', () => {
      const weekData = getCurrentWeekData();
      const sheets = weekData.noteSheets || [];
      const currentActive = sheets.find(s => s.id === getActiveSheetId()) || sheets[0];
      if (currentActive) {
        currentActive.content = DOM.weeklyNotesTextarea.value;
        if (currentActive.id === 'journal') {
          weekData.notes = DOM.weeklyNotesTextarea.value;
        }
      } else {
        weekData.notes = DOM.weeklyNotesTextarea.value;
      }
      saveStateToStorage();
      DOM.notesSavedStatus.textContent = 'Saving...';
      
      // Debounce network write (600ms) to prevent request races and server flooding
      if (notesAutosaveTimer) clearTimeout(notesAutosaveTimer);
      notesAutosaveTimer = setTimeout(flushNotesToApi, 600);
    });

    DOM.weeklyNotesTextarea.addEventListener('blur', () => {
      if (notesAutosaveTimer) flushNotesToApi();
    });
  }

  // Grid keyboard shortcuts (Ctrl+C, Ctrl+V, Ctrl+D, Ctrl+Z, Ctrl+Y, Arrows, Enter, Delete, Escape)
  initGridShortcuts();
  initGridContextMenu();

  // Clear cell selection when clicking outside grid cells or modal
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.slot-cell') && !e.target.closest('#taskModal') && !e.target.closest('#gridContextMenu')) {
      clearSlotSelection();
    }
  });
}

function isInputTarget(e) {
  const target = e.target;
  if (!target) return false;
  const tag = (target.tagName || '').toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
}

function initGridShortcuts() {
  document.addEventListener('keydown', async (e) => {
    // 1. Guard: do not intercept inside inputs, text areas, or open modal
    if (isInputTarget(e)) return;
    if (DOM.modalElements?.taskModal?.classList.contains('active')) return;
    if (STATE.activeView !== 'grid') return;

    const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const isCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

    // 2. Ctrl+Z / Cmd+Z (Undo - without Shift)
    if (isCmdOrCtrl && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
      e.preventDefault();
      await handleUndo();
      return;
    }

    // 3. Ctrl+Y / Cmd+Y OR Ctrl+Shift+Z / Cmd+Shift+Z (Redo)
    if (isCmdOrCtrl && (e.key === 'y' || e.key === 'Y' || (e.shiftKey && (e.key === 'z' || e.key === 'Z')))) {
      e.preventDefault();
      await handleRedo();
      return;
    }

    // 4. Ctrl+C / Cmd+C (Copy)
    if (isCmdOrCtrl && (e.key === 'c' || e.key === 'C')) {
      if (!STATE.selectedSlotKey) return;
      e.preventDefault();
      const weekKey = getSlotWeekKey(STATE.selectedSlotKey);
      const weekData = STATE.scheduleData[weekKey];
      const slotData = weekData?.slots?.[STATE.selectedSlotKey];

      if (!slotData || (!slotData.plannedTask && !slotData.actualTask)) {
        showToast('Selected slot is empty', 'warning');
        return;
      }

      STATE.gridClipboard = JSON.parse(JSON.stringify(slotData));
      STATE.copiedSlotKey = STATE.selectedSlotKey;

      // Update visual marching ants
      document.querySelectorAll('.slot-cell.copied-source').forEach(el => el.classList.remove('copied-source'));
      const currentTd = document.querySelector(`.slot-cell[data-slot-key="${STATE.selectedSlotKey}"]`);
      if (currentTd) currentTd.classList.add('copied-source');

      const taskTitle = slotData.plannedTask || slotData.actualTask || 'Task';
      showToast(`📋 Copied: "${taskTitle}"`, 'success');
      return;
    }

    // 5. Ctrl+V / Cmd+V (Paste)
    if (isCmdOrCtrl && (e.key === 'v' || e.key === 'V')) {
      if (!STATE.selectedSlotKey) return;
      if (!STATE.gridClipboard) {
        showToast('Clipboard is empty. Press Ctrl+C on a slot first.', 'warning');
        return;
      }
      e.preventDefault();
      await pasteSlotData(STATE.selectedSlotKey, STATE.gridClipboard, 'Pasted');
      return;
    }

    // 6. Ctrl+D / Cmd+D (Fill Down / Duplicate)
    if (isCmdOrCtrl && (e.key === 'd' || e.key === 'D')) {
      e.preventDefault();
      if (!STATE.selectedSlotKey) return;

      const currentSlotKey = STATE.selectedSlotKey;
      const weekKey = getSlotWeekKey(currentSlotKey);
      const weekData = STATE.scheduleData[weekKey];
      const currentData = weekData?.slots?.[currentSlotKey];

      // If current cell has a task, duplicate it down to the cell below!
      if (currentData && (currentData.plannedTask || currentData.actualTask)) {
        const nextSlotKey = getAdjacentSlotKey(currentSlotKey, 'down');
        if (!nextSlotKey) {
          showToast('Cannot duplicate past the end of the day', 'warning');
          return;
        }
        await pasteSlotData(nextSlotKey, currentData, 'Duplicated');
        selectSlotCell(nextSlotKey);
      } else {
        // If current cell is empty, fill from the cell above (Excel standard fill-down)!
        const prevSlotKey = getAdjacentSlotKey(currentSlotKey, 'up');
        if (!prevSlotKey) {
          showToast('No slot above to fill from', 'warning');
          return;
        }
        const prevWeekKey = getSlotWeekKey(prevSlotKey);
        const prevData = STATE.scheduleData[prevWeekKey]?.slots?.[prevSlotKey];
        if (!prevData || (!prevData.plannedTask && !prevData.actualTask)) {
          showToast('Slot above is empty', 'warning');
          return;
        }
        await pasteSlotData(currentSlotKey, prevData, 'Filled down');
      }
      return;
    }

    // 7. Arrow Keys Navigation
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      if (!STATE.selectedSlotKey) return;
      e.preventDefault();
      const dirMap = {
        'ArrowUp': 'up',
        'ArrowDown': 'down',
        'ArrowLeft': 'left',
        'ArrowRight': 'right'
      };
      const nextKey = getAdjacentSlotKey(STATE.selectedSlotKey, dirMap[e.key]);
      if (nextKey) {
        selectSlotCell(nextKey);
        const td = document.querySelector(`.slot-cell[data-slot-key="${nextKey}"]`);
        if (td) {
          td.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
        }
      }
      return;
    }

    // 8. Enter or Space -> Open Modal for selected slot
    if (e.key === 'Enter' || e.key === ' ') {
      if (!STATE.selectedSlotKey) return;
      e.preventDefault();
      const targetTd = document.querySelector(`.slot-cell[data-slot-key="${STATE.selectedSlotKey}"]`);
      const weekKey = getSlotWeekKey(STATE.selectedSlotKey);
      const slotData = STATE.scheduleData[weekKey]?.slots?.[STATE.selectedSlotKey];
      const dayName = targetTd?.dataset?.dayName || '';
      const timeLabel = targetTd?.dataset?.timeLabel || '';
      openTaskModal(STATE.selectedSlotKey, dayName, timeLabel, slotData);
      return;
    }

    // 9. Delete or Backspace -> Clear Slot
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (!STATE.selectedSlotKey) return;
      const currentKey = STATE.selectedSlotKey;
      const weekKey = getSlotWeekKey(currentKey);
      const slotData = STATE.scheduleData[weekKey]?.slots?.[currentKey];
      if (slotData && (slotData.plannedTask || slotData.actualTask)) {
        e.preventDefault();
        const previousData = JSON.parse(JSON.stringify(slotData));
        recordUndoAction({
          type: 'slot_delete',
          weekKey,
          slotKey: currentKey,
          previousData,
          newData: null,
          label: previousData.plannedTask || previousData.actualTask || 'Task'
        });
        delete STATE.scheduleData[weekKey].slots[currentKey];
        saveStateToStorage();
        renderGrid(DOM.scheduleTableBody, handleSwitchToDayView);
        renderAnalytics(DOM.statPlannedHours, DOM.statActualHours, DOM.statScore, DOM.categoryBarsContainer);
        selectSlotCell(currentKey);
        showToast('🗑️ Slot cleared', 'info');
        await ApiClient.deleteSlot(weekKey, currentKey);
      }
      return;
    }

    // 10. Escape -> Deselect & Hide Context Menu
    if (e.key === 'Escape') {
      clearSlotSelection();
      hideContextMenu();
      return;
    }
  });
}

async function handleUndo() {
  if (!STATE.undoStack || STATE.undoStack.length === 0) {
    showToast('Nothing to undo', 'info');
    return;
  }

  const action = STATE.undoStack.pop();
  const { weekKey, slotKey, previousData, label } = action;

  if (!STATE.scheduleData[weekKey]) {
    STATE.scheduleData[weekKey] = { slots: {}, habits: [], todos: [], notes: '', noteSheets: [] };
  }
  const weekData = STATE.scheduleData[weekKey];

  if (!previousData || (!previousData.plannedTask && !previousData.actualTask)) {
    delete weekData.slots[slotKey];
    saveStateToStorage();
    renderGrid(DOM.scheduleTableBody, handleSwitchToDayView);
    renderAnalytics(DOM.statPlannedHours, DOM.statActualHours, DOM.statScore, DOM.categoryBarsContainer);
    selectSlotCell(slotKey);
    showToast('↩️ Undone: Cleared slot', 'info');
    try {
      await ApiClient.deleteSlot(weekKey, slotKey);
    } catch (e) {}
  } else {
    weekData.slots[slotKey] = JSON.parse(JSON.stringify(previousData));
    saveStateToStorage();
    renderGrid(DOM.scheduleTableBody, handleSwitchToDayView);
    renderAnalytics(DOM.statPlannedHours, DOM.statActualHours, DOM.statScore, DOM.categoryBarsContainer);
    selectSlotCell(slotKey);
    const restoredTitle = previousData.plannedTask || previousData.actualTask || label || 'Task';
    showToast(`↩️ Undone: Restored "${restoredTitle}"`, 'info');
    try {
      await ApiClient.saveSlot(weekKey, slotKey, previousData);
    } catch (e) {}
  }

  STATE.redoStack.push(action);
}

async function handleRedo() {
  if (!STATE.redoStack || STATE.redoStack.length === 0) {
    showToast('Nothing to redo', 'info');
    return;
  }

  const action = STATE.redoStack.pop();
  const { weekKey, slotKey, newData, label } = action;

  if (!STATE.scheduleData[weekKey]) {
    STATE.scheduleData[weekKey] = { slots: {}, habits: [], todos: [], notes: '', noteSheets: [] };
  }
  const weekData = STATE.scheduleData[weekKey];

  if (!newData || (!newData.plannedTask && !newData.actualTask)) {
    delete weekData.slots[slotKey];
    saveStateToStorage();
    renderGrid(DOM.scheduleTableBody, handleSwitchToDayView);
    renderAnalytics(DOM.statPlannedHours, DOM.statActualHours, DOM.statScore, DOM.categoryBarsContainer);
    selectSlotCell(slotKey);
    showToast('↪️ Redone: Cleared slot', 'info');
    try {
      await ApiClient.deleteSlot(weekKey, slotKey);
    } catch (e) {}
  } else {
    weekData.slots[slotKey] = JSON.parse(JSON.stringify(newData));
    saveStateToStorage();
    renderGrid(DOM.scheduleTableBody, handleSwitchToDayView);
    renderAnalytics(DOM.statPlannedHours, DOM.statActualHours, DOM.statScore, DOM.categoryBarsContainer);
    selectSlotCell(slotKey);
    const redoneTitle = newData.plannedTask || newData.actualTask || label || 'Task';
    showToast(`↪️ Redone: "${redoneTitle}"`, 'info');
    try {
      await ApiClient.saveSlot(weekKey, slotKey, newData);
    } catch (e) {}
  }

  STATE.undoStack.push(action);
}

async function pasteSlotData(targetSlotKey, sourceData, sourceLabel = 'Pasted') {
  const weekKey = getSlotWeekKey(targetSlotKey);
  if (!STATE.scheduleData[weekKey]) {
    STATE.scheduleData[weekKey] = { slots: {}, habits: [], todos: [], notes: '', noteSheets: [] };
  }
  const weekData = STATE.scheduleData[weekKey];
  const existing = weekData.slots[targetSlotKey] || {};

  const cloned = JSON.parse(JSON.stringify(sourceData));
  const isFuture = isSlotInFuture(targetSlotKey);

  let newStatus = cloned.status || 'Pending';
  let newActualDuration = cloned.actual !== undefined ? cloned.actual : (cloned.planned || 30);
  let newActualTask = cloned.actualTask || cloned.plannedTask || '';

  // Requirement: if pasting or duplicating into a future cell, status must be kept as "pending"
  if (isFuture) {
    newStatus = 'Pending';
    newActualDuration = 0;
    newActualTask = cloned.plannedTask || cloned.actualTask || '';
  }

  const newSlotObject = {
    ...existing,
    plannedTask: cloned.plannedTask || cloned.actualTask || '',
    actualTask: newActualTask,
    category: cloned.category || 'General',
    status: newStatus,
    planned: cloned.planned || 30,
    actual: newActualDuration,
    notes: cloned.notes || ''
  };

  // Record undo action before overwriting slot
  const previousData = existing && (existing.plannedTask || existing.actualTask)
    ? JSON.parse(JSON.stringify(existing))
    : null;
  recordUndoAction({
    type: 'slot_paste',
    weekKey,
    slotKey: targetSlotKey,
    previousData,
    newData: JSON.parse(JSON.stringify(newSlotObject)),
    label: newSlotObject.plannedTask || newSlotObject.actualTask || 'Task'
  });

  weekData.slots[targetSlotKey] = newSlotObject;
  saveStateToStorage();
  renderGrid(DOM.scheduleTableBody, handleSwitchToDayView);
  renderAnalytics(DOM.statPlannedHours, DOM.statActualHours, DOM.statScore, DOM.categoryBarsContainer);

  selectSlotCell(targetSlotKey);
  clearCopiedSource();

  const statusNote = isFuture ? ' (Status: Pending)' : '';
  const taskTitle = newSlotObject.plannedTask || newSlotObject.actualTask || 'Task';
  showToast(`📥 ${sourceLabel}: "${taskTitle}"${statusNote}`, 'success');

  try {
    await ApiClient.saveSlot(weekKey, targetSlotKey, newSlotObject);
  } catch (err) {
    console.error('Failed to sync slot to backend:', err);
  }
}

// Right-Click Context Menu Controller
let contextMenuEl = null;

function initGridContextMenu() {
  if (!contextMenuEl) {
    contextMenuEl = document.createElement('div');
    contextMenuEl.id = 'gridContextMenu';
    contextMenuEl.className = 'grid-context-menu';
    contextMenuEl.style.display = 'none';
    document.body.appendChild(contextMenuEl);
  }

  document.addEventListener('contextmenu', (e) => {
    const td = e.target.closest('.slot-cell');
    if (!td || STATE.activeView !== 'grid') {
      hideContextMenu();
      return;
    }

    e.preventDefault();
    const slotKey = td.dataset.slotKey;
    selectSlotCell(slotKey, td);
    showContextMenu(e.clientX, e.clientY, slotKey, td);
  });

  document.addEventListener('click', (e) => {
    if (contextMenuEl && !e.target.closest('#gridContextMenu')) {
      hideContextMenu();
    }
  });
}

function hideContextMenu() {
  if (contextMenuEl) {
    contextMenuEl.style.display = 'none';
  }
}

function showContextMenu(x, y, slotKey, td) {
  if (!contextMenuEl) return;

  const weekKey = getSlotWeekKey(slotKey);
  const weekData = STATE.scheduleData[weekKey];
  const slotData = weekData?.slots?.[slotKey];
  const hasTask = !!(slotData && (slotData.plannedTask || slotData.actualTask));
  const hasClipboard = !!(STATE.gridClipboard && (STATE.gridClipboard.plannedTask || STATE.gridClipboard.actualTask));
  const canUndo = Array.isArray(STATE.undoStack) && STATE.undoStack.length > 0;
  const canRedo = Array.isArray(STATE.redoStack) && STATE.redoStack.length > 0;
  const isFuture = isSlotInFuture(slotKey);

  const pasteSubtext = hasClipboard && isFuture ? ' <span style="font-size:0.68rem;opacity:0.75;margin-left:4px;">(Pending)</span>' : '';

  contextMenuEl.innerHTML = `
    <div class="context-menu-item" data-action="edit">
      <div class="context-menu-item-left">
        <span>✏️</span>
        <span>${hasTask ? 'Edit Task' : '+ Add Task'}</span>
      </div>
      <span class="context-menu-shortcut">Enter</span>
    </div>
    <div class="context-menu-item ${!hasTask ? 'disabled' : ''}" data-action="copy">
      <div class="context-menu-item-left">
        <span>📋</span>
        <span>Copy</span>
      </div>
      <span class="context-menu-shortcut">Ctrl+C</span>
    </div>
    <div class="context-menu-item ${!hasClipboard ? 'disabled' : ''}" data-action="paste">
      <div class="context-menu-item-left">
        <span>📥</span>
        <span>Paste${pasteSubtext}</span>
      </div>
      <span class="context-menu-shortcut">Ctrl+V</span>
    </div>
    <div class="context-menu-item" data-action="duplicate">
      <div class="context-menu-item-left">
        <span>🔽</span>
        <span>${hasTask ? 'Duplicate Down' : 'Fill from Above'}</span>
      </div>
      <span class="context-menu-shortcut">Ctrl+D</span>
    </div>
    <div class="context-menu-divider"></div>
    <div class="context-menu-item ${!canUndo ? 'disabled' : ''}" data-action="undo">
      <div class="context-menu-item-left">
        <span>↩️</span>
        <span>Undo</span>
      </div>
      <span class="context-menu-shortcut">Ctrl+Z</span>
    </div>
    <div class="context-menu-item ${!canRedo ? 'disabled' : ''}" data-action="redo">
      <div class="context-menu-item-left">
        <span>↪️</span>
        <span>Redo</span>
      </div>
      <span class="context-menu-shortcut">Ctrl+Y</span>
    </div>
    <div class="context-menu-divider"></div>
    <div class="context-menu-item ${!hasTask ? 'disabled' : ''}" data-action="clear" style="color: ${hasTask ? '#f87171' : ''};">
      <div class="context-menu-item-left">
        <span>🗑️</span>
        <span>Clear Slot</span>
      </div>
      <span class="context-menu-shortcut">Del</span>
    </div>
  `;

  contextMenuEl.querySelectorAll('.context-menu-item:not(.disabled)').forEach(item => {
    item.addEventListener('click', async (e) => {
      e.stopPropagation();
      const action = item.dataset.action;
      hideContextMenu();

      if (action === 'edit') {
        const dayName = td.dataset.dayName || '';
        const timeLabel = td.dataset.timeLabel || '';
        openTaskModal(slotKey, dayName, timeLabel, slotData);
      } else if (action === 'copy') {
        if (!slotData) return;
        STATE.gridClipboard = JSON.parse(JSON.stringify(slotData));
        STATE.copiedSlotKey = slotKey;
        document.querySelectorAll('.slot-cell.copied-source').forEach(el => el.classList.remove('copied-source'));
        td.classList.add('copied-source');
        showToast(`📋 Copied: "${slotData.plannedTask || slotData.actualTask}"`, 'success');
      } else if (action === 'paste') {
        if (!STATE.gridClipboard) return;
        await pasteSlotData(slotKey, STATE.gridClipboard, 'Pasted');
      } else if (action === 'duplicate') {
        if (hasTask) {
          const nextSlotKey = getAdjacentSlotKey(slotKey, 'down');
          if (!nextSlotKey) {
            showToast('Cannot duplicate past the end of the day', 'warning');
            return;
          }
          await pasteSlotData(nextSlotKey, slotData, 'Duplicated');
          selectSlotCell(nextSlotKey);
        } else {
          const prevSlotKey = getAdjacentSlotKey(slotKey, 'up');
          if (!prevSlotKey) {
            showToast('No slot above to fill from', 'warning');
            return;
          }
          const prevWeekKey = getSlotWeekKey(prevSlotKey);
          const prevData = STATE.scheduleData[prevWeekKey]?.slots?.[prevSlotKey];
          if (!prevData || (!prevData.plannedTask && !prevData.actualTask)) {
            showToast('Slot above is empty', 'warning');
            return;
          }
          await pasteSlotData(slotKey, prevData, 'Filled down');
        }
      } else if (action === 'undo') {
        await handleUndo();
      } else if (action === 'redo') {
        await handleRedo();
      } else if (action === 'clear') {
        if (!hasTask) return;
        const previousData = JSON.parse(JSON.stringify(slotData));
        recordUndoAction({
          type: 'slot_delete',
          weekKey,
          slotKey,
          previousData,
          newData: null,
          label: previousData.plannedTask || previousData.actualTask || 'Task'
        });
        delete weekData.slots[slotKey];
        saveStateToStorage();
        renderGrid(DOM.scheduleTableBody, handleSwitchToDayView);
        renderAnalytics(DOM.statPlannedHours, DOM.statActualHours, DOM.statScore, DOM.categoryBarsContainer);
        selectSlotCell(slotKey);
        showToast('🗑️ Slot cleared', 'info');
        await ApiClient.deleteSlot(weekKey, slotKey);
      }
    });
  });

  contextMenuEl.style.display = 'block';
  const menuWidth = contextMenuEl.offsetWidth || 210;
  const menuHeight = contextMenuEl.offsetHeight || 270;
  const maxX = window.innerWidth - menuWidth - 10;
  const maxY = window.innerHeight - menuHeight - 10;
  const posX = Math.min(x, maxX);
  const posY = Math.min(y, maxY);

  contextMenuEl.style.left = `${Math.max(10, posX)}px`;
  contextMenuEl.style.top = `${Math.max(10, posY)}px`;
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
      const nextDate = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + step);
      if (nextDate.getFullYear() < 1800 || nextDate.getFullYear() > 2200) return;
      STATE.selectedDate = nextDate;
      STATE.currentWeekStart = getMonday(STATE.selectedDate);
    } else if (STATE.scheduleViewMode === 'month') {
      const cur = STATE.selectedDate || new Date();
      const nextDate = new Date(cur.getFullYear(), cur.getMonth() + step, 1);
      if (nextDate.getFullYear() < 1800 || nextDate.getFullYear() > 2200) return;
      STATE.selectedDate = nextDate;
      STATE.currentWeekStart = getMonday(STATE.selectedDate);
    } else {
      const cur = STATE.currentWeekStart;
      const nextWeek = getMonday(new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + (step * 7)));
      if (nextWeek.getFullYear() < 1800 || nextWeek.getFullYear() > 2200) return;
      STATE.currentWeekStart = nextWeek;
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
  if (targetDate.getFullYear() < 1800 || targetDate.getFullYear() > 2200) {
    alert('Date must be between year 1800 and 2200.');
    return;
  }
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
    const dayName = selDate.toLocaleDateString('en-US', { weekday: 'long' });
    const formattedDate = formatDateDisplay(selDate);
    DOM.currentWeekRange.textContent = `${dayName}, ${formattedDate}`;
    DOM.weekDatePicker.value = formatDateISO(selDate);
  } else if (STATE.scheduleViewMode === 'month') {
    const monthFull = selDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    DOM.currentWeekRange.textContent = monthFull;
    DOM.weekDatePicker.value = formatDateISO(selDate);
  } else {
    const dates = getWeekDates(STATE.currentWeekStart);
    const monDate = new Date(dates[0] + 'T00:00:00');
    const sunDate = new Date(dates[6] + 'T00:00:00');

    const startStr = formatDateDisplayShort(monDate);
    const endStr = formatDateDisplayShort(sunDate);
    const yearStr = sunDate.getFullYear();

    DOM.currentWeekRange.textContent = `Mon, ${startStr} – Sun, ${endStr}, ${yearStr}`;
    DOM.weekDatePicker.value = dates[0];
  }
}

function formatDateShort(dateObj) {
  return formatDateDisplayShort(dateObj);
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
