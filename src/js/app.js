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
  recordUndoAction,
  getUserStorageKey,
  setScheduleViewMode,
  markSlotPendingSave,
  clearSlotPendingSave,
  isSlotPendingSave,
  getSelectedSlotKeys,
  clearSelectedSlotKeys,
  toggleSelectedSlotKey,
  addSelectedSlotKey,
  removeSelectedSlotKey,
  isSlotMultiSelected
} from './state.js?v=2.9.22';
import { ApiClient, isDemoMode } from './apiClient.js?v=2.9.22';
import { renderGrid, selectSlotCell, clearSlotSelection, clearCopiedSource, getAdjacentSlotKey, startCurrentSlotTicker, TIME_SLOTS, resetGridAutoScroll, updateBulkActionBar, syncMultiSelectedClasses } from './grid.js?v=2.9.22';
import { initModal, openTaskModal } from './modal.js?v=2.9.22';
import { renderHabits, addHabitLog, renderQuickPresetsUI } from './habits.js?v=2.9.22';
import { renderAnalytics, initPointsBreakdownModal } from './analytics.js?v=2.9.22';
import { renderNotes, initTodoFilterBar, initMarkdownScratchpad, getActiveSheetId, setActiveSheetId, flushCurrentNoteEditor, setSheetContent, markNotesDirty, setCancelAutosaveCallback, getSelectedDateISO } from './notes.js?v=2.9.22';
import { initSettingsUI, USER_SETTINGS, saveUserSettings, getDayTemplates, getDayTemplateById, saveDayTemplate, renderSettingsDayTemplatesUI, syncDayTemplatesFromApi } from './settings.js?v=2.9.22';
import { showToast } from './utils.js?v=2.9.22';
import {
  initNotificationEngine,
  updateNotificationBellUI,
  requestNotificationPermission,
  getNotificationPermissionStatus,
  playNotificationSound
} from './notifications.js?v=2.9.22';

const DOM = {};

document.addEventListener('DOMContentLoaded', async () => {
  cacheDomElements();
  loadStateFromStorage();
  initModal(DOM.modalElements, renderAll);
  initSettingsUI(DOM, renderAll);
  initPointsBreakdownModal();
  bindEvents();
  initBulkActionsUI();
  initAuthUI();
  
  // Check active user session gate
  await checkUserSessionGate();
});

function cacheDomElements() {
  DOM.loginScreen = document.getElementById('loginScreen');
  DOM.app = document.getElementById('app');

  DOM.navBtns = document.querySelectorAll('.nav-btn, .mobile-nav-btn');
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
  DOM.userAvatarImg = document.getElementById('userAvatarImg');
  DOM.userDefaultIcon = document.getElementById('userDefaultIcon');
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
  DOM.googleAuthSection = document.getElementById('googleAuthSection');
  DOM.googleSignInBtn = document.getElementById('googleSignInBtn');

  // Forgot & Reset Password Elements
  DOM.authTabs = document.getElementById('authTabs');
  DOM.landingForgotPasswordLink = document.getElementById('landingForgotPasswordLink');
  DOM.landingForgotPasswordForm = document.getElementById('landingForgotPasswordForm');
  DOM.landingForgotEmail = document.getElementById('landingForgotEmail');
  DOM.landingForgotStatusMsg = document.getElementById('landingForgotStatusMsg');
  DOM.landingForgotSubmitBtn = document.getElementById('landingForgotSubmitBtn');
  DOM.landingForgotBackToSignIn = document.getElementById('landingForgotBackToSignIn');
  DOM.landingResetPasswordForm = document.getElementById('landingResetPasswordForm');
  DOM.landingResetToken = document.getElementById('landingResetToken');
  DOM.landingResetEmail = document.getElementById('landingResetEmail');
  DOM.landingResetNewPassword = document.getElementById('landingResetNewPassword');
  DOM.landingResetConfirmPassword = document.getElementById('landingResetConfirmPassword');
  DOM.landingResetStatusMsg = document.getElementById('landingResetStatusMsg');
  DOM.landingResetSubmitBtn = document.getElementById('landingResetSubmitBtn');
  DOM.landingResetBackToSignIn = document.getElementById('landingResetBackToSignIn');

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

  // Forgot Password Navigation
  if (DOM.landingForgotPasswordLink) {
    DOM.landingForgotPasswordLink.addEventListener('click', (e) => {
      e.preventDefault();
      switchLandingTab('forgot');
    });
  }
  if (DOM.landingForgotBackToSignIn) {
    DOM.landingForgotBackToSignIn.addEventListener('click', (e) => {
      e.preventDefault();
      switchLandingTab('signin');
    });
  }
  if (DOM.landingResetBackToSignIn) {
    DOM.landingResetBackToSignIn.addEventListener('click', (e) => {
      e.preventDefault();
      switchLandingTab('signin');
    });
  }

  // Submit Forgot Password Request
  if (DOM.landingForgotPasswordForm) {
    DOM.landingForgotPasswordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!DOM.landingForgotEmail) return;
      const email = DOM.landingForgotEmail.value.trim();
      if (!email) return;

      if (DOM.landingForgotSubmitBtn) {
        DOM.landingForgotSubmitBtn.disabled = true;
        DOM.landingForgotSubmitBtn.textContent = 'Sending reset link...';
      }
      if (DOM.landingForgotStatusMsg) {
        DOM.landingForgotStatusMsg.style.display = 'none';
      }

      try {
        const res = await ApiClient.forgotPassword(email);
        if (DOM.landingForgotStatusMsg) {
          DOM.landingForgotStatusMsg.textContent = res.message || 'If an account exists, a reset link has been dispatched to your email.';
          DOM.landingForgotStatusMsg.style.display = 'block';
          DOM.landingForgotStatusMsg.style.backgroundColor = 'rgba(16, 185, 129, 0.15)';
          DOM.landingForgotStatusMsg.style.color = '#10b981';
          DOM.landingForgotStatusMsg.style.borderColor = 'rgba(16, 185, 129, 0.3)';
        }
      } catch (err) {
        if (DOM.landingForgotStatusMsg) {
          DOM.landingForgotStatusMsg.textContent = err.message || 'Failed to send reset link. Please try again.';
          DOM.landingForgotStatusMsg.style.display = 'block';
          DOM.landingForgotStatusMsg.style.backgroundColor = 'rgba(239, 68, 68, 0.15)';
          DOM.landingForgotStatusMsg.style.color = '#ef4444';
          DOM.landingForgotStatusMsg.style.borderColor = 'rgba(239, 68, 68, 0.3)';
        }
      } finally {
        if (DOM.landingForgotSubmitBtn) {
          DOM.landingForgotSubmitBtn.disabled = false;
          DOM.landingForgotSubmitBtn.textContent = 'Send Reset Link';
        }
      }
    });
  }

  // Submit Reset Password Request
  if (DOM.landingResetPasswordForm) {
    DOM.landingResetPasswordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = DOM.landingResetEmail ? DOM.landingResetEmail.value.trim() : '';
      const token = DOM.landingResetToken ? DOM.landingResetToken.value.trim() : '';
      const newPwd = DOM.landingResetNewPassword ? DOM.landingResetNewPassword.value : '';
      const confirmPwd = DOM.landingResetConfirmPassword ? DOM.landingResetConfirmPassword.value : '';

      if (DOM.landingResetStatusMsg) {
        DOM.landingResetStatusMsg.style.display = 'none';
      }

      if (!token || !email) {
        showResetStatus('Invalid or missing reset token. Please request a new link.', 'error');
        return;
      }

      if (newPwd.length < 6) {
        showResetStatus('Password must be at least 6 characters.', 'error');
        return;
      }

      if (newPwd !== confirmPwd) {
        showResetStatus('New passwords do not match.', 'error');
        return;
      }

      if (DOM.landingResetSubmitBtn) {
        DOM.landingResetSubmitBtn.disabled = true;
        DOM.landingResetSubmitBtn.textContent = 'Updating password...';
      }

      try {
        const res = await ApiClient.resetPassword(email, token, newPwd);
        showResetStatus(res.message || 'Password reset successfully! You can now sign in.', 'success');
        if (DOM.landingResetSubmitBtn) {
          DOM.landingResetSubmitBtn.style.display = 'none';
        }

        // Finding 22: Clear token from URL bar and browser history
        if (typeof window !== 'undefined' && window.history && window.history.replaceState) {
          window.history.replaceState(null, '', window.location.pathname);
        }

        setTimeout(() => {
          switchLandingTab('signin');
          if (DOM.landingLoginEmail) DOM.landingLoginEmail.value = email;
          if (DOM.landingLoginPassword) DOM.landingLoginPassword.focus();
        }, 2200);
      } catch (err) {
        showResetStatus(err.message || 'Failed to reset password. The link may have expired.', 'error');
      } finally {
        if (DOM.landingResetSubmitBtn && DOM.landingResetSubmitBtn.style.display !== 'none') {
          DOM.landingResetSubmitBtn.disabled = false;
          DOM.landingResetSubmitBtn.textContent = 'Update & Set Password';
        }
      }
    });
  }

  function showResetStatus(text, type) {
    if (!DOM.landingResetStatusMsg) return;
    DOM.landingResetStatusMsg.textContent = text;
    DOM.landingResetStatusMsg.style.display = 'block';
    if (type === 'success') {
      DOM.landingResetStatusMsg.style.backgroundColor = 'rgba(16, 185, 129, 0.15)';
      DOM.landingResetStatusMsg.style.color = '#10b981';
      DOM.landingResetStatusMsg.style.borderColor = 'rgba(16, 185, 129, 0.3)';
    } else {
      DOM.landingResetStatusMsg.style.backgroundColor = 'rgba(239, 68, 68, 0.15)';
      DOM.landingResetStatusMsg.style.color = '#ef4444';
      DOM.landingResetStatusMsg.style.borderColor = 'rgba(239, 68, 68, 0.3)';
    }
  }

  DOM.logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('dayflow_token');
    localStorage.removeItem('dayflow_user');
    try {
      localStorage.removeItem(getUserStorageKey('dayflow_active_view'));
      localStorage.removeItem(getUserStorageKey('dayflow_schedule_view_mode'));
      if (window.location.hash) {
        window.history.replaceState(null, '', window.location.pathname);
      }
    } catch (e) {}
    STATE.scheduleData = {};
    if (typeof google !== 'undefined' && google.accounts?.id) {
      google.accounts.id.disableAutoSelect();
    }
    showLoginScreen();
  });

  // Handle Session Expiry (401 from API)
  window.addEventListener('dayflow:session-expired', () => {
    if (isDemoMode()) return;
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

  // Initialize Google Identity Services if client ID is configured
  setupGoogleAuth();
}

let googleAuthInitialized = false;

async function setupGoogleAuth() {
  try {
    const config = await ApiClient.getAuthConfig();
    if (!config || !config.googleClientId) {
      return; // Google Auth not yet configured in server .env
    }

    const checkGoogleGSI = () => {
      if (typeof google !== 'undefined' && google.accounts?.id) {
        initGSI(config.googleClientId);
      } else {
        setTimeout(checkGoogleGSI, 200);
      }
    };

    checkGoogleGSI();
  } catch (err) {
    console.warn('Failed to load Google Auth configuration:', err);
  }
}

function initGSI(clientId) {
  if (googleAuthInitialized) return;
  googleAuthInitialized = true;

  if (DOM.googleAuthSection) {
    DOM.googleAuthSection.style.display = 'block';
  }

  google.accounts.id.initialize({
    client_id: clientId,
    callback: handleGoogleCredentialResponse,
    auto_select: false,
    cancel_on_tap_outside: true,
  });

  if (DOM.googleSignInBtn) {
    google.accounts.id.renderButton(DOM.googleSignInBtn, {
      theme: 'outline',
      size: 'large',
      type: 'standard',
      text: 'continue_with',
      shape: 'rectangular',
      logo_alignment: 'left',
      width: 320
    });
  }
}

async function handleGoogleCredentialResponse(response) {
  try {
    if (!response || !response.credential) {
      throw new Error('Google credential token was not received');
    }
    const res = await ApiClient.googleLogin(response.credential);
    localStorage.setItem('dayflow_token', res.token);
    localStorage.setItem('dayflow_user', JSON.stringify(res.user));
    showToast(`👋 Welcome, ${res.user.displayName || 'DayFlow User'}!`, 'success');
    await onAuthSuccess(res.user);
  } catch (err) {
    console.error('Google login error:', err);
    showToast(`Google Sign-In failed: ${err.message}`, 'error', 5000);
    if (DOM.landingLoginErrorMsg) {
      DOM.landingLoginErrorMsg.textContent = err.message;
      DOM.landingLoginErrorMsg.style.display = 'block';
    }
  }
}

function getResetPasswordParams() {
  const hash = window.location.hash || '';
  if (hash.startsWith('#reset-password')) {
    const qIndex = hash.indexOf('?');
    if (qIndex !== -1) {
      const sp = new URLSearchParams(hash.slice(qIndex));
      return {
        token: sp.get('token') || '',
        email: sp.get('email') || ''
      };
    }
  }
  const sp = new URLSearchParams(window.location.search);
  if (sp.has('token') && sp.has('email')) {
    return {
      token: sp.get('token') || '',
      email: sp.get('email') || ''
    };
  }
  return null;
}

async function checkUserSessionGate() {
  const resetParams = getResetPasswordParams();
  if (resetParams && resetParams.token && resetParams.email) {
    showLoginScreen();
    switchLandingTab('reset', resetParams);
    return;
  }

  // Support ?demo=true or #demo for instant offline preview & responsive verification
  if (window.location.search.includes('demo=true') || window.location.hash.includes('demo')) {
    const demoUser = { id: 1, email: 'demo@dayflow.app', displayName: 'Demo User' };
    localStorage.setItem('dayflow_token', 'demo-token');
    localStorage.setItem('dayflow_user', JSON.stringify(demoUser));
    await onAuthSuccess(demoUser);
    return;
  }

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

const VALID_VIEWS = ['grid', 'habits', 'analytics', 'notes', 'settings'];

function getSavedActiveView() {
  const hash = (window.location.hash || '').replace('#', '').trim().toLowerCase();
  if (VALID_VIEWS.includes(hash)) {
    return hash;
  }
  try {
    const saved = localStorage.getItem(getUserStorageKey('dayflow_active_view'));
    if (saved && VALID_VIEWS.includes(saved)) {
      return saved;
    }
  } catch (e) {}
  return 'grid';
}

async function switchView(view, syncBackend = true) {
  await flushCurrentNoteEditor();
  if (!VALID_VIEWS.includes(view)) view = 'grid';
  STATE.activeView = view;

  // Auto-switch journal mode based on schedule view granularity when entering notes
  if (view === 'notes') {
    if (STATE.scheduleViewMode === 'day') {
      setActiveSheetId('daily_journal');
    } else if (getActiveSheetId() === 'daily_journal') {
      setActiveSheetId('journal');
    }
  }

  try {
    localStorage.setItem(getUserStorageKey('dayflow_active_view'), view);
    if (window.location.hash !== `#${view}`) {
      window.history.replaceState(null, '', `#${view}`);
    }
  } catch (e) {}

  if (DOM.navBtns) {
    DOM.navBtns.forEach(b => b.classList.toggle('active', b.dataset.view === view));
  }
  if (DOM.viewPanels) {
    DOM.viewPanels.forEach(p => p.classList.toggle('active', p.id === `view-${view}`));
  }

  const controlsBar = document.querySelector('.controls-bar');
  if (controlsBar) {
    controlsBar.style.display = (view === 'settings') ? 'none' : 'flex';
  }

  if (view === 'settings') {
    renderSettingsDayTemplatesUI();
  }

  renderAll();
  if (syncBackend && view !== 'settings' && !isDemoMode()) {
    await syncWeekDataWithApi(renderAll);
  }
}

async function onAuthSuccess(user) {
  DOM.userDisplayName.textContent = user.displayName || user.email.split('@')[0];
  if (DOM.userAvatarImg) {
    if (user.avatarUrl) {
      DOM.userAvatarImg.src = user.avatarUrl;
      DOM.userAvatarImg.style.display = 'inline-block';
      if (DOM.userDefaultIcon) DOM.userDefaultIcon.style.display = 'none';
    } else {
      DOM.userAvatarImg.style.display = 'none';
      if (DOM.userDefaultIcon) DOM.userDefaultIcon.style.display = 'inline-block';
    }
  }
  DOM.loginScreen.style.display = 'none';
  DOM.app.style.display = 'flex';
  
  loadStateFromStorage();
  if (DOM.habitDateInput && !DOM.habitDateInput.value) {
    DOM.habitDateInput.value = formatDateISO(new Date());
  }
  ensureSampleDataForCurrentWeek();
  const initialView = getSavedActiveView();
  await switchView(initialView, false);
  initNotificationEngine();
  initHeaderLayoutManager();
  startCurrentSlotTicker();
  if (!isDemoMode()) {
    await syncWeekDataWithApi(renderAll);
    syncDayTemplatesFromApi();
  }
  if (STATE.failedNotesWeekKeys && STATE.failedNotesWeekKeys.size > 0) {
    flushCurrentNoteEditor();
  }
}

function showLoginScreen() {
  DOM.app.style.display = 'none';
  DOM.loginScreen.style.display = 'flex';
  switchLandingTab('signin');
}

function switchLandingTab(tab, params = null) {
  // Hide all landing forms initially
  if (DOM.landingLoginForm) DOM.landingLoginForm.style.display = 'none';
  if (DOM.landingRegisterForm) DOM.landingRegisterForm.style.display = 'none';
  if (DOM.landingForgotPasswordForm) DOM.landingForgotPasswordForm.style.display = 'none';
  if (DOM.landingResetPasswordForm) DOM.landingResetPasswordForm.style.display = 'none';

  if (tab === 'signin') {
    if (DOM.authTabs) DOM.authTabs.style.display = 'flex';
    if (DOM.tabLandingSignIn) DOM.tabLandingSignIn.classList.add('active');
    if (DOM.tabLandingRegister) DOM.tabLandingRegister.classList.remove('active');
    if (DOM.landingLoginForm) DOM.landingLoginForm.style.display = 'block';
    if (DOM.googleAuthSection && googleAuthInitialized) DOM.googleAuthSection.style.display = 'block';
    if (DOM.landingLoginErrorMsg) DOM.landingLoginErrorMsg.style.display = 'none';
  } else if (tab === 'register') {
    if (DOM.authTabs) DOM.authTabs.style.display = 'flex';
    if (DOM.tabLandingRegister) DOM.tabLandingRegister.classList.add('active');
    if (DOM.tabLandingSignIn) DOM.tabLandingSignIn.classList.remove('active');
    if (DOM.landingRegisterForm) DOM.landingRegisterForm.style.display = 'block';
    if (DOM.googleAuthSection && googleAuthInitialized) DOM.googleAuthSection.style.display = 'block';
    if (DOM.landingRegisterErrorMsg) DOM.landingRegisterErrorMsg.style.display = 'none';
  } else if (tab === 'forgot') {
    if (DOM.authTabs) DOM.authTabs.style.display = 'none';
    if (DOM.landingForgotPasswordForm) DOM.landingForgotPasswordForm.style.display = 'block';
    if (DOM.googleAuthSection) DOM.googleAuthSection.style.display = 'none';
    if (DOM.landingForgotStatusMsg) DOM.landingForgotStatusMsg.style.display = 'none';
    if (DOM.landingForgotEmail) DOM.landingForgotEmail.focus();
  } else if (tab === 'reset') {
    if (DOM.authTabs) DOM.authTabs.style.display = 'none';
    if (DOM.landingResetPasswordForm) DOM.landingResetPasswordForm.style.display = 'block';
    if (DOM.googleAuthSection) DOM.googleAuthSection.style.display = 'none';
    if (DOM.landingResetStatusMsg) DOM.landingResetStatusMsg.style.display = 'none';
    if (params) {
      if (DOM.landingResetToken) DOM.landingResetToken.value = params.token || '';
      if (DOM.landingResetEmail) DOM.landingResetEmail.value = params.email || '';
    }
  }
}

function bindEvents() {
  // Listen for reset password URL navigation
  window.addEventListener('hashchange', () => {
    const resetParams = getResetPasswordParams();
    if (resetParams && resetParams.token && resetParams.email) {
      DOM.app.style.display = 'none';
      DOM.loginScreen.style.display = 'flex';
      switchLandingTab('reset', resetParams);
    }
  });

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
      const view = btn.dataset.view;
      await switchView(view, true);
    });
  });

  window.addEventListener('hashchange', () => {
    const hash = (window.location.hash || '').replace('#', '').trim().toLowerCase();
    if (VALID_VIEWS.includes(hash) && hash !== STATE.activeView) {
      switchView(hash, false);
    }
  });

  // Schedule View Granularity Selector (Day / Week / Month)
  DOM.viewModeBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      await flushCurrentNoteEditor();
      const newMode = btn.dataset.mode;
      setScheduleViewMode(newMode);
      if (newMode === 'day') {
        setActiveSheetId('daily_journal');
      } else if (getActiveSheetId() === 'daily_journal') {
        setActiveSheetId('journal');
      }
      renderAll();
      await syncWeekDataWithApi(renderAll);
    });
  });

  // Navigation Buttons
  DOM.prevWeekBtn.addEventListener('click', async () => await navigateDate('prev'));
  DOM.nextWeekBtn.addEventListener('click', async () => await navigateDate('next'));
  DOM.todayBtn.addEventListener('click', async () => await navigateDate('today'));

  // Date Picker
  DOM.weekDatePicker.addEventListener('change', async (e) => {
    const val = e.target.value;
    if (val) {
      await flushCurrentNoteEditor();
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

    setCancelAutosaveCallback(() => {
      if (notesAutosaveTimer) {
        clearTimeout(notesAutosaveTimer);
        notesAutosaveTimer = null;
      }
    });

    const flushNotesToApi = async () => {
      if (notesAutosaveTimer) {
        clearTimeout(notesAutosaveTimer);
        notesAutosaveTimer = null;
      }
      await flushCurrentNoteEditor();
    };

    DOM.weeklyNotesTextarea.addEventListener('input', () => {
      const weekKey = getWeekKey(STATE.currentWeekStart);
      const sheetId = getActiveSheetId();
      const dateKey = getSelectedDateISO();
      markNotesDirty({ weekKey, sheetId, dateKey });
      const weekData = getCurrentWeekData();
      const sheets = weekData.noteSheets || [];
      const currentActive = sheets.find(s => s.id === sheetId) || sheets[0];
      if (currentActive) {
        setSheetContent(currentActive, DOM.weeklyNotesTextarea.value);
      } else {
        weekData.notes = DOM.weeklyNotesTextarea.value;
      }
      saveStateToStorage();
      DOM.notesSavedStatus.textContent = 'Saving...';
      
      // Debounce network write (600ms) to prevent request races and server flooding
      if (notesAutosaveTimer) clearTimeout(notesAutosaveTimer);
      notesAutosaveTimer = setTimeout(flushNotesToApi, 600);
    });

    DOM.weeklyNotesTextarea.addEventListener('blur', async () => {
      if (notesAutosaveTimer) {
        clearTimeout(notesAutosaveTimer);
        notesAutosaveTimer = null;
      }
      await flushCurrentNoteEditor();
    });
  }

  // Grid keyboard shortcuts (Ctrl+C, Ctrl+V, Ctrl+D, Ctrl+Z, Ctrl+Y, Arrows, Enter, Delete, Escape, Space/D/P/X/U, e/F2)
  initGridShortcuts();
  initGridContextMenu();
  initStatusQuickMenu();
  initInlineEditing();

  // Clear cell selection when clicking outside grid cells or modal
  document.addEventListener('click', (e) => {
    if (
      !e.target.closest('.slot-cell') &&
      !e.target.closest('#taskModal') &&
      !e.target.closest('#bulkActionBar') &&
      !e.target.closest('#bulkAssignTaskModal') &&
      !e.target.closest('#bulkClearConfirmModal') &&
      !e.target.closest('.modal-overlay') &&
      !e.target.closest('#gridContextMenu') &&
      !e.target.closest('#statusQuickMenu') &&
      !e.target.closest('.inline-title-input') &&
      !e.target.closest('.inline-duration-input')
    ) {
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
    if (document.querySelector('.modal-overlay.active')) return;
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

    // 8. Keyboard Status Shortcuts & Modal Opening
    // Space or 'd'/'D' -> Toggle Done/Pending if slot has a task; if empty slot, Space opens modal
    if (e.key === ' ' || ((e.key === 'd' || e.key === 'D') && !isCmdOrCtrl && !e.altKey)) {
      if (!STATE.selectedSlotKey) return;
      const weekKey = getSlotWeekKey(STATE.selectedSlotKey);
      const slotData = STATE.scheduleData[weekKey]?.slots?.[STATE.selectedSlotKey];
      if (slotData && (slotData.plannedTask || slotData.actualTask || slotData.title)) {
        e.preventDefault();
        await toggleSlotDone(STATE.selectedSlotKey);
        return;
      } else if (e.key === ' ') {
        e.preventDefault();
        const targetTd = document.querySelector(`.slot-cell[data-slot-key="${STATE.selectedSlotKey}"]`);
        const dayName = targetTd?.dataset?.dayName || '';
        const timeLabel = targetTd?.dataset?.timeLabel || '';
        openTaskModal(STATE.selectedSlotKey, dayName, timeLabel, slotData);
        return;
      }
    }

    // 'p'/'P' -> Mark Partially Done
    if ((e.key === 'p' || e.key === 'P') && !isCmdOrCtrl && !e.altKey) {
      if (!STATE.selectedSlotKey) return;
      const weekKey = getSlotWeekKey(STATE.selectedSlotKey);
      const slotData = STATE.scheduleData[weekKey]?.slots?.[STATE.selectedSlotKey];
      if (slotData && (slotData.plannedTask || slotData.actualTask || slotData.title)) {
        e.preventDefault();
        await changeSlotStatus(STATE.selectedSlotKey, 'Partially Done');
        return;
      }
    }

    // 'x'/'X' -> Mark Not Done
    if ((e.key === 'x' || e.key === 'X') && !isCmdOrCtrl && !e.altKey) {
      if (!STATE.selectedSlotKey) return;
      const weekKey = getSlotWeekKey(STATE.selectedSlotKey);
      const slotData = STATE.scheduleData[weekKey]?.slots?.[STATE.selectedSlotKey];
      if (slotData && (slotData.plannedTask || slotData.actualTask || slotData.title)) {
        e.preventDefault();
        await changeSlotStatus(STATE.selectedSlotKey, 'Not Done');
        return;
      }
    }

    // 'u'/'U' -> Mark Pending
    if ((e.key === 'u' || e.key === 'U') && !isCmdOrCtrl && !e.altKey) {
      if (!STATE.selectedSlotKey) return;
      const weekKey = getSlotWeekKey(STATE.selectedSlotKey);
      const slotData = STATE.scheduleData[weekKey]?.slots?.[STATE.selectedSlotKey];
      if (slotData && (slotData.plannedTask || slotData.actualTask || slotData.title)) {
        e.preventDefault();
        await changeSlotStatus(STATE.selectedSlotKey, 'Pending');
        return;
      }
    }

    // 'e' or 'F2' -> Start inline title edit for selected slot
    if (e.key === 'F2' || ((e.key === 'e' || e.key === 'E') && !isCmdOrCtrl && !e.altKey)) {
      if (!STATE.selectedSlotKey) return;
      const weekKey = getSlotWeekKey(STATE.selectedSlotKey);
      const slotData = STATE.scheduleData[weekKey]?.slots?.[STATE.selectedSlotKey];
      if (slotData && (slotData.plannedTask || slotData.actualTask || slotData.title)) {
        e.preventDefault();
        startInlineTitleEdit(STATE.selectedSlotKey);
        return;
      }
    }

    // Enter -> Open Modal for selected slot
    if (e.key === 'Enter') {
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

  // Reusable Day Templates Controller
  initDayTemplateControllers();
}

async function handleUndo() {
  if (!STATE.undoStack || STATE.undoStack.length === 0) {
    showToast('Nothing to undo', 'info');
    return;
  }

  const action = STATE.undoStack.pop();

  if (action.type === 'bulk_edit') {
    const { affectedSlots, previousSlotsSnapshot, label } = action;
    for (const { weekKey, slotKey } of (affectedSlots || [])) {
      if (!STATE.scheduleData[weekKey]) {
        STATE.scheduleData[weekKey] = { slots: {}, habits: [], todos: [], notes: '', noteSheets: [] };
      }
      const weekData = STATE.scheduleData[weekKey];
      if (previousSlotsSnapshot && previousSlotsSnapshot[slotKey]) {
        weekData.slots[slotKey] = JSON.parse(JSON.stringify(previousSlotsSnapshot[slotKey]));
        try { await ApiClient.saveSlot(weekKey, slotKey, weekData.slots[slotKey]); } catch (e) {}
      } else {
        delete weekData.slots[slotKey];
        try { await ApiClient.deleteSlot(weekKey, slotKey); } catch (e) {}
      }
    }

    saveStateToStorage();
    renderGrid(DOM.scheduleTableBody, handleSwitchToDayView);
    renderAnalytics(DOM.statPlannedHours, DOM.statActualHours, DOM.statScore, DOM.categoryBarsContainer);
    showToast(`↩️ Undone: Bulk ${label || 'Edit'} (${affectedSlots.length} slots)`, 'info');
    STATE.redoStack.push(action);
    return;
  }

  if (action.type === 'day_template_apply') {
    const { weekKey, appliedSlots, previousSlotsSnapshot, label } = action;
    if (!STATE.scheduleData[weekKey]) {
      STATE.scheduleData[weekKey] = { slots: {}, habits: [], todos: [], notes: '', noteSheets: [] };
    }
    const weekData = STATE.scheduleData[weekKey];

    for (const sKey of (appliedSlots || [])) {
      if (previousSlotsSnapshot && previousSlotsSnapshot[sKey]) {
        weekData.slots[sKey] = JSON.parse(JSON.stringify(previousSlotsSnapshot[sKey]));
        try { await ApiClient.saveSlot(weekKey, sKey, weekData.slots[sKey]); } catch (e) {}
      } else {
        delete weekData.slots[sKey];
        try { await ApiClient.deleteSlot(weekKey, sKey); } catch (e) {}
      }
    }

    saveStateToStorage();
    renderGrid(DOM.scheduleTableBody, handleSwitchToDayView);
    renderAnalytics(DOM.statPlannedHours, DOM.statActualHours, DOM.statScore, DOM.categoryBarsContainer);
    showToast(`↩️ Undone: Template "${label || 'Day Template'}"`, 'info');
    STATE.redoStack.push(action);
    return;
  }

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

  if (action.type === 'bulk_edit') {
    const { affectedSlots, newSlotsSnapshot, label } = action;
    for (const { weekKey, slotKey } of (affectedSlots || [])) {
      if (!STATE.scheduleData[weekKey]) {
        STATE.scheduleData[weekKey] = { slots: {}, habits: [], todos: [], notes: '', noteSheets: [] };
      }
      const weekData = STATE.scheduleData[weekKey];
      if (newSlotsSnapshot && newSlotsSnapshot[slotKey]) {
        weekData.slots[slotKey] = JSON.parse(JSON.stringify(newSlotsSnapshot[slotKey]));
        try { await ApiClient.saveSlot(weekKey, slotKey, weekData.slots[slotKey]); } catch (e) {}
      } else {
        delete weekData.slots[slotKey];
        try { await ApiClient.deleteSlot(weekKey, slotKey); } catch (e) {}
      }
    }

    saveStateToStorage();
    renderGrid(DOM.scheduleTableBody, handleSwitchToDayView);
    renderAnalytics(DOM.statPlannedHours, DOM.statActualHours, DOM.statScore, DOM.categoryBarsContainer);
    showToast(`↪️ Redone: Bulk ${label || 'Edit'} (${affectedSlots.length} slots)`, 'info');
    STATE.undoStack.push(action);
    return;
  }

  if (action.type === 'day_template_apply') {
    const { weekKey, newSlotsSnapshot, label } = action;
    if (!STATE.scheduleData[weekKey]) {
      STATE.scheduleData[weekKey] = { slots: {}, habits: [], todos: [], notes: '', noteSheets: [] };
    }
    const weekData = STATE.scheduleData[weekKey];

    for (const [sKey, slotData] of Object.entries(newSlotsSnapshot || {})) {
      weekData.slots[sKey] = JSON.parse(JSON.stringify(slotData));
      try { await ApiClient.saveSlot(weekKey, sKey, slotData); } catch (e) {}
    }

    saveStateToStorage();
    renderGrid(DOM.scheduleTableBody, handleSwitchToDayView);
    renderAnalytics(DOM.statPlannedHours, DOM.statActualHours, DOM.statScore, DOM.categoryBarsContainer);
    showToast(`↪️ Redone: Template "${label || 'Day Template'}"`, 'info');
    STATE.undoStack.push(action);
    return;
  }

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
  const currentStatus = slotData?.status || 'Pending';

  let statusSectionHtml = '';
  if (hasTask) {
    statusSectionHtml = `
      <div class="context-menu-section-header">Set Status</div>
      <div class="context-menu-status-chips">
        <button type="button" class="status-chip-btn ${currentStatus === 'Done' ? 'active' : ''}" data-set-status="Done">✅ Done</button>
        <button type="button" class="status-chip-btn ${currentStatus === 'Partially Done' ? 'active' : ''}" data-set-status="Partially Done">🟡 Partial</button>
        <button type="button" class="status-chip-btn ${currentStatus === 'Not Done' ? 'active' : ''}" data-set-status="Not Done">❌ Missed</button>
        <button type="button" class="status-chip-btn ${currentStatus === 'Pending' ? 'active' : ''}" data-set-status="Pending">⚪ Plan</button>
      </div>
      <div class="context-menu-divider"></div>
    `;
  }

  contextMenuEl.innerHTML = `
    ${statusSectionHtml}
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

  // Attach click listener to status chips in context menu
  contextMenuEl.querySelectorAll('.status-chip-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const targetStatus = btn.dataset.setStatus;
      hideContextMenu();
      if (targetStatus) {
        await changeSlotStatus(slotKey, targetStatus);
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

/* ==========================================================================
   INTERACTIVE TASK STATUS CONTROLLERS
   ========================================================================== */

export async function changeSlotStatus(slotKey, newStatus) {
  if (!slotKey || !newStatus) return;
  const weekKey = getSlotWeekKey(slotKey);
  if (!STATE.scheduleData[weekKey]) {
    STATE.scheduleData[weekKey] = { slots: {}, habits: [], todos: [], notes: '', noteSheets: [] };
  }
  const weekData = STATE.scheduleData[weekKey];
  const existing = weekData.slots[slotKey];
  if (!existing || (!existing.plannedTask && !existing.actualTask && !existing.title)) return;

  const currentStatus = existing.status || 'Pending';
  if (currentStatus === newStatus) return;

  const previousData = JSON.parse(JSON.stringify(existing));

  let newActualDuration = existing.actual !== undefined ? existing.actual : 0;
  
  // Smart duration updates based on status
  if (newStatus === 'Not Done') {
    newActualDuration = 0;
  } else if (newStatus === 'Done') {
    newActualDuration = existing.planned || 30;
  } else if (newStatus === 'Partially Done') {
    newActualDuration = Math.round((existing.planned || 30) / 2);
  } else if (newStatus === 'Pending') {
    newActualDuration = 0;
  }

  const updatedSlotObject = {
    ...existing,
    status: newStatus,
    actual: newActualDuration
  };

  recordUndoAction({
    type: 'slot_edit',
    weekKey,
    slotKey,
    previousData,
    newData: JSON.parse(JSON.stringify(updatedSlotObject)),
    label: `${updatedSlotObject.plannedTask || updatedSlotObject.actualTask || 'Task'} -> ${newStatus}`
  });

  weekData.slots[slotKey] = updatedSlotObject;
  markSlotPendingSave(weekKey, slotKey, updatedSlotObject);
  saveStateToStorage();
  renderGrid(DOM.scheduleTableBody, handleSwitchToDayView);
  renderAnalytics(DOM.statPlannedHours, DOM.statActualHours, DOM.statScore, DOM.categoryBarsContainer);
  selectSlotCell(slotKey);

  // If partially done, activate inline duration edit so user can immediately tweak minutes
  if (newStatus === 'Partially Done') {
    setTimeout(() => {
      startInlineDurationEdit(slotKey);
    }, 60);
  }

  let saveOk = false;
  try {
    saveOk = await ApiClient.saveSlot(weekKey, slotKey, updatedSlotObject);
  } catch (err) {
    console.error('Failed to sync slot status to backend:', err);
    saveOk = false;
  }

  if (saveOk) {
    clearSlotPendingSave(slotKey);
    const statusIcons = {
      'Done': '✅',
      'Partially Done': '🟡',
      'Not Done': '❌',
      'Pending': '⚪'
    };
    const icon = statusIcons[newStatus] || '✨';
    showToast(`${icon} Status: ${newStatus}`, 'success');
  } else {
    showToast('⚠️ Server save failed. Status updated locally.', 'warning');
  }
}

export async function toggleSlotDone(slotKey) {
  if (!slotKey) return;
  const weekKey = getSlotWeekKey(slotKey);
  const slotData = STATE.scheduleData[weekKey]?.slots?.[slotKey];
  if (!slotData) return;

  const currentStatus = slotData.status || 'Pending';
  const targetStatus = currentStatus === 'Done' ? 'Pending' : 'Done';
  await changeSlotStatus(slotKey, targetStatus);
}

export async function cycleNextSlotStatus(slotKey) {
  if (!slotKey) return;
  const weekKey = getSlotWeekKey(slotKey);
  const slotData = STATE.scheduleData[weekKey]?.slots?.[slotKey];
  if (!slotData) return;

  const currentStatus = slotData.status || 'Pending';
  const cycleOrder = ['Pending', 'Done', 'Partially Done', 'Not Done'];
  const currentIndex = cycleOrder.indexOf(currentStatus);
  const nextStatus = cycleOrder[(currentIndex + 1) % cycleOrder.length];
  await changeSlotStatus(slotKey, nextStatus);
}

// Dedicated Quick Status Popover Menu Controller
let statusMenuEl = null;

function initStatusQuickMenu() {
  if (!statusMenuEl) {
    statusMenuEl = document.createElement('div');
    statusMenuEl.id = 'statusQuickMenu';
    statusMenuEl.className = 'status-quick-menu';
    statusMenuEl.style.display = 'none';
    document.body.appendChild(statusMenuEl);
  }

  // Delegated click on .status-quick-btn
  document.addEventListener('click', async (e) => {
    const statusBtn = e.target.closest('.status-quick-btn');
    if (statusBtn && STATE.activeView === 'grid') {
      e.preventDefault();
      e.stopPropagation();
      hideContextMenu();
      hideStatusQuickMenu();
      const slotKey = statusBtn.dataset.slotKey;
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) {
        await cycleNextSlotStatus(slotKey);
      } else {
        await toggleSlotDone(slotKey);
      }
      return;
    }

    if (statusMenuEl && !e.target.closest('#statusQuickMenu')) {
      hideStatusQuickMenu();
    }
  });

  // Right-click on .status-quick-btn opens dedicated micro-popover menu
  document.addEventListener('contextmenu', (e) => {
    const statusBtn = e.target.closest('.status-quick-btn');
    if (statusBtn && STATE.activeView === 'grid') {
      e.preventDefault();
      e.stopPropagation();
      const slotKey = statusBtn.dataset.slotKey;
      selectSlotCell(slotKey);
      showStatusQuickMenu(e.clientX, e.clientY, slotKey, statusBtn);
      return;
    }
  }, true);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hideStatusQuickMenu();
    }
  });
}

function hideStatusQuickMenu() {
  if (statusMenuEl) {
    statusMenuEl.style.display = 'none';
  }
}

function showStatusQuickMenu(x, y, slotKey, anchorEl) {
  if (!statusMenuEl) return;
  hideContextMenu();

  const weekKey = getSlotWeekKey(slotKey);
  const weekData = STATE.scheduleData[weekKey];
  const slotData = weekData?.slots?.[slotKey];
  if (!slotData) return;

  const currentStatus = slotData.status || 'Pending';

  statusMenuEl.innerHTML = `
    <div class="status-menu-header">Change Task Status</div>
    <button type="button" class="status-menu-item ${currentStatus === 'Done' ? 'active' : ''}" data-status="Done">
      <span class="status-menu-icon">✅</span>
      <span class="status-menu-label">Done (Completed)</span>
      <span class="status-menu-check">✓</span>
    </button>
    <button type="button" class="status-menu-item ${currentStatus === 'Partially Done' ? 'active' : ''}" data-status="Partially Done">
      <span class="status-menu-icon">🟡</span>
      <span class="status-menu-label">Partially Done</span>
      <span class="status-menu-check">✓</span>
    </button>
    <button type="button" class="status-menu-item ${currentStatus === 'Not Done' ? 'active' : ''}" data-status="Not Done">
      <span class="status-menu-icon">❌</span>
      <span class="status-menu-label">Not Done (Missed)</span>
      <span class="status-menu-check">✓</span>
    </button>
    <button type="button" class="status-menu-item ${currentStatus === 'Pending' ? 'active' : ''}" data-status="Pending">
      <span class="status-menu-icon">⚪</span>
      <span class="status-menu-label">Pending (Planned)</span>
      <span class="status-menu-check">✓</span>
    </button>
  `;

  statusMenuEl.style.display = 'flex';
  statusMenuEl.style.visibility = 'hidden';

  const rect = anchorEl ? anchorEl.getBoundingClientRect() : null;
  const menuW = 185;
  const menuH = statusMenuEl.offsetHeight || 160;
  const vpW = window.innerWidth;
  const vpH = window.innerHeight;

  let left = rect ? rect.left : x;
  let top = rect ? rect.bottom + 6 : y;

  if (left + menuW > vpW - 12) {
    left = vpW - menuW - 12;
  }
  if (top + menuH > vpH - 12) {
    if (rect) {
      top = Math.max(10, rect.top - menuH - 6);
    } else {
      top = Math.max(10, vpH - menuH - 12);
    }
  }

  statusMenuEl.style.left = `${Math.max(10, left)}px`;
  statusMenuEl.style.top = `${Math.max(10, top)}px`;
  statusMenuEl.style.visibility = 'visible';

  statusMenuEl.querySelectorAll('.status-menu-item').forEach(item => {
    item.addEventListener('click', async (e) => {
      e.stopPropagation();
      const targetStatus = item.dataset.status;
      hideStatusQuickMenu();
      if (targetStatus) {
        await changeSlotStatus(slotKey, targetStatus);
      }
    });
  });
}

/* ==========================================================================
   INLINE GRID TASK TITLE & DURATION EDITORS
   ========================================================================== */

export function startInlineTitleEdit(slotKey, titleEl = null) {
  if (!slotKey) return;
  if (!titleEl) {
    titleEl = document.querySelector(`.slot-cell[data-slot-key="${slotKey}"] .slot-title.inline-editable`);
  }
  if (!titleEl) return;
  if (titleEl.querySelector('input') || titleEl.tagName === 'INPUT') return;

  const currentTitle = titleEl.textContent.trim();
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'inline-title-input';
  input.value = currentTitle;
  input.dataset.slotKey = slotKey;

  titleEl.textContent = '';
  titleEl.appendChild(input);
  input.focus();
  input.select();

  let committed = false;

  const commit = async () => {
    if (committed) return;
    committed = true;
    const newTitle = input.value.trim();
    if (newTitle && newTitle !== currentTitle) {
      await saveInlineTaskTitle(slotKey, newTitle);
    } else {
      titleEl.textContent = currentTitle;
    }
  };

  const cancel = () => {
    if (committed) return;
    committed = true;
    titleEl.textContent = currentTitle;
  };

  input.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      await commit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      cancel();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      e.stopPropagation();
      await commit();
      setTimeout(() => startInlineDurationEdit(slotKey), 30);
    }
  });

  input.addEventListener('blur', async () => {
    await commit();
  });

  input.addEventListener('click', (e) => {
    e.stopPropagation();
  });
}

export async function saveInlineTaskTitle(slotKey, newTitle) {
  if (!slotKey || !newTitle) return;
  const weekKey = getSlotWeekKey(slotKey);
  if (!STATE.scheduleData[weekKey]) {
    STATE.scheduleData[weekKey] = { slots: {}, habits: [], todos: [], notes: '', noteSheets: [] };
  }
  const weekData = STATE.scheduleData[weekKey];
  const existing = weekData.slots[slotKey] || {};

  const previousData = JSON.parse(JSON.stringify(existing));
  const updatedSlotObject = {
    ...existing,
    actualTask: newTitle,
    title: newTitle,
    plannedTask: existing.plannedTask || newTitle
  };

  recordUndoAction({
    type: 'slot_edit',
    weekKey,
    slotKey,
    previousData,
    newData: JSON.parse(JSON.stringify(updatedSlotObject)),
    label: `Edit title: "${newTitle}"`
  });

  weekData.slots[slotKey] = updatedSlotObject;
  markSlotPendingSave(weekKey, slotKey, updatedSlotObject);
  saveStateToStorage();
  renderGrid(DOM.scheduleTableBody, handleSwitchToDayView);
  renderAnalytics(DOM.statPlannedHours, DOM.statActualHours, DOM.statScore, DOM.categoryBarsContainer);
  selectSlotCell(slotKey);

  let saveOk = false;
  try {
    saveOk = await ApiClient.saveSlot(weekKey, slotKey, updatedSlotObject);
  } catch (err) {
    console.error('Failed to sync slot title to backend:', err);
    saveOk = false;
  }

  if (saveOk) {
    clearSlotPendingSave(slotKey);
    showToast(`📝 Updated task: "${newTitle}"`, 'success');
  } else {
    showToast('⚠️ Server save failed. Title updated locally.', 'warning');
  }
}

export function startInlineDurationEdit(slotKey, badgeEl = null) {
  if (!slotKey) return;
  if (!badgeEl) {
    badgeEl = document.querySelector(`.slot-cell[data-slot-key="${slotKey}"] .actual-time-badge.inline-editable`);
  }
  if (!badgeEl) return;
  if (badgeEl.querySelector('input') || badgeEl.tagName === 'INPUT') return;

  const weekKey = getSlotWeekKey(slotKey);
  const slotData = STATE.scheduleData[weekKey]?.slots?.[slotKey];
  const currentActual = slotData?.actual !== undefined ? slotData.actual : 0;

  const input = document.createElement('input');
  input.type = 'number';
  input.className = 'inline-duration-input';
  input.min = '0';
  input.max = '720';
  input.step = '5';
  input.value = currentActual;
  input.dataset.slotKey = slotKey;

  const originalHtml = badgeEl.innerHTML;
  badgeEl.innerHTML = '';
  badgeEl.appendChild(input);
  input.focus();
  input.select();

  let committed = false;

  const commit = async () => {
    if (committed) return;
    committed = true;
    const parsed = parseInt(input.value, 10);
    const newMinutes = isNaN(parsed) ? 0 : Math.max(0, parsed);
    if (newMinutes !== currentActual) {
      await saveInlineDuration(slotKey, newMinutes);
    } else {
      badgeEl.innerHTML = originalHtml;
    }
  };

  const cancel = () => {
    if (committed) return;
    committed = true;
    badgeEl.innerHTML = originalHtml;
  };

  input.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      await commit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      cancel();
    }
  });

  input.addEventListener('blur', async () => {
    await commit();
  });

  input.addEventListener('click', (e) => {
    e.stopPropagation();
  });
}

export async function saveInlineDuration(slotKey, newMinutes) {
  if (!slotKey) return;
  const weekKey = getSlotWeekKey(slotKey);
  if (!STATE.scheduleData[weekKey]) {
    STATE.scheduleData[weekKey] = { slots: {}, habits: [], todos: [], notes: '', noteSheets: [] };
  }
  const weekData = STATE.scheduleData[weekKey];
  const existing = weekData.slots[slotKey] || {};

  const previousData = JSON.parse(JSON.stringify(existing));
  const updatedSlotObject = {
    ...existing,
    actual: newMinutes
  };

  recordUndoAction({
    type: 'slot_edit',
    weekKey,
    slotKey,
    previousData,
    newData: JSON.parse(JSON.stringify(updatedSlotObject)),
    label: `Edit actual duration: ${newMinutes}m`
  });

  weekData.slots[slotKey] = updatedSlotObject;
  markSlotPendingSave(weekKey, slotKey, updatedSlotObject);
  saveStateToStorage();
  renderGrid(DOM.scheduleTableBody, handleSwitchToDayView);
  renderAnalytics(DOM.statPlannedHours, DOM.statActualHours, DOM.statScore, DOM.categoryBarsContainer);
  selectSlotCell(slotKey);

  let saveOk = false;
  try {
    saveOk = await ApiClient.saveSlot(weekKey, slotKey, updatedSlotObject);
  } catch (err) {
    console.error('Failed to sync slot duration to backend:', err);
    saveOk = false;
  }

  if (saveOk) {
    clearSlotPendingSave(slotKey);
    showToast(`⏱️ Actual duration: ${newMinutes}m`, 'success');
  } else {
    showToast('⚠️ Server save failed. Duration updated locally.', 'warning');
  }
}

function initInlineEditing() {
  document.addEventListener('click', (e) => {
    if (STATE.activeView !== 'grid') return;

    // 1. Click on .slot-title.inline-editable
    const titleEl = e.target.closest('.slot-title.inline-editable');
    if (titleEl) {
      e.preventDefault();
      e.stopPropagation();
      const td = titleEl.closest('.slot-cell');
      const slotKey = titleEl.dataset.slotKey || td?.dataset?.slotKey;
      if (slotKey) {
        selectSlotCell(slotKey, td);
        startInlineTitleEdit(slotKey, titleEl);
      }
      return;
    }

    // 2. Click on .actual-time-badge.inline-editable
    const badgeEl = e.target.closest('.actual-time-badge.inline-editable');
    if (badgeEl) {
      e.preventDefault();
      e.stopPropagation();
      const td = badgeEl.closest('.slot-cell');
      const slotKey = badgeEl.dataset.slotKey || td?.dataset?.slotKey;
      if (slotKey) {
        selectSlotCell(slotKey, td);
        startInlineDurationEdit(slotKey, badgeEl);
      }
      return;
    }
  });
}


async function navigateDate(direction) {
  await flushCurrentNoteEditor();
  if (direction === 'today') {
    const now = new Date();
    STATE.selectedDate = now;
    STATE.currentWeekStart = getMonday(now);
    resetGridAutoScroll();
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
  await flushCurrentNoteEditor();
  const [y, m, d] = targetDateStr.split('-').map(Number);
  const targetDate = new Date(y, m - 1, d);
  STATE.selectedDate = targetDate;
  STATE.currentWeekStart = getMonday(targetDate);
  setScheduleViewMode('day');
  setActiveSheetId('daily_journal');

  renderAll();
  await syncWeekDataWithApi(renderAll);
}

function updateViewModeButtons() {
  if (DOM.viewModeBtns) {
    const currentMode = STATE.scheduleViewMode || 'week';
    DOM.viewModeBtns.forEach(b => {
      b.classList.toggle('active', b.dataset.mode === currentMode);
    });
  }
}

function renderAll() {
  updateViewModeButtons();
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

/**
 * Dynamic Header Layout Manager (Single Source of Truth)
 * Monitors header bounding boxes and ensures action buttons and navigation
 * never render off-screen or overlap across any viewport width (Findings 35 & 36).
 */
export function initHeaderLayoutManager() {
  const header = document.querySelector('.app-header');
  if (!header) return;

  const updateHeader = () => {
    const windowWidth = window.innerWidth;
    // On mobile (< 768px), mobile bottom bar handles nav
    if (windowWidth < 768) {
      header.classList.remove('nav-compact', 'actions-compact', 'brand-compact');
      return;
    }

    const headerActions = header.querySelector('.header-actions');
    const brand = header.querySelector('.brand');
    const nav = header.querySelector('.view-nav');
    const userDisplayName = header.querySelector('#userDisplayName');
    if (!headerActions || !brand || !nav) return;

    const getRightmostActionEdge = () => {
      let maxRight = 0;
      const elements = headerActions.querySelectorAll('button, .user-badge');
      elements.forEach(el => {
        if (el.offsetWidth > 0 || (el.getClientRects && el.getClientRects().length > 0)) {
          const r = el.getBoundingClientRect().right;
          if (r > maxRight) maxRight = r;
        }
      });
      return maxRight > 0 ? maxRight : headerActions.getBoundingClientRect().right;
    };

    // Check if right edge exceeds viewport
    const isOverflowing = getRightmostActionEdge() > windowWidth - 4;

    if (isOverflowing) {
      // Step 1: compact actions
      if (!header.classList.contains('actions-compact')) {
        header.classList.add('actions-compact');
      }
      // Step 2: if still overflowing, compact nav
      if (getRightmostActionEdge() > windowWidth - 4 && !header.classList.contains('nav-compact')) {
        header.classList.add('nav-compact');
      }
      // Step 3: if still tight (e.g. tablet edge), compact brand
      if (getRightmostActionEdge() > windowWidth - 4 && !header.classList.contains('brand-compact')) {
        header.classList.add('brand-compact');
      }
    } else {
      // Calculate true available space (slack) inside header
      // .app-header uses flexbox with justify-content: space-between, which pushes .header-actions
      // flush to the right edge. Hence measuring getRightmostActionEdge() alone gives ~windowWidth,
      // which would make (edge + delta <= windowWidth) impossible to satisfy (Finding 40).
      // Instead, we measure the total width occupied by the three children (brand, nav, headerActions)
      // and compare it to the available content width inside the header container.
      const headerStyle = window.getComputedStyle(header);
      const paddingLeft = parseFloat(headerStyle.paddingLeft) || 0;
      const paddingRight = parseFloat(headerStyle.paddingRight) || 0;
      const availableWidth = header.clientWidth - (paddingLeft + paddingRight);
      const brandWidth = brand.getBoundingClientRect().width;
      const navWidth = nav.getBoundingClientRect().width;
      const actionsWidth = headerActions.getBoundingClientRect().width;
      let slack = availableWidth - (brandWidth + navWidth + actionsWidth);

      // Release Step 3: Brand compact (re-enable brand badge)
      if (header.classList.contains('brand-compact')) {
        const brandDelta = 75;
        if (slack >= brandDelta + 28) {
          header.classList.remove('brand-compact');
          if (getRightmostActionEdge() > windowWidth - 4) {
            header.classList.add('brand-compact');
          } else {
            slack -= brandDelta;
          }
        }
      }

      // Release Step 2: Nav compact (re-enable nav button text)
      // Only release if nav text labels (~420px) fit with at least 28px headroom
      // and brand-compact is not active
      if (header.classList.contains('nav-compact') && !header.classList.contains('brand-compact')) {
        const navDelta = 420;
        if (slack >= navDelta + 28) {
          header.classList.remove('nav-compact');
          if (getRightmostActionEdge() > windowWidth - 4) {
            header.classList.add('nav-compact');
          } else {
            slack -= navDelta;
          }
        }
      }

      // Release Step 1: Actions compact (re-enable action button labels & unclamp user name)
      // Only release if windowWidth >= 1520 (below which CSS media query enforces compaction anyway)
      // and uncompacted actions (labels ~150px + natural display name width) fit with at least 28px headroom
      // and nav-compact is not active
      if (header.classList.contains('actions-compact') && !header.classList.contains('nav-compact')) {
        if (windowWidth >= 1520) {
          const nameOverflow = userDisplayName ? Math.max(0, userDisplayName.scrollWidth - userDisplayName.clientWidth) : 0;
          const actionsDelta = 150 + nameOverflow;
          if (slack >= actionsDelta + 28) {
            header.classList.remove('actions-compact');
            if (getRightmostActionEdge() > windowWidth - 4) {
              header.classList.add('actions-compact');
            } else {
              slack -= actionsDelta;
            }
          }
        }
      }
    }
  };

  updateHeader();
  window.addEventListener('resize', updateHeader);
  if (typeof ResizeObserver !== 'undefined') {
    let rafId = null;
    const scheduleUpdate = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        updateHeader();
        rafId = null;
      });
    };
    const ro = new ResizeObserver(scheduleUpdate);
    ro.observe(header);
    const headerActions = header.querySelector('.header-actions');
    if (headerActions) ro.observe(headerActions);
    const nav = header.querySelector('.view-nav');
    if (nav) ro.observe(nav);
  }
}

/* ==========================================================================
   REUSABLE DAY TEMPLATES CONTROLLERS
   ========================================================================== */

function initDayTemplateControllers() {
  // 1. Delegated clicks for Day Template triggers
  document.addEventListener('click', (e) => {
    // Week View day header template button
    const tmplBtn = e.target.closest('.day-template-action-btn');
    if (tmplBtn && tmplBtn.dataset.date) {
      e.stopPropagation();
      openApplyDayTemplateModal(tmplBtn.dataset.date);
      return;
    }

    // Day View header Apply button
    const dayApplyBtn = e.target.closest('.day-view-apply-template-btn');
    if (dayApplyBtn && dayApplyBtn.dataset.date) {
      e.stopPropagation();
      openApplyDayTemplateModal(dayApplyBtn.dataset.date);
      return;
    }

    // Day View header Save as Template button
    const daySaveBtn = e.target.closest('.day-view-save-template-btn');
    if (daySaveBtn && daySaveBtn.dataset.date) {
      e.stopPropagation();
      openSaveDayAsTemplateModal(daySaveBtn.dataset.date);
      return;
    }
  });

  // 2. Apply Day Template Modal controls
  const applyModal = document.getElementById('applyDayTemplateModal');
  const closeApplyBtn = document.getElementById('closeApplyDayTemplateModalBtn');
  const cancelApplyBtn = document.getElementById('cancelApplyDayTemplateBtn');
  const confirmApplyBtn = document.getElementById('confirmApplyDayTemplateBtn');
  const templateSelect = document.getElementById('applyDayTemplateSelect');

  if (closeApplyBtn) closeApplyBtn.addEventListener('click', closeApplyDayTemplateModal);
  if (cancelApplyBtn) cancelApplyBtn.addEventListener('click', closeApplyDayTemplateModal);
  if (applyModal) {
    applyModal.addEventListener('click', (e) => {
      if (e.target === applyModal) closeApplyDayTemplateModal();
    });
  }
  if (templateSelect) {
    templateSelect.addEventListener('change', updateApplyDayTemplatePreview);
  }
  if (confirmApplyBtn) {
    confirmApplyBtn.addEventListener('click', () => {
      const dateStr = document.getElementById('applyDayTemplateTargetDate')?.value;
      const templateId = templateSelect?.value;
      if (dateStr && templateId) {
        applyDayTemplate(dateStr, templateId);
      }
    });
  }

  // 3. Save Current Day as Template Modal controls
  const saveModal = document.getElementById('saveDayAsTemplateModal');
  const closeSaveBtn = document.getElementById('closeSaveDayAsTemplateModalBtn');
  const cancelSaveBtn = document.getElementById('cancelSaveDayAsTemplateBtn');
  const confirmSaveBtn = document.getElementById('confirmSaveDayAsTemplateBtn');

  if (closeSaveBtn) closeSaveBtn.addEventListener('click', closeSaveDayAsTemplateModal);
  if (cancelSaveBtn) cancelSaveBtn.addEventListener('click', closeSaveDayAsTemplateModal);
  if (saveModal) {
    saveModal.addEventListener('click', (e) => {
      if (e.target === saveModal) closeSaveDayAsTemplateModal();
    });
  }
  if (confirmSaveBtn) {
    confirmSaveBtn.addEventListener('click', saveDayAsTemplateFromModal);
  }
}

export function openApplyDayTemplateModal(dateStr) {
  if (!dateStr) return;
  const modal = document.getElementById('applyDayTemplateModal');
  if (!modal) return;

  const targetDateInput = document.getElementById('applyDayTemplateTargetDate');
  const targetDateText = document.getElementById('applyDayTemplateTargetDateText');
  const select = document.getElementById('applyDayTemplateSelect');

  if (targetDateInput) targetDateInput.value = dateStr;
  if (targetDateText) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
    targetDateText.textContent = `Applying to ${dayName}, ${formatDateDisplay(dateStr)}`;
  }

  const templates = getDayTemplates();
  if (select) {
    if (templates.length === 0) {
      select.innerHTML = '<option value="">(No templates created yet)</option>';
    } else {
      select.innerHTML = templates.map(t => {
        const slotCount = Object.keys(t.slots || {}).length;
        return `<option value="${t.id}">${escapeAppHtml(t.name)} (${slotCount} slots)</option>`;
      }).join('');
    }
  }

  updateApplyDayTemplatePreview();
  modal.classList.add('active');
}

export function closeApplyDayTemplateModal() {
  const modal = document.getElementById('applyDayTemplateModal');
  if (modal) modal.classList.remove('active');
}

export function updateApplyDayTemplatePreview() {
  const dateStr = document.getElementById('applyDayTemplateTargetDate')?.value;
  const select = document.getElementById('applyDayTemplateSelect');
  const statsEl = document.getElementById('applyDayTemplatePreviewStats');
  const listEl = document.getElementById('applyDayTemplatePreviewList');
  const applyBtn = document.getElementById('confirmApplyDayTemplateBtn');

  if (!dateStr || !select || !listEl) return;

  const templateId = select.value;
  const template = getDayTemplateById(templateId);

  if (!template || !template.slots || Object.keys(template.slots).length === 0) {
    listEl.innerHTML = '<div style="color: var(--text-muted); font-size: 0.8rem; text-align: center; padding: 1rem;">No slots configured in this template.</div>';
    if (statsEl) statsEl.textContent = '0 slots';
    if (applyBtn) applyBtn.disabled = true;
    return;
  }

  const weekKey = getSlotWeekKey(`${dateStr}_00:00`);
  const weekData = STATE.scheduleData[weekKey] || { slots: {} };
  const slots = template.slots;
  const sortedTimes = Object.keys(slots).sort();

  let willAddCount = 0;
  let willSkipCount = 0;

  const rowsHtml = sortedTimes.map(timeKey => {
    const tmplSlot = slots[timeKey];
    const targetSlotKey = `${dateStr}_${timeKey}`;
    const existing = weekData.slots[targetSlotKey];
    const isOccupied = !!(existing && (existing.plannedTask || existing.actualTask || existing.title));

    if (isOccupied) {
      willSkipCount++;
      const existingTitle = existing.actualTask || existing.plannedTask || existing.title || 'Task';
      return `
        <div class="apply-preview-slot-row will-skip">
          <div>
            <strong>${timeKey}</strong>: ${escapeAppHtml(tmplSlot.title || 'Task')}
            <div style="font-size: 0.72rem; color: #f59e0b; margin-top: 2px;">Kept existing: "${escapeAppHtml(existingTitle)}"</div>
          </div>
          <span class="apply-tag-skip">Kept (Occupied)</span>
        </div>
      `;
    } else {
      willAddCount++;
      return `
        <div class="apply-preview-slot-row will-apply">
          <div>
            <strong>${timeKey}</strong>: ${escapeAppHtml(tmplSlot.title || 'Task')}
            <span style="font-size: 0.72rem; color: var(--text-muted); margin-left: 4px;">(${tmplSlot.category || 'General'}, 30m)</span>
          </div>
          <span class="apply-tag-apply">+ Will Apply</span>
        </div>
      `;
    }
  }).join('');

  listEl.innerHTML = rowsHtml;
  if (statsEl) {
    statsEl.innerHTML = `<span style="color: #10b981;">+${willAddCount} to add</span> • <span style="color: #f59e0b;">${willSkipCount} kept</span>`;
  }
  if (applyBtn) {
    applyBtn.disabled = (willAddCount === 0);
  }
}

export async function applyDayTemplate(dateStr, templateId) {
  if (!dateStr || !templateId) return;
  const template = getDayTemplateById(templateId);
  if (!template || !template.slots) return;

  const weekKey = getSlotWeekKey(`${dateStr}_00:00`);
  if (!STATE.scheduleData[weekKey]) {
    STATE.scheduleData[weekKey] = { slots: {}, habits: [], todos: [], notes: '', noteSheets: [] };
  }
  const weekData = STATE.scheduleData[weekKey];

  const appliedSlots = [];
  const previousSlotsSnapshot = {};
  const newSlotsSnapshot = {};

  const sortedTimes = Object.keys(template.slots).sort();

  for (const timeKey of sortedTimes) {
    const tmplSlot = template.slots[timeKey];
    const targetSlotKey = `${dateStr}_${timeKey}`;
    const existing = weekData.slots[targetSlotKey];

    // LEAST PRIORITY RULE:
    // If the slot on this day already has an entry, KEEP IT!
    if (existing && (existing.plannedTask || existing.actualTask || existing.title)) {
      continue;
    }

    const titleText = tmplSlot.title || tmplSlot.plannedTask || 'Task';
    const newSlotObject = {
      plannedTask: titleText,
      actualTask: titleText,
      title: titleText,
      category: tmplSlot.category || 'General',
      status: 'Pending',
      planned: 30,
      actual: 0,
      notes: tmplSlot.notes || ''
    };

    weekData.slots[targetSlotKey] = newSlotObject;
    appliedSlots.push(targetSlotKey);
    markSlotPendingSave(weekKey, targetSlotKey, newSlotObject);
    previousSlotsSnapshot[targetSlotKey] = existing ? JSON.parse(JSON.stringify(existing)) : null;
    newSlotsSnapshot[targetSlotKey] = JSON.parse(JSON.stringify(newSlotObject));
  }

  if (appliedSlots.length > 0) {
    recordUndoAction({
      type: 'day_template_apply',
      weekKey,
      dateStr,
      appliedSlots,
      previousSlotsSnapshot,
      newSlotsSnapshot,
      label: template.name
    });

    saveStateToStorage();
    renderGrid(DOM.scheduleTableBody, handleSwitchToDayView);
    renderAnalytics(DOM.statPlannedHours, DOM.statActualHours, DOM.statScore, DOM.categoryBarsContainer);

    let allSaved = true;
    for (const targetSlotKey of appliedSlots) {
      try {
        const ok = await ApiClient.saveSlot(weekKey, targetSlotKey, weekData.slots[targetSlotKey]);
        if (ok) {
          clearSlotPendingSave(targetSlotKey);
        } else {
          allSaved = false;
        }
      } catch (e) {
        allSaved = false;
        console.warn('Failed to sync template slot to backend:', e);
      }
    }

    if (allSaved) {
      showToast(`📋 Applied "${template.name}" (+${appliedSlots.length} slots added)`, 'success');
    } else {
      showToast(`📋 Applied "${template.name}" locally (+${appliedSlots.length} slots; server sync pending)`, 'warning');
    }
  } else {
    showToast('No empty slots to fill (all template slots already have existing tasks)', 'info');
  }

  closeApplyDayTemplateModal();
}

export function openSaveDayAsTemplateModal(dateStr) {
  if (!dateStr) return;
  const modal = document.getElementById('saveDayAsTemplateModal');
  if (!modal) return;

  const dateInput = document.getElementById('saveDayAsTemplateSourceDate');
  const dateText = document.getElementById('saveDayAsTemplateDateText');
  const nameInput = document.getElementById('saveDayAsTemplateNameInput');
  const descInput = document.getElementById('saveDayAsTemplateDescInput');
  const preview = document.getElementById('saveDayAsTemplateTasksPreview');
  const saveBtn = document.getElementById('confirmSaveDayAsTemplateBtn');

  if (dateInput) dateInput.value = dateStr;

  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
  if (dateText) dateText.textContent = `Capturing tasks from ${dayName}, ${formatDateDisplay(dateStr)}`;
  if (nameInput) nameInput.value = `${dayName} Routine`;
  if (descInput) descInput.value = `Template captured from ${formatDateDisplay(dateStr)}`;

  const weekKey = getSlotWeekKey(`${dateStr}_00:00`);
  const weekData = STATE.scheduleData[weekKey] || { slots: {} };

  // Collect tasks on this day
  const tasks = [];
  TIME_SLOTS.forEach(slotInfo => {
    const slotKey = `${dateStr}_${slotInfo.key}`;
    const s = weekData.slots[slotKey];
    if (s && (s.plannedTask || s.actualTask || s.title)) {
      tasks.push({
        time: slotInfo.key,
        title: s.actualTask || s.plannedTask || s.title,
        category: s.category || 'General',
        planned: s.planned || 30
      });
    }
  });

  if (preview) {
    if (tasks.length === 0) {
      preview.innerHTML = '<div style="color: var(--text-muted); text-align: center; padding: 1rem;">No tasks found on this day to save into a template.</div>';
      if (saveBtn) saveBtn.disabled = true;
    } else {
      preview.innerHTML = tasks.map(t => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.35rem 0.5rem; background: var(--bg-primary); border-radius: 6px; border: 1px solid var(--border-color);">
          <span><strong>${t.time}</strong> • ${escapeAppHtml(t.title)}</span>
          <span style="font-size: 0.75rem; color: var(--text-muted);">${escapeAppHtml(t.category)} (30m)</span>
        </div>
      `).join('');
      if (saveBtn) saveBtn.disabled = false;
    }
  }

  modal.classList.add('active');
  if (nameInput) nameInput.focus();
}

export function closeSaveDayAsTemplateModal() {
  const modal = document.getElementById('saveDayAsTemplateModal');
  if (modal) modal.classList.remove('active');
}

export async function saveDayAsTemplateFromModal() {
  const dateStr = document.getElementById('saveDayAsTemplateSourceDate')?.value;
  const nameInput = document.getElementById('saveDayAsTemplateNameInput');
  const descInput = document.getElementById('saveDayAsTemplateDescInput');

  const name = nameInput ? nameInput.value.trim() : '';
  if (!name) {
    alert('Please enter a template name.');
    if (nameInput) nameInput.focus();
    return;
  }

  const weekKey = getSlotWeekKey(`${dateStr}_00:00`);
  const weekData = STATE.scheduleData[weekKey] || { slots: {} };

  const slots = {};
  TIME_SLOTS.forEach(slotInfo => {
    const slotKey = `${dateStr}_${slotInfo.key}`;
    const s = weekData.slots[slotKey];
    if (s && (s.plannedTask || s.actualTask || s.title)) {
      const taskTitle = s.actualTask || s.plannedTask || s.title;
      slots[slotInfo.key] = {
        title: taskTitle,
        plannedTask: taskTitle,
        category: s.category || 'General',
        planned: 30
      };
    }
  });

  const slotCount = Object.keys(slots).length;
  if (slotCount === 0) {
    showToast('No tasks found on this day to save into a template.', 'warning');
    return;
  }

  await saveDayTemplate({
    id: `tmpl_${Date.now()}`,
    name,
    description: descInput ? descInput.value.trim() : '',
    slots
  });

  closeSaveDayAsTemplateModal();
  showToast(`💾 Saved template "${name}" with ${slotCount} slots`, 'success');
}

function escapeAppHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>'"]/g, tag => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[tag] || tag));
}

/* ==========================================================================
   MULTI-SLOT SELECTION & BULK ACTIONS CONTROLLER
   ========================================================================== */

let activeBulkSlotKeys = [];

function initBulkActionsUI() {
  const bulkMarkDoneBtn = document.getElementById('bulkMarkDoneBtn');
  const bulkMarkInProgressBtn = document.getElementById('bulkMarkInProgressBtn');
  const bulkMarkPendingBtn = document.getElementById('bulkMarkPendingBtn');
  const bulkCategoryBtn = document.getElementById('bulkCategoryBtn');
  const bulkCategoryMenu = document.getElementById('bulkCategoryMenu');
  const bulkAssignTaskBtn = document.getElementById('bulkAssignTaskBtn');
  const bulkClearTasksBtn = document.getElementById('bulkClearTasksBtn');
  const bulkDeselectBtn = document.getElementById('bulkDeselectBtn');
  const bulkActionBar = document.getElementById('bulkActionBar');

  // Modals elements
  const bulkAssignTaskModal = document.getElementById('bulkAssignTaskModal');
  const closeBulkAssignModalBtn = document.getElementById('closeBulkAssignModalBtn');
  const cancelBulkAssignBtn = document.getElementById('cancelBulkAssignBtn');
  const confirmBulkAssignBtn = document.getElementById('confirmBulkAssignBtn');
  const bulkAssignTaskInput = document.getElementById('bulkAssignTaskInput');
  const bulkAssignCategorySelect = document.getElementById('bulkAssignCategorySelect');
  const bulkAssignSlotCountText = document.getElementById('bulkAssignSlotCountText');

  const bulkClearConfirmModal = document.getElementById('bulkClearConfirmModal');
  const cancelBulkClearBtn = document.getElementById('cancelBulkClearBtn');
  const confirmBulkClearBtn = document.getElementById('confirmBulkClearBtn');
  const bulkClearSlotCountText = document.getElementById('bulkClearSlotCountText');

  if (bulkActionBar) {
    bulkActionBar.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }

  // Status updates
  if (bulkMarkDoneBtn) {
    bulkMarkDoneBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await handleBulkStatusChange('Done');
    });
  }
  if (bulkMarkInProgressBtn) {
    bulkMarkInProgressBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await handleBulkStatusChange('Partially Done');
    });
  }
  if (bulkMarkPendingBtn) {
    bulkMarkPendingBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await handleBulkStatusChange('Pending');
    });
  }

  // Category dropdown toggle
  if (bulkCategoryBtn && bulkCategoryMenu) {
    bulkCategoryBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = bulkCategoryMenu.style.display === 'flex';
      bulkCategoryMenu.style.display = isVisible ? 'none' : 'flex';
    });

    bulkCategoryMenu.querySelectorAll('.bulk-cat-item').forEach(item => {
      item.addEventListener('click', async (e) => {
        e.stopPropagation();
        const cat = item.dataset.category;
        bulkCategoryMenu.style.display = 'none';
        if (cat) {
          await handleBulkCategoryChange(cat);
        }
      });
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.bulk-category-dropdown-wrapper')) {
        bulkCategoryMenu.style.display = 'none';
      }
    });
  }

  // Assign task modal
  if (bulkAssignTaskBtn && bulkAssignTaskModal) {
    bulkAssignTaskBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      let keys = getSelectedSlotKeys();
      if (keys.length === 0 && STATE.selectedSlotKey) {
        keys = [STATE.selectedSlotKey];
      }
      if (keys.length === 0) return;
      activeBulkSlotKeys = [...keys];
      if (bulkAssignSlotCountText) bulkAssignSlotCountText.textContent = keys.length;
      if (bulkAssignTaskInput) {
        bulkAssignTaskInput.value = '';
        setTimeout(() => bulkAssignTaskInput.focus(), 80);
      }
      bulkAssignTaskModal.classList.add('active');
    });

    const closeAssignModal = (e) => {
      if (e) e.stopPropagation();
      bulkAssignTaskModal.classList.remove('active');
      activeBulkSlotKeys = [];
    };
    if (closeBulkAssignModalBtn) closeBulkAssignModalBtn.addEventListener('click', closeAssignModal);
    if (cancelBulkAssignBtn) cancelBulkAssignBtn.addEventListener('click', closeAssignModal);
    bulkAssignTaskModal.addEventListener('click', (e) => {
      if (e.target === bulkAssignTaskModal) closeAssignModal(e);
    });

    if (confirmBulkAssignBtn) {
      confirmBulkAssignBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const taskName = bulkAssignTaskInput?.value?.trim();
        if (!taskName) {
          showToast('Please enter a task name', 'warning');
          bulkAssignTaskInput?.focus();
          return;
        }
        const category = bulkAssignCategorySelect?.value || 'General';
        const keysToAssign = [...activeBulkSlotKeys];
        closeAssignModal();
        await handleConfirmBulkAssign(taskName, category, keysToAssign);
      });
    }

    if (bulkAssignTaskInput) {
      bulkAssignTaskInput.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          const taskName = bulkAssignTaskInput.value.trim();
          if (!taskName) {
            showToast('Please enter a task name', 'warning');
            return;
          }
          const category = bulkAssignCategorySelect?.value || 'General';
          const keysToAssign = [...activeBulkSlotKeys];
          closeAssignModal();
          await handleConfirmBulkAssign(taskName, category, keysToAssign);
        }
      });
    }
  }

  // Clear slots modal
  if (bulkClearTasksBtn && bulkClearConfirmModal) {
    bulkClearTasksBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      let keys = getSelectedSlotKeys();
      if (keys.length === 0 && STATE.selectedSlotKey) {
        keys = [STATE.selectedSlotKey];
      }
      if (keys.length === 0) return;
      activeBulkSlotKeys = [...keys];
      if (bulkClearSlotCountText) bulkClearSlotCountText.textContent = `${keys.length} slots`;
      bulkClearConfirmModal.classList.add('active');
    });

    const closeClearModal = (e) => {
      if (e) e.stopPropagation();
      bulkClearConfirmModal.classList.remove('active');
      activeBulkSlotKeys = [];
    };
    if (cancelBulkClearBtn) cancelBulkClearBtn.addEventListener('click', closeClearModal);
    bulkClearConfirmModal.addEventListener('click', (e) => {
      if (e.target === bulkClearConfirmModal) closeClearModal(e);
    });

    if (confirmBulkClearBtn) {
      confirmBulkClearBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const keysToClear = [...activeBulkSlotKeys];
        closeClearModal();
        await handleConfirmBulkClear(keysToClear);
      });
    }
  }

  // Deselect button
  if (bulkDeselectBtn) {
    bulkDeselectBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      clearSlotSelection();
    });
  }

  // Global Escape key for bulk modals
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (bulkAssignTaskModal?.classList.contains('active')) {
        bulkAssignTaskModal.classList.remove('active');
        activeBulkSlotKeys = [];
        e.stopPropagation();
      } else if (bulkClearConfirmModal?.classList.contains('active')) {
        bulkClearConfirmModal.classList.remove('active');
        activeBulkSlotKeys = [];
        e.stopPropagation();
      }
    }
  });
}

async function handleBulkStatusChange(newStatus) {
  const selectedKeys = getSelectedSlotKeys();
  if (!selectedKeys || selectedKeys.length === 0) return;

  const affectedSlots = [];
  const previousSlotsSnapshot = {};
  const newSlotsSnapshot = {};
  let updatedCount = 0;

  for (const slotKey of selectedKeys) {
    const weekKey = getSlotWeekKey(slotKey);
    if (!STATE.scheduleData[weekKey]) {
      STATE.scheduleData[weekKey] = { slots: {}, habits: [], todos: [], notes: '', noteSheets: [] };
    }
    const weekData = STATE.scheduleData[weekKey];
    const existing = weekData.slots[slotKey];

    const base = existing ? JSON.parse(JSON.stringify(existing)) : {
      plannedTask: 'Task',
      actualTask: 'Task',
      category: 'General',
      status: 'Pending',
      planned: 30,
      actual: 30,
      notes: ''
    };

    let newActual = base.actual !== undefined ? base.actual : 30;
    if (newStatus === 'Not Done') {
      newActual = 0;
    } else if (newStatus === 'Done') {
      newActual = base.planned || 30;
    } else if (newStatus === 'Partially Done') {
      newActual = Math.round((base.planned || 30) / 2);
    } else if (newStatus === 'Pending') {
      newActual = 0;
    }

    const updated = {
      ...base,
      status: newStatus,
      actual: newActual
    };

    affectedSlots.push({ weekKey, slotKey });
    previousSlotsSnapshot[slotKey] = existing ? JSON.parse(JSON.stringify(existing)) : null;
    newSlotsSnapshot[slotKey] = JSON.parse(JSON.stringify(updated));

    weekData.slots[slotKey] = updated;
    markSlotPendingSave(weekKey, slotKey, updated);
    updatedCount++;
  }

  recordUndoAction({
    type: 'bulk_edit',
    affectedSlots,
    previousSlotsSnapshot,
    newSlotsSnapshot,
    label: `Status -> ${newStatus}`
  });

  saveStateToStorage();
  renderGrid(DOM.scheduleTableBody, handleSwitchToDayView);
  renderAnalytics(DOM.statPlannedHours, DOM.statActualHours, DOM.statScore, DOM.categoryBarsContainer);
  updateBulkActionBar();

  // Background API sync
  Promise.allSettled(
    affectedSlots.map(async ({ weekKey, slotKey }) => {
      try {
        const ok = await ApiClient.saveSlot(weekKey, slotKey, newSlotsSnapshot[slotKey]);
        if (ok) clearSlotPendingSave(slotKey);
      } catch (e) {}
    })
  );

  const statusIcons = { 'Done': '✅', 'Partially Done': '⏳', 'Pending': '⚪' };
  showToast(`${statusIcons[newStatus] || '✨'} Updated ${updatedCount} slots to ${newStatus}`, 'success');
}

async function handleBulkCategoryChange(newCategory) {
  const selectedKeys = getSelectedSlotKeys();
  if (!selectedKeys || selectedKeys.length === 0) return;

  const affectedSlots = [];
  const previousSlotsSnapshot = {};
  const newSlotsSnapshot = {};
  let updatedCount = 0;

  for (const slotKey of selectedKeys) {
    const weekKey = getSlotWeekKey(slotKey);
    if (!STATE.scheduleData[weekKey]) {
      STATE.scheduleData[weekKey] = { slots: {}, habits: [], todos: [], notes: '', noteSheets: [] };
    }
    const weekData = STATE.scheduleData[weekKey];
    const existing = weekData.slots[slotKey];

    const base = existing ? JSON.parse(JSON.stringify(existing)) : {
      plannedTask: 'Task',
      actualTask: 'Task',
      category: newCategory,
      status: 'Pending',
      planned: 30,
      actual: 30,
      notes: ''
    };

    const updated = {
      ...base,
      category: newCategory
    };

    affectedSlots.push({ weekKey, slotKey });
    previousSlotsSnapshot[slotKey] = existing ? JSON.parse(JSON.stringify(existing)) : null;
    newSlotsSnapshot[slotKey] = JSON.parse(JSON.stringify(updated));

    weekData.slots[slotKey] = updated;
    markSlotPendingSave(weekKey, slotKey, updated);
    updatedCount++;
  }

  recordUndoAction({
    type: 'bulk_edit',
    affectedSlots,
    previousSlotsSnapshot,
    newSlotsSnapshot,
    label: `Category -> ${newCategory}`
  });

  saveStateToStorage();
  renderGrid(DOM.scheduleTableBody, handleSwitchToDayView);
  renderAnalytics(DOM.statPlannedHours, DOM.statActualHours, DOM.statScore, DOM.categoryBarsContainer);
  updateBulkActionBar();

  // Background API sync
  Promise.allSettled(
    affectedSlots.map(async ({ weekKey, slotKey }) => {
      try {
        const ok = await ApiClient.saveSlot(weekKey, slotKey, newSlotsSnapshot[slotKey]);
        if (ok) clearSlotPendingSave(slotKey);
      } catch (e) {}
    })
  );

  showToast(`🏷️ Set category to "${newCategory}" for ${updatedCount} slots`, 'success');
}

async function handleConfirmBulkAssign(taskName, category, targetKeys = null) {
  const selectedKeys = (targetKeys && targetKeys.length > 0)
    ? targetKeys
    : ((activeBulkSlotKeys && activeBulkSlotKeys.length > 0) ? activeBulkSlotKeys : getSelectedSlotKeys());
  if (!selectedKeys || selectedKeys.length === 0) return;

  const affectedSlots = [];
  const previousSlotsSnapshot = {};
  const newSlotsSnapshot = {};

  for (const slotKey of selectedKeys) {
    const weekKey = getSlotWeekKey(slotKey);
    if (!STATE.scheduleData[weekKey]) {
      STATE.scheduleData[weekKey] = { slots: {}, habits: [], todos: [], notes: '', noteSheets: [] };
    }
    const weekData = STATE.scheduleData[weekKey];
    const existing = weekData.slots[slotKey];

    const updated = {
      ...(existing || {}),
      plannedTask: taskName,
      actualTask: taskName,
      category: category,
      status: existing?.status || 'Pending',
      planned: 30,
      actual: existing?.actual !== undefined ? existing.actual : 30,
      notes: existing?.notes || ''
    };

    affectedSlots.push({ weekKey, slotKey });
    previousSlotsSnapshot[slotKey] = existing ? JSON.parse(JSON.stringify(existing)) : null;
    newSlotsSnapshot[slotKey] = JSON.parse(JSON.stringify(updated));

    weekData.slots[slotKey] = updated;
    markSlotPendingSave(weekKey, slotKey, updated);
  }

  recordUndoAction({
    type: 'bulk_edit',
    affectedSlots,
    previousSlotsSnapshot,
    newSlotsSnapshot,
    label: `Assign: ${taskName}`
  });

  saveStateToStorage();
  renderGrid(DOM.scheduleTableBody, handleSwitchToDayView);
  renderAnalytics(DOM.statPlannedHours, DOM.statActualHours, DOM.statScore, DOM.categoryBarsContainer);
  updateBulkActionBar();

  // Background API sync
  Promise.allSettled(
    affectedSlots.map(async ({ weekKey, slotKey }) => {
      try {
        const ok = await ApiClient.saveSlot(weekKey, slotKey, newSlotsSnapshot[slotKey]);
        if (ok) clearSlotPendingSave(slotKey);
      } catch (e) {}
    })
  );

  showToast(`✏️ Assigned "${taskName}" across ${selectedKeys.length} slots`, 'success');
}

async function handleConfirmBulkClear(targetKeys = null) {
  const selectedKeys = (targetKeys && targetKeys.length > 0)
    ? targetKeys
    : ((activeBulkSlotKeys && activeBulkSlotKeys.length > 0) ? activeBulkSlotKeys : getSelectedSlotKeys());
  if (!selectedKeys || selectedKeys.length === 0) return;

  const affectedSlots = [];
  const previousSlotsSnapshot = {};
  const newSlotsSnapshot = {};

  for (const slotKey of selectedKeys) {
    const weekKey = getSlotWeekKey(slotKey);
    if (!STATE.scheduleData[weekKey]) {
      STATE.scheduleData[weekKey] = { slots: {}, habits: [], todos: [], notes: '', noteSheets: [] };
    }
    const weekData = STATE.scheduleData[weekKey];
    const existing = weekData.slots[slotKey];

    if (existing) {
      affectedSlots.push({ weekKey, slotKey });
      previousSlotsSnapshot[slotKey] = JSON.parse(JSON.stringify(existing));
      newSlotsSnapshot[slotKey] = null;
      delete weekData.slots[slotKey];
      clearSlotPendingSave(slotKey);
    }
  }

  if (affectedSlots.length === 0) {
    showToast('Selected slots are already empty', 'info');
    clearSlotSelection();
    return;
  }

  recordUndoAction({
    type: 'bulk_edit',
    affectedSlots,
    previousSlotsSnapshot,
    newSlotsSnapshot,
    label: 'Clear Slots'
  });

  saveStateToStorage();
  renderGrid(DOM.scheduleTableBody, handleSwitchToDayView);
  renderAnalytics(DOM.statPlannedHours, DOM.statActualHours, DOM.statScore, DOM.categoryBarsContainer);
  clearSlotSelection();

  // Background API delete sync
  Promise.allSettled(
    affectedSlots.map(async ({ weekKey, slotKey }) => {
      try {
        await ApiClient.deleteSlot(weekKey, slotKey);
      } catch (e) {}
    })
  );

  showToast(`🗑️ Cleared ${affectedSlots.length} slots (Press Ctrl+Z to undo)`, 'info');
}


