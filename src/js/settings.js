/**
 * DayFlow User Settings Controller
 * Supports:
 * 1. 24-Hour Default & Custom Timeline Windowing (Start Hour, End Hour, Quick Presets)
 * 2. 12-Hour vs 24-Hour Military Time Format
 * 3. Theme Switching (Deep Midnight, OLED Black, Emerald Forest, Clean Light)
 * 4. Accent Color Customization (Indigo, Emerald, Cyan, Purple, Rose)
 * 5. Gamification Targets (Daily Points Goal, Todo Completion Rewards)
 * 6. 1-Click JSON Data Export & Backup
 */
import { generateTimeSlots } from './grid.js?v=2.9.29';
import { STATE, getUserStorageKey, saveStateToStorage, setActiveDateFormat, getActiveCategories, getAllCategories, getCategoryColor, getCategoryIcon, isCategoryProductive, cascadeCategoryRenameLocally, saveCategoriesToStorage, syncCategoriesWithApi, markCategoryPendingSave, clearCategoryPendingSave } from './state.js?v=2.9.29';
import { playNotificationSound, requestNotificationPermission, getNotificationPermissionStatus, updateNotificationBellUI } from './notifications.js?v=2.9.29';
import { ApiClient, isDemoMode } from './apiClient.js?v=2.9.29';
import { showToast, escapeHtml, generateUUID } from './utils.js?v=2.9.29';

export const DEFAULT_DAY_TEMPLATES = [
  {
    id: 'tmpl_workday',
    name: 'Productive Workday',
    description: 'Standard deep focus schedule with morning standup, deep work, and afternoon development',
    slots: {
      '09:00': { title: 'Morning Standup & Priorities', plannedTask: 'Morning Standup & Priorities', category: 'Work', planned: 30 },
      '09:30': { title: 'Deep Work: Core Priorities', plannedTask: 'Deep Work: Core Priorities', category: 'Work', planned: 30 },
      '10:00': { title: 'Deep Work: Core Priorities', plannedTask: 'Deep Work: Core Priorities', category: 'Work', planned: 30 },
      '10:30': { title: 'Deep Work: Core Priorities', plannedTask: 'Deep Work: Core Priorities', category: 'Work', planned: 30 },
      '11:00': { title: 'Deep Work: Core Priorities', plannedTask: 'Deep Work: Core Priorities', category: 'Work', planned: 30 },
      '11:30': { title: 'Team Sync & Code Reviews', plannedTask: 'Team Sync & Code Reviews', category: 'Work', planned: 30 },
      '12:00': { title: 'Lunch & Recharge Walk', plannedTask: 'Lunch & Recharge Walk', category: 'Health', planned: 30 },
      '12:30': { title: 'Lunch & Recharge Walk', plannedTask: 'Lunch & Recharge Walk', category: 'Health', planned: 30 },
      '13:00': { title: 'Email & Admin Catch-up', plannedTask: 'Email & Admin Catch-up', category: 'Work', planned: 30 },
      '13:30': { title: 'Task Breakdown & Planning', plannedTask: 'Task Breakdown & Planning', category: 'Work', planned: 30 },
      '14:00': { title: 'Architecture & Feature Development', plannedTask: 'Architecture & Feature Development', category: 'Work', planned: 30 },
      '14:30': { title: 'Architecture & Feature Development', plannedTask: 'Architecture & Feature Development', category: 'Work', planned: 30 },
      '15:00': { title: 'Architecture & Feature Development', plannedTask: 'Architecture & Feature Development', category: 'Work', planned: 30 },
      '15:30': { title: 'Architecture & Feature Development', plannedTask: 'Architecture & Feature Development', category: 'Work', planned: 30 },
      '16:00': { title: 'Architecture & System Review', plannedTask: 'Architecture & System Review', category: 'Work', planned: 30 },
      '16:30': { title: 'Daily Wrap-up & Tomorrow Prep', plannedTask: 'Daily Wrap-up & Tomorrow Prep', category: 'Work', planned: 30 }
    }
  },
  {
    id: 'tmpl_weekend',
    name: 'Weekend Reset & Leisure',
    description: 'Relaxed weekend schedule balancing health, personal learning, and family time',
    slots: {
      '09:00': { title: 'Morning Workout', plannedTask: 'Morning Workout', category: 'Health', planned: 30 },
      '09:30': { title: 'Healthy Breakfast', plannedTask: 'Healthy Breakfast', category: 'Health', planned: 30 },
      '10:30': { title: 'Personal Learning & Tech Reading', plannedTask: 'Personal Learning & Tech Reading', category: 'Learning', planned: 30 },
      '11:00': { title: 'Personal Learning & Tech Reading', plannedTask: 'Personal Learning & Tech Reading', category: 'Learning', planned: 30 },
      '13:00': { title: 'Household Organization', plannedTask: 'Household Organization', category: 'Household', planned: 30 },
      '13:30': { title: 'Household Errands', plannedTask: 'Household Errands', category: 'Household', planned: 30 },
      '16:00': { title: 'Family Time & Recreation', plannedTask: 'Family Time & Recreation', category: 'Family', planned: 30 },
      '16:30': { title: 'Family Time & Recreation', plannedTask: 'Family Time & Recreation', category: 'Family', planned: 30 }
    }
  }
];

export const DEFAULT_SETTINGS = {
  timelineStartHour: 0,
  timelineEndHour: 23,
  timeFormat: '12h',
  dateFormat: 'DD/MM/YYYY',
  defaultLandingView: 'grid',
  themeMode: 'dark', // 'dark', 'oled', 'emerald', 'light'
  accentColor: 'indigo', // 'indigo', 'emerald', 'cyan', 'purple', 'rose'
  compactGrid: false,
  dailyPointsTarget: 50,
  todoRewardPoints: 15,
  notificationsEnabled: false,
  notificationSound: true,
  notificationVolume: 70,
  notificationTone: 'chime', // 'chime', 'bell', 'ping', 'marimba'
  notifyLeadMinutes: 2, // 0, 1, 2, 5
  notifySlotEnd: true,
  notifyActiveWindowEnabled: true,
  notifyStartHour: 8,
  notifyEndHour: 22,
  notifyQuietHoursMode: 'full', // 'full' (complete silence) | 'sound_only' (silent toasts)
  notifyMuteWeekends: false,
  notifyOnlyProductive: false,
  dayTemplates: DEFAULT_DAY_TEMPLATES,
  productiveCategories: ['Work', 'Learning']
};

export const AVAILABLE_CATEGORIES = [
  { id: 'Work', name: 'Work / Job Tasks', icon: '💼' },
  { id: 'Learning', name: 'Learning (Tech/Skills)', icon: '📚' },
  { id: 'Health', name: 'Health & Meals', icon: '🏃' },
  { id: 'Household', name: 'Household & Chores', icon: '🧹' },
  { id: 'Family', name: 'Family & Personal', icon: '👨‍👩‍👧' },
  { id: 'Travel', name: 'Travel & Commute', icon: '✈️' },
  { id: 'General', name: 'General', icon: '📌' }
];

export function isSlotProductive(slot, userSettings = USER_SETTINGS) {
  if (!slot) return false;
  if (typeof slot.isProductive === 'boolean') {
    return slot.isProductive;
  }
  const cat = slot.category || 'General';
  if (STATE && STATE.categories && Array.isArray(STATE.categories) && STATE.categories.length > 0) {
    const found = STATE.categories.find(c => c.name.toLowerCase() === cat.toLowerCase());
    if (found && typeof found.isProductive === 'boolean') {
      return found.isProductive;
    }
  }
  const prodCats = userSettings?.productiveCategories || ['Work', 'Learning'];
  return prodCats.includes(cat);
}

export let USER_SETTINGS = { ...DEFAULT_SETTINGS };
let onSettingsChangedCallback = null;

export function resetUserSettingsToDefault() {
  USER_SETTINGS = { ...DEFAULT_SETTINGS };
}

export function getSettingsStorageKey() {
  const userKey = getUserStorageKey();
  return `settings_${userKey}`;
}

export function getDateFormat() {
  return USER_SETTINGS.dateFormat || 'DD/MM/YYYY';
}

export function loadUserSettings() {
  try {
    const key = getSettingsStorageKey();
    const stored = localStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored);
      USER_SETTINGS = {
        ...DEFAULT_SETTINGS,
        ...parsed,
        dayTemplates: Array.isArray(parsed.dayTemplates) ? parsed.dayTemplates : JSON.parse(JSON.stringify(DEFAULT_DAY_TEMPLATES)),
        productiveCategories: Array.isArray(parsed.productiveCategories) ? parsed.productiveCategories : ['Work', 'Learning']
      };
    } else {
      USER_SETTINGS = { ...DEFAULT_SETTINGS, dayTemplates: JSON.parse(JSON.stringify(DEFAULT_DAY_TEMPLATES)) };
    }
  } catch (e) {
    console.error('Failed to load user settings:', e);
    USER_SETTINGS = { ...DEFAULT_SETTINGS, dayTemplates: JSON.parse(JSON.stringify(DEFAULT_DAY_TEMPLATES)) };
  }
  setActiveDateFormat(USER_SETTINGS.dateFormat || 'DD/MM/YYYY');
  return USER_SETTINGS;
}

export function saveUserSettings(newSettings) {
  try {
    USER_SETTINGS = { ...USER_SETTINGS, ...newSettings };
    setActiveDateFormat(USER_SETTINGS.dateFormat || 'DD/MM/YYYY');
    const key = getSettingsStorageKey();
    localStorage.setItem(key, JSON.stringify(USER_SETTINGS));
  } catch (e) {
    console.error('Failed to save user settings:', e);
  }
}

export function applyTheme(themeMode) {
  document.body.classList.remove('theme-oled', 'theme-emerald', 'theme-light');
  if (themeMode === 'oled') {
    document.body.classList.add('theme-oled');
  } else if (themeMode === 'emerald') {
    document.body.classList.add('theme-emerald');
  } else if (themeMode === 'light') {
    document.body.classList.add('theme-light');
  }
}

export function applyAccent(accentColor) {
  const root = document.documentElement;
  const accents = {
    indigo: { primary: '#6366f1', hover: '#4f46e5', light: 'rgba(99, 102, 241, 0.2)' },
    emerald: { primary: '#10b981', hover: '#059669', light: 'rgba(16, 185, 129, 0.2)' },
    cyan: { primary: '#06b6d4', hover: '#0891b2', light: 'rgba(6, 182, 212, 0.2)' },
    purple: { primary: '#a855f7', hover: '#9333ea', light: 'rgba(168, 85, 247, 0.2)' },
    rose: { primary: '#f43f5e', hover: '#e11d48', light: 'rgba(244, 63, 94, 0.2)' }
  };

  const choice = accents[accentColor] || accents.indigo;
  root.style.setProperty('--accent-primary', choice.primary);
  root.style.setProperty('--accent-hover', choice.hover);
  root.style.setProperty('--accent-light', choice.light);
}

export function applySettings(settings, renderAll) {
  // 1. Sync Active Date Format
  setActiveDateFormat(settings.dateFormat || 'DD/MM/YYYY');

  // 2. Rebuild Timeline Slots
  generateTimeSlots(settings.timelineStartHour, settings.timelineEndHour, settings.timeFormat);

  // 3. Apply Theme & Accent
  applyTheme(settings.themeMode);
  applyAccent(settings.accentColor);

  // 4. Compact Grid Class
  const appEl = document.getElementById('app');
  if (appEl) {
    if (settings.compactGrid) {
      appEl.classList.add('compact-grid');
    } else {
      appEl.classList.remove('compact-grid');
    }
  }

  if (renderAll) renderAll();
}

export function exportUserDataJSON() {
  const userJson = localStorage.getItem('dayflow_user');
  let userName = 'DayFlow_User';
  try {
    if (userJson) {
      const u = JSON.parse(userJson);
      const rawName = u.displayName || u.name || (u.email ? u.email.split('@')[0] : 'User');
      if (rawName) userName = rawName.replace(/[^a-zA-Z0-9]/g, '_');
    }
  } catch (e) {}

  const exportData = {
    exportDate: new Date().toISOString(),
    version: '2.4.10',
    user: userJson ? JSON.parse(userJson) : null,
    settings: USER_SETTINGS,
    scheduleData: STATE.scheduleData || {}
  };

  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportData, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', dataStr);
  const dateStamp = new Date().toISOString().split('T')[0];
  downloadAnchor.setAttribute('download', `DayFlow_Backup_${userName}_${dateStamp}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

export function initSettingsUI(domElements, renderAllCallback) {
  onSettingsChangedCallback = renderAllCallback;
  loadUserSettings();
  applySettings(USER_SETTINGS, null);

  const startHourInput = document.getElementById('settingsStartHour');
  const endHourInput = document.getElementById('settingsEndHour');
  const startHourLabel = document.getElementById('settingsStartHourLabel');
  const endHourLabel = document.getElementById('settingsEndHourLabel');
  const timeFormatSelect = document.getElementById('settingsTimeFormat');
  const dateFormatSelect = document.getElementById('settingsDateFormat');
  const defaultViewSelect = document.getElementById('settingsDefaultView');
  const compactGridToggle = document.getElementById('settingsCompactGrid');

  const dailyPointsInput = document.getElementById('settingsDailyPoints');
  const todoRewardInput = document.getElementById('settingsTodoReward');

  // Notification controls
  const notifPermissionBadge = document.getElementById('settingsNotifPermissionBadge');
  const requestNotifPermissionBtn = document.getElementById('requestNotifPermissionBtn');
  const notifEnabledToggle = document.getElementById('settingsNotifEnabled');
  const notifSoundToggle = document.getElementById('settingsNotifSound');
  const notifVolumeSlider = document.getElementById('settingsNotifVolume');
  const notifVolumeLabel = document.getElementById('settingsNotifVolumeLabel');
  const notifToneSelect = document.getElementById('settingsNotifTone');
  const testSoundBtn = document.getElementById('testNotificationSoundBtn');
  const notifLeadTimeSelect = document.getElementById('settingsNotifLeadTime');
  const notifSlotEndToggle = document.getElementById('settingsNotifSlotEnd');

  // Notification Active Window & Quiet Hours Controls
  const notifActiveWindowToggle = document.getElementById('settingsNotifActiveWindowEnabled');
  const notifActiveWindowContainer = document.getElementById('notifActiveWindowContainer');
  const notifStartHourSelect = document.getElementById('settingsNotifStartHour');
  const notifEndHourSelect = document.getElementById('settingsNotifEndHour');
  const notifQuietHoursSummaryBadge = document.getElementById('notifQuietHoursSummaryBadge');
  const notifQuietHoursSummaryText = document.getElementById('notifQuietHoursSummaryText');
  const notifQuietModeSelect = document.getElementById('settingsNotifQuietMode');
  const notifMuteWeekendsToggle = document.getElementById('settingsNotifMuteWeekends');
  const notifOnlyProductiveToggle = document.getElementById('settingsNotifOnlyProductive');
  const notifPresetButtons = document.querySelectorAll('.notif-preset-pill');

  const exportBtn = document.getElementById('exportBackupBtn');
  const resetBtn = document.getElementById('resetSettingsBtn');
  const saveBtn = document.getElementById('saveSettingsBtn');
  const settingsStatus = document.getElementById('settingsSavedStatus');

  const windowPresets = document.querySelectorAll('.window-preset-pill');
  const themeCards = document.querySelectorAll('.theme-card');
  const accentPills = document.querySelectorAll('.accent-pill');

  const formatHourDisplay = (h) => {
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h12 = hour % 12 === 0 ? 12 : hour % 12;
    return `${String(h12).padStart(2, '0')}:00 ${ampm} (${String(hour).padStart(2, '0')}:00)`;
  };

  const updatePermissionBadgeUI = () => {
    const status = getNotificationPermissionStatus();
    if (!notifPermissionBadge) return;
    if (status === 'granted') {
      notifPermissionBadge.textContent = '✅ Granted';
      notifPermissionBadge.className = 'status-pill status-pill-success';
      if (requestNotifPermissionBtn) requestNotifPermissionBtn.style.display = 'none';
    } else if (status === 'denied') {
      notifPermissionBadge.textContent = '❌ Blocked in Browser';
      notifPermissionBadge.className = 'status-pill status-pill-danger';
      if (requestNotifPermissionBtn) requestNotifPermissionBtn.style.display = 'none';
    } else {
      notifPermissionBadge.textContent = '⚠️ Not Enabled';
      notifPermissionBadge.className = 'status-pill status-pill-warning';
      if (requestNotifPermissionBtn) requestNotifPermissionBtn.style.display = 'inline-flex';
    }
  };

  const updateActiveHoursSummaryUI = () => {
    const isEnabled = notifActiveWindowToggle ? notifActiveWindowToggle.checked : true;
    const start = notifStartHourSelect ? parseInt(notifStartHourSelect.value, 10) : (USER_SETTINGS.notifyStartHour ?? 8);
    const end = notifEndHourSelect ? parseInt(notifEndHourSelect.value, 10) : (USER_SETTINGS.notifyEndHour ?? 22);

    if (notifActiveWindowContainer) {
      notifActiveWindowContainer.style.opacity = isEnabled ? '1' : '0.55';
      notifActiveWindowContainer.style.pointerEvents = isEnabled ? 'auto' : 'none';
    }

    if (notifQuietHoursSummaryText) {
      if (!isEnabled) {
        notifQuietHoursSummaryText.textContent = '⏰ Notifications active 24/7 (Quiet hours disabled)';
      } else if (start === 0 && end >= 23) {
        notifQuietHoursSummaryText.textContent = '⏰ Notifications active 24/7 (All day and night)';
      } else {
        const formatTime = (h) => {
          const hour = parseInt(h, 10) % 24;
          const ampm = hour >= 12 ? 'PM' : 'AM';
          const h12 = hour % 12 === 0 ? 12 : hour % 12;
          return `${String(h12).padStart(2, '0')}:00 ${ampm}`;
        };
        const startStr = formatTime(start);
        const endStr = formatTime(end);
        notifQuietHoursSummaryText.textContent = `Quiet Hours: ${endStr} – ${startStr} (Muted while you sleep)`;
      }
    }

    // Update active preset button highlight
    notifPresetButtons.forEach(btn => {
      const pStart = parseInt(btn.dataset.start, 10);
      const pEnd = parseInt(btn.dataset.end, 10);
      const isActive = isEnabled && pStart === start && pEnd === end;
      btn.classList.toggle('active', isActive);
    });
  };

  // Populate UI values from loaded settings
  const syncInputsToState = () => {
    if (startHourInput) {
      startHourInput.value = USER_SETTINGS.timelineStartHour;
      if (startHourLabel) startHourLabel.textContent = formatHourDisplay(USER_SETTINGS.timelineStartHour);
    }
    if (endHourInput) {
      endHourInput.value = USER_SETTINGS.timelineEndHour;
      if (endHourLabel) endHourLabel.textContent = formatHourDisplay(USER_SETTINGS.timelineEndHour);
    }
    if (timeFormatSelect) timeFormatSelect.value = USER_SETTINGS.timeFormat || '12h';
    if (dateFormatSelect) dateFormatSelect.value = USER_SETTINGS.dateFormat || 'DD/MM/YYYY';
    if (defaultViewSelect) defaultViewSelect.value = USER_SETTINGS.defaultLandingView || 'grid';
    if (compactGridToggle) compactGridToggle.checked = !!USER_SETTINGS.compactGrid;

    if (dailyPointsInput) dailyPointsInput.value = USER_SETTINGS.dailyPointsTarget || 50;
    if (todoRewardInput) todoRewardInput.value = USER_SETTINGS.todoRewardPoints || 15;

    // Notification settings sync
    if (notifEnabledToggle) notifEnabledToggle.checked = !!USER_SETTINGS.notificationsEnabled;
    if (notifSoundToggle) notifSoundToggle.checked = USER_SETTINGS.notificationSound !== false;
    if (notifVolumeSlider) {
      notifVolumeSlider.value = USER_SETTINGS.notificationVolume !== undefined ? USER_SETTINGS.notificationVolume : 70;
      if (notifVolumeLabel) notifVolumeLabel.textContent = `${notifVolumeSlider.value}%`;
    }
    if (notifToneSelect) notifToneSelect.value = USER_SETTINGS.notificationTone || 'chime';
    if (notifLeadTimeSelect) notifLeadTimeSelect.value = USER_SETTINGS.notifyLeadMinutes !== undefined ? String(USER_SETTINGS.notifyLeadMinutes) : '2';
    if (notifSlotEndToggle) notifSlotEndToggle.checked = USER_SETTINGS.notifySlotEnd !== false;

    // Notification schedule & quiet hours sync
    if (notifActiveWindowToggle) notifActiveWindowToggle.checked = USER_SETTINGS.notifyActiveWindowEnabled !== false;
    if (notifStartHourSelect) notifStartHourSelect.value = String(USER_SETTINGS.notifyStartHour !== undefined ? USER_SETTINGS.notifyStartHour : 8);
    if (notifEndHourSelect) notifEndHourSelect.value = String(USER_SETTINGS.notifyEndHour !== undefined ? USER_SETTINGS.notifyEndHour : 22);
    if (notifQuietModeSelect) notifQuietModeSelect.value = USER_SETTINGS.notifyQuietHoursMode || 'full';
    if (notifMuteWeekendsToggle) notifMuteWeekendsToggle.checked = !!USER_SETTINGS.notifyMuteWeekends;
    if (notifOnlyProductiveToggle) notifOnlyProductiveToggle.checked = !!USER_SETTINGS.notifyOnlyProductive;

    updatePermissionBadgeUI();
    updateActiveHoursSummaryUI();

    // Theme cards active state
    themeCards.forEach(card => {
      card.classList.toggle('active', card.dataset.theme === USER_SETTINGS.themeMode);
    });

    // Accent pills active state
    accentPills.forEach(pill => {
      pill.classList.toggle('active', pill.dataset.accent === USER_SETTINGS.accentColor);
    });

    renderCategoriesManagementUI(onSettingsChangedCallback);
  };

  syncInputsToState();

  // Slider change listeners
  if (startHourInput) {
    startHourInput.addEventListener('input', () => {
      let start = parseInt(startHourInput.value, 10);
      let end = parseInt(endHourInput.value, 10);
      if (start >= end) {
        start = Math.max(0, end - 1);
        startHourInput.value = start;
      }
      if (startHourLabel) startHourLabel.textContent = formatHourDisplay(start);
      windowPresets.forEach(p => p.classList.remove('active'));
    });
  }

  if (endHourInput) {
    endHourInput.addEventListener('input', () => {
      let start = parseInt(startHourInput.value, 10);
      let end = parseInt(endHourInput.value, 10);
      if (end <= start) {
        end = Math.min(23, start + 1);
        endHourInput.value = end;
      }
      if (endHourLabel) endHourLabel.textContent = formatHourDisplay(end);
      windowPresets.forEach(p => p.classList.remove('active'));
    });
  }

  // Notification UI listeners
  if (requestNotifPermissionBtn) {
    requestNotifPermissionBtn.addEventListener('click', async () => {
      await requestNotificationPermission();
      updatePermissionBadgeUI();
      if (notifEnabledToggle) {
        notifEnabledToggle.checked = USER_SETTINGS.notificationsEnabled;
      }
    });
  }

  if (notifVolumeSlider) {
    notifVolumeSlider.addEventListener('input', () => {
      if (notifVolumeLabel) notifVolumeLabel.textContent = `${notifVolumeSlider.value}%`;
    });
  }

  if (testSoundBtn) {
    testSoundBtn.addEventListener('click', () => {
      const tone = notifToneSelect ? notifToneSelect.value : 'chime';
      const vol = notifVolumeSlider ? parseInt(notifVolumeSlider.value, 10) : 70;
      playNotificationSound(tone, vol);
    });
  }

  // Active hours & quiet hours listeners
  if (notifActiveWindowToggle) {
    notifActiveWindowToggle.addEventListener('change', updateActiveHoursSummaryUI);
  }
  if (notifStartHourSelect) {
    notifStartHourSelect.addEventListener('change', updateActiveHoursSummaryUI);
  }
  if (notifEndHourSelect) {
    notifEndHourSelect.addEventListener('change', updateActiveHoursSummaryUI);
  }
  notifPresetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const pStart = parseInt(btn.dataset.start, 10);
      const pEnd = parseInt(btn.dataset.end, 10);
      if (notifActiveWindowToggle && !notifActiveWindowToggle.checked) {
        notifActiveWindowToggle.checked = true;
      }
      if (notifStartHourSelect) notifStartHourSelect.value = String(pStart);
      if (notifEndHourSelect) notifEndHourSelect.value = String(pEnd);
      updateActiveHoursSummaryUI();
    });
  });

  // Window preset buttons
  windowPresets.forEach(pill => {
    pill.addEventListener('click', () => {
      windowPresets.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');

      const start = parseInt(pill.dataset.start, 10);
      const end = parseInt(pill.dataset.end, 10);
      if (startHourInput) startHourInput.value = start;
      if (endHourInput) endHourInput.value = end;
      if (startHourLabel) startHourLabel.textContent = formatHourDisplay(start);
      if (endHourLabel) endHourLabel.textContent = formatHourDisplay(end);
    });
  });

  // Theme cards selection
  themeCards.forEach(card => {
    card.addEventListener('click', () => {
      themeCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      const chosenTheme = card.dataset.theme || 'dark';
      applyTheme(chosenTheme);
    });
  });

  // Accent pills selection
  accentPills.forEach(pill => {
    pill.addEventListener('click', () => {
      accentPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      const chosenAccent = pill.dataset.accent || 'indigo';
      applyAccent(chosenAccent);
    });
  });

  // Export Data JSON Button
  if (exportBtn) {
    exportBtn.addEventListener('click', exportUserDataJSON);
  }

  // Save Settings Button
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const activeThemeCard = document.querySelector('.theme-card.active');
      const activeAccentPill = document.querySelector('.accent-pill.active');

      const updated = {
        timelineStartHour: parseInt(startHourInput?.value, 10) || 0,
        timelineEndHour: parseInt(endHourInput?.value, 10) || 23,
        timeFormat: timeFormatSelect?.value || '12h',
        dateFormat: dateFormatSelect?.value || 'DD/MM/YYYY',
        defaultLandingView: defaultViewSelect?.value || 'grid',
        compactGrid: !!compactGridToggle?.checked,
        dailyPointsTarget: parseInt(dailyPointsInput?.value, 10) || 50,
        todoRewardPoints: parseInt(todoRewardInput?.value, 10) || 15,
        themeMode: activeThemeCard?.dataset.theme || 'dark',
        accentColor: activeAccentPill?.dataset.accent || 'indigo',
        notificationsEnabled: !!notifEnabledToggle?.checked,
        notificationSound: !!notifSoundToggle?.checked,
        notificationVolume: parseInt(notifVolumeSlider?.value, 10) || 70,
        notificationTone: notifToneSelect?.value || 'chime',
        notifyLeadMinutes: parseInt(notifLeadTimeSelect?.value, 10) || 0,
        notifySlotEnd: !!notifSlotEndToggle?.checked,
        notifyActiveWindowEnabled: notifActiveWindowToggle ? !!notifActiveWindowToggle.checked : true,
        notifyStartHour: notifStartHourSelect ? parseInt(notifStartHourSelect.value, 10) : 8,
        notifyEndHour: notifEndHourSelect ? parseInt(notifEndHourSelect.value, 10) : 22,
        notifyQuietHoursMode: notifQuietModeSelect?.value || 'full',
        notifyMuteWeekends: !!notifMuteWeekendsToggle?.checked,
        notifyOnlyProductive: !!notifOnlyProductiveToggle?.checked,
        productiveCategories: USER_SETTINGS.productiveCategories || ['Work', 'Learning']
      };

      saveUserSettings(updated);
      updateNotificationBellUI();
      applySettings(USER_SETTINGS, onSettingsChangedCallback);

      if (settingsStatus) {
        settingsStatus.textContent = '✅ Preferences saved successfully!';
        settingsStatus.style.opacity = '1';
        setTimeout(() => {
          settingsStatus.style.opacity = '0';
        }, 2500);
      }
    });
  }

  // Reset to Defaults Button
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (confirm('Reset all settings to DayFlow defaults (Full 24 Hours, Deep Midnight theme)?')) {
        USER_SETTINGS = { ...DEFAULT_SETTINGS };
        saveUserSettings(USER_SETTINGS);
        syncInputsToState();
        renderCategoriesManagementUI(onSettingsChangedCallback);
        updateNotificationBellUI();
        applySettings(USER_SETTINGS, onSettingsChangedCallback);

        if (settingsStatus) {
          settingsStatus.textContent = '🔄 Reset to defaults';
          settingsStatus.style.opacity = '1';
          setTimeout(() => {
            settingsStatus.style.opacity = '0';
          }, 2500);
        }
      }
    });
  }

  // Initialize Account & Security Card
  initAccountSecurityUI();

  // Initialize Custom Categories Management
  initCategoryManagement(onSettingsChangedCallback);

  // Initialize Day Templates Modals and List
  initDayTemplateModals();

  // Sync Day Templates with PostgreSQL Database
  syncDayTemplatesFromApi();
}

export function initAccountSecurityUI() {
  const form = document.getElementById('settingsChangePasswordForm');
  if (!form) return;

  const currentGroup = document.getElementById('settingsCurrentPasswordGroup');
  const currentInput = document.getElementById('settingsCurrentPassword');
  const newInput = document.getElementById('settingsNewPassword');
  const confirmInput = document.getElementById('settingsConfirmPassword');
  const statusMsg = document.getElementById('settingsPasswordStatusMsg');
  const saveBtn = document.getElementById('settingsSavePasswordBtn');

  // Check if user has password set (OAuth-only users might not have a password initially)
  try {
    const rawUser = localStorage.getItem('dayflow_user');
    if (rawUser) {
      const u = JSON.parse(rawUser);
      if (u.hasPassword === false && currentGroup) {
        currentGroup.style.display = 'none';
        if (currentInput) currentInput.required = false;
        if (saveBtn) saveBtn.innerHTML = '<span>🔒</span> Set Account Password';
      }
    }
  } catch (e) {}

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (statusMsg) {
      statusMsg.style.display = 'none';
      statusMsg.className = 'auth-error-msg';
    }

    const newPwd = newInput ? newInput.value : '';
    const confirmPwd = confirmInput ? confirmInput.value : '';
    const currentPwd = currentInput ? currentInput.value : '';

    if (newPwd.length < 6) {
      showStatus('Password must be at least 6 characters.', 'error');
      return;
    }

    if (newPwd !== confirmPwd) {
      showStatus('New passwords do not match.', 'error');
      return;
    }

    if (saveBtn) saveBtn.disabled = true;

    try {
      const res = await ApiClient.changePassword(currentPwd, newPwd);
      if (res.token) {
        localStorage.setItem('dayflow_token', res.token);
      }
      showStatus(res.message || 'Password updated successfully!', 'success');
      form.reset();

      // Update local storage user flag hasPassword to true
      try {
        const rawUser = localStorage.getItem('dayflow_user');
        if (rawUser) {
          const u = JSON.parse(rawUser);
          u.hasPassword = true;
          localStorage.setItem('dayflow_user', JSON.stringify(u));
          if (currentGroup) currentGroup.style.display = 'block';
          if (saveBtn) saveBtn.innerHTML = '<span>🔒</span> Update Password';
        }
      } catch (e) {}
    } catch (err) {
      showStatus(err.message || 'Failed to update password.', 'error');
    } finally {
      if (saveBtn) saveBtn.disabled = false;
    }
  });

  function showStatus(text, type) {
    if (!statusMsg) return;
    statusMsg.textContent = text;
    statusMsg.style.display = 'block';
    if (type === 'success') {
      statusMsg.style.backgroundColor = 'rgba(16, 185, 129, 0.15)';
      statusMsg.style.color = '#10b981';
      statusMsg.style.borderColor = 'rgba(16, 185, 129, 0.3)';
    } else {
      statusMsg.style.backgroundColor = 'rgba(239, 68, 68, 0.15)';
      statusMsg.style.color = '#ef4444';
      statusMsg.style.borderColor = 'rgba(239, 68, 68, 0.3)';
    }
  }
}

/* ==========================================================================
   DAY TEMPLATES CRUD & SETTINGS UI CONTROLLERS
   ========================================================================== */

export function getDayTemplates() {
  if (!Array.isArray(USER_SETTINGS.dayTemplates) || USER_SETTINGS.dayTemplates.length === 0) {
    USER_SETTINGS.dayTemplates = JSON.parse(JSON.stringify(DEFAULT_DAY_TEMPLATES));
  }

  // Ensure every slot across all templates strictly has planned: 30 (30-min schedule cell)
  let modified = false;
  USER_SETTINGS.dayTemplates.forEach(t => {
    // If it is an old default template that had 90m slots, upgrade to the proper 30m slots
    if (t.id === 'tmpl_workday' && t.slots && t.slots['09:30'] && t.slots['09:30'].planned > 30) {
      const def = DEFAULT_DAY_TEMPLATES.find(d => d.id === 'tmpl_workday');
      if (def) {
        t.slots = JSON.parse(JSON.stringify(def.slots));
        t.description = def.description;
        modified = true;
      }
    } else if (t.id === 'tmpl_weekend' && t.slots && t.slots['09:00'] && t.slots['09:00'].planned > 30) {
      const def = DEFAULT_DAY_TEMPLATES.find(d => d.id === 'tmpl_weekend');
      if (def) {
        t.slots = JSON.parse(JSON.stringify(def.slots));
        t.description = def.description;
        modified = true;
      }
    } else if (t.slots) {
      Object.keys(t.slots).forEach(k => {
        if (t.slots[k].planned !== 30) {
          t.slots[k].planned = 30;
          modified = true;
        }
      });
    }
  });

  if (modified) {
    saveUserSettings({ dayTemplates: USER_SETTINGS.dayTemplates });
  }

  return USER_SETTINGS.dayTemplates;
}

export function getDayTemplateById(id) {
  const templates = getDayTemplates();
  return templates.find(t => t.id === id) || null;
}

export function getPendingTemplatesStorageKey() {
  const userKey = getUserStorageKey();
  return `dayflow_pending_templates_${userKey}`;
}

export function loadPendingTemplates() {
  try {
    const raw = localStorage.getItem(getPendingTemplatesStorageKey());
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        saves: (parsed && typeof parsed.saves === 'object' && parsed.saves) ? parsed.saves : {},
        deletes: (parsed && typeof parsed.deletes === 'object' && parsed.deletes) ? parsed.deletes : {}
      };
    }
  } catch (e) {}
  return { saves: {}, deletes: {} };
}

export function savePendingTemplatesToStorage(pending) {
  try {
    const key = getPendingTemplatesStorageKey();
    const hasSaves = pending && pending.saves && Object.keys(pending.saves).length > 0;
    const hasDeletes = pending && pending.deletes && Object.keys(pending.deletes).length > 0;
    if (hasSaves || hasDeletes) {
      localStorage.setItem(key, JSON.stringify(pending));
    } else {
      localStorage.removeItem(key);
    }
  } catch (e) {}
}

export function markTemplatePendingSave(template) {
  const pending = loadPendingTemplates();
  if (pending.deletes && pending.deletes[template.id]) {
    delete pending.deletes[template.id];
  }
  pending.saves[template.id] = JSON.parse(JSON.stringify(template));
  savePendingTemplatesToStorage(pending);
}

export function clearTemplatePendingSave(id) {
  const pending = loadPendingTemplates();
  if (pending.saves && pending.saves[id]) {
    delete pending.saves[id];
    savePendingTemplatesToStorage(pending);
  }
}

export function markTemplatePendingDelete(id) {
  const pending = loadPendingTemplates();
  if (pending.saves && pending.saves[id]) {
    delete pending.saves[id];
  }
  pending.deletes[id] = Date.now();
  savePendingTemplatesToStorage(pending);
}

export function clearTemplatePendingDelete(id) {
  const pending = loadPendingTemplates();
  if (pending.deletes && pending.deletes[id]) {
    delete pending.deletes[id];
    savePendingTemplatesToStorage(pending);
  }
}

export async function saveDayTemplate(templateData) {
  const templates = getDayTemplates();
  const existingIdx = templates.findIndex(t => t.id === templateData.id);
  const templateId = templateData.id || `tmpl_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  const prepared = {
    ...templateData,
    id: templateId,
    updatedAt: new Date().toISOString()
  };

  if (existingIdx >= 0) {
    templates[existingIdx] = prepared;
  } else {
    prepared.createdAt = prepared.createdAt || new Date().toISOString();
    templates.push(prepared);
  }

  saveUserSettings({ dayTemplates: templates });
  renderSettingsDayTemplatesUI();

  // Optimistic pending tracking: mark as pending save in local storage (Finding 44)
  markTemplatePendingSave(prepared);

  // Background Cloud Sync to PostgreSQL
  if (!isDemoMode() && localStorage.getItem('dayflow_token')) {
    try {
      const serverResult = await ApiClient.saveDayTemplate(prepared);
      if (serverResult && serverResult.id) {
        clearTemplatePendingSave(prepared.id);
        const idx = USER_SETTINGS.dayTemplates.findIndex(t => t.id === serverResult.id);
        if (idx >= 0) {
          USER_SETTINGS.dayTemplates[idx] = { ...USER_SETTINGS.dayTemplates[idx], ...serverResult };
          saveUserSettings({ dayTemplates: USER_SETTINGS.dayTemplates });
        }
      }
    } catch (e) {
      console.warn('Could not sync template to server, kept locally in pending saves:', e);
    }
  }

  return prepared;
}

export async function deleteDayTemplate(id) {
  let templates = getDayTemplates();
  const deletedTmpl = templates.find(t => t.id === id);
  templates = templates.filter(t => t.id !== id);
  saveUserSettings({ dayTemplates: templates });
  renderSettingsDayTemplatesUI();
  showToast(`🗑️ Deleted template "${deletedTmpl?.name || 'Template'}"`, 'info');

  // Optimistic pending tracking: mark as pending delete in local storage (Finding 44)
  markTemplatePendingDelete(id);

  // Background Cloud Sync Delete from PostgreSQL
  if (!isDemoMode() && localStorage.getItem('dayflow_token')) {
    try {
      const ok = await ApiClient.deleteDayTemplate(id);
      if (ok) {
        clearTemplatePendingDelete(id);
      }
    } catch (e) {
      console.warn('Could not delete template from server, kept locally in pending deletes:', e);
    }
  }
}

// In-flight synchronization mutex and re-run flag to prevent overlapping fetch/overwrite races (Finding 44 hardening)
let dayTemplatesSyncInFlight = null;
let dayTemplatesSyncPendingRerun = false;

export async function syncDayTemplatesFromApi() {
  if (isDemoMode()) return;
  const token = localStorage.getItem('dayflow_token');
  if (!token) return;

  if (dayTemplatesSyncInFlight) {
    dayTemplatesSyncPendingRerun = true;
    return dayTemplatesSyncInFlight;
  }

  dayTemplatesSyncInFlight = (async () => {
    try {
      do {
        dayTemplatesSyncPendingRerun = false;
        await _doSyncDayTemplates();
      } while (dayTemplatesSyncPendingRerun);
    } finally {
      dayTemplatesSyncInFlight = null;
    }
  })();

  return dayTemplatesSyncInFlight;
}

async function _doSyncDayTemplates() {
  try {
    let apiTemplates = await ApiClient.fetchDayTemplates();
    if (!Array.isArray(apiTemplates)) return;

    // Load fresh pending queue right after receiving server templates
    const pending = loadPendingTemplates();

    // 1. Process pending deletes: purge any template marked for delete so it never resurrects (Finding 44)
    if (pending.deletes && Object.keys(pending.deletes).length > 0) {
      apiTemplates = apiTemplates.filter(t => !pending.deletes[t.id]);
      for (const delId of Object.keys(pending.deletes)) {
        try {
          const ok = await ApiClient.deleteDayTemplate(delId);
          if (ok) {
            clearTemplatePendingDelete(delId);
          }
        } catch (err) {
          console.warn('Retry delete template failed, will retry next sync:', delId, err);
        }
      }
    }

    // 2. Process pending saves (edits & offline creations): ensure local edits override stale server state (Finding 44)
    if (pending.saves && Object.keys(pending.saves).length > 0) {
      for (const [saveId, pendingTmpl] of Object.entries(pending.saves)) {
        // If template was marked for deletion in the meantime, skip saving
        if (pending.deletes && pending.deletes[saveId]) continue;

        const sIdx = apiTemplates.findIndex(t => t.id === saveId);
        if (sIdx >= 0) {
          // Replace server version with local edited version
          apiTemplates[sIdx] = { ...apiTemplates[sIdx], ...pendingTmpl };
        } else {
          // Add local created version
          apiTemplates.push(pendingTmpl);
        }

        // Retry syncing to server
        try {
          const saved = await ApiClient.saveDayTemplate(pendingTmpl);
          if (saved && saved.id) {
            clearTemplatePendingSave(saveId);
          }
        } catch (err) {
          console.warn('Retry save template failed, will retry next sync:', saveId, err);
        }
      }
    }

    // Case 1: First-time cloud sync for user (PostgreSQL database is empty for this user)
    // Seamlessly migrate all existing local templates (including custom routines & edits) to PostgreSQL
    if (apiTemplates.length === 0) {
      const currentPending = loadPendingTemplates();
      const templatesToMigrate = (Array.isArray(USER_SETTINGS.dayTemplates) && USER_SETTINGS.dayTemplates.length > 0)
        ? USER_SETTINGS.dayTemplates.filter(t => !currentPending.deletes || !currentPending.deletes[t.id])
        : JSON.parse(JSON.stringify(DEFAULT_DAY_TEMPLATES));

      const migrated = [];
      for (const t of templatesToMigrate) {
        try {
          const saved = await ApiClient.saveDayTemplate(t);
          if (saved) {
            clearTemplatePendingSave(t.id);
            migrated.push(saved);
          }
        } catch (err) {
          console.warn('Could not migrate template to database:', t.id, err);
        }
      }
      if (migrated.length > 0) {
        const postMigrationPending = loadPendingTemplates();
        const safeMigrated = migrated.filter(t => !postMigrationPending.deletes || !postMigrationPending.deletes[t.id]);
        USER_SETTINGS.dayTemplates = safeMigrated;
        saveUserSettings({ dayTemplates: safeMigrated });
        renderSettingsDayTemplatesUI();
      }
      return;
    }

    // Case 2: Database already contains templates for this user -> merge any offline-created templates not yet known
    const localTemplates = Array.isArray(USER_SETTINGS.dayTemplates) ? USER_SETTINGS.dayTemplates : [];
    const serverIdSet = new Set(apiTemplates.map(t => t.id));
    const currentPending = loadPendingTemplates();

    for (const localT of localTemplates) {
      if (localT && localT.id && !serverIdSet.has(localT.id) && (!currentPending.deletes || !currentPending.deletes[localT.id])) {
        try {
          const uploaded = await ApiClient.saveDayTemplate(localT);
          if (uploaded) {
            clearTemplatePendingSave(localT.id);
            apiTemplates.push(uploaded);
            serverIdSet.add(uploaded.id);
          }
        } catch (e) {
          console.warn('Could not sync local template to server:', localT.id, e);
          // Preserve local un-synced template so it is not lost while offline
          apiTemplates.push(localT);
          serverIdSet.add(localT.id);
        }
      }
    }

    // Ensure every slot strictly has planned: 30
    apiTemplates.forEach(t => {
      if (t.slots && typeof t.slots === 'object') {
        Object.keys(t.slots).forEach(k => {
          if (t.slots[k]) t.slots[k].planned = 30;
        });
      }
    });

    // FINAL SAFETY GUARD before committing to local state:
    // Re-check pending state fresh from storage to catch any deletes or saves that happened while network calls were in-flight
    const finalPending = loadPendingTemplates();
    if (finalPending.deletes && Object.keys(finalPending.deletes).length > 0) {
      apiTemplates = apiTemplates.filter(t => !finalPending.deletes[t.id]);
    }
    if (finalPending.saves && Object.keys(finalPending.saves).length > 0) {
      for (const [saveId, pendingTmpl] of Object.entries(finalPending.saves)) {
        if (finalPending.deletes && finalPending.deletes[saveId]) continue;
        const sIdx = apiTemplates.findIndex(t => t.id === saveId);
        if (sIdx >= 0) {
          apiTemplates[sIdx] = { ...apiTemplates[sIdx], ...pendingTmpl };
        } else {
          apiTemplates.push(pendingTmpl);
        }
      }
    }

    USER_SETTINGS.dayTemplates = apiTemplates;
    saveUserSettings({ dayTemplates: apiTemplates });
    renderSettingsDayTemplatesUI();
  } catch (err) {
    console.warn('Failed to sync day templates from API:', err);
  }
}

export function renderSettingsDayTemplatesUI() {
  const listContainer = document.getElementById('settingsDayTemplatesList');
  if (!listContainer) return;

  const templates = getDayTemplates();

  if (templates.length === 0) {
    listContainer.innerHTML = `
      <div class="day-templates-empty">
        <span style="font-size: 2rem;">📋</span>
        <p style="margin: 0.5rem 0 0.25rem; font-weight: 600; color: var(--text-primary);">No day templates created yet</p>
        <p style="margin: 0; font-size: 0.8rem; color: var(--text-muted);">Click "+ New Template" above or save a day from the grid view to start.</p>
      </div>
    `;
    return;
  }

  listContainer.innerHTML = templates.map(tmpl => {
    const slots = tmpl.slots || {};
    const slotKeys = Object.keys(slots).sort();
    const count = slotKeys.length;

    const previewChips = slotKeys.slice(0, 5).map(timeKey => {
      const s = slots[timeKey];
      return `<span class="template-chip" title="${timeKey} • ${escapeSettingsHtml(s.title || s.plannedTask || 'Task')} (${s.category || 'General'})">
        <strong style="color: var(--accent-secondary);">${timeKey}</strong> ${escapeSettingsHtml(s.title || s.plannedTask || 'Task')}
      </span>`;
    }).join('');

    const moreText = count > 5 ? `<span class="template-chip-more">+${count - 5} more</span>` : '';

    return `
      <div class="day-template-card" data-template-id="${tmpl.id}">
        <div class="day-template-card-header">
          <div>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <h4 class="day-template-card-name">${escapeSettingsHtml(tmpl.name)}</h4>
              <span class="day-template-count-badge">${count} slots</span>
            </div>
            ${tmpl.description ? `<p class="day-template-card-desc">${escapeSettingsHtml(tmpl.description)}</p>` : ''}
          </div>
          <div class="day-template-card-actions">
            <button type="button" class="btn btn-secondary btn-sm edit-day-template-btn" data-template-id="${tmpl.id}" title="Edit Template">✏️ Edit</button>
            <button type="button" class="btn btn-danger btn-sm delete-day-template-btn" data-template-id="${tmpl.id}" title="Delete Template">🗑️</button>
          </div>
        </div>
        <div class="day-template-card-slots">
          ${previewChips}
          ${moreText}
        </div>
      </div>
    `;
  }).join('');

  // Wire up Edit & Delete buttons
  listContainer.querySelectorAll('.edit-day-template-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.templateId;
      openDayTemplateEditModal(id);
    });
  });

  listContainer.querySelectorAll('.delete-day-template-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.templateId;
      if (id) {
        openDeleteDayTemplateModal(id);
      }
    });
  });
}

function escapeSettingsHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, tag => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[tag] || tag));
}

// Themed Confirmation Modal for Deleting Day Templates (Finding 42)
let pendingDeleteTemplateId = null;

export function openDeleteDayTemplateModal(templateId) {
  pendingDeleteTemplateId = templateId;
  const modal = document.getElementById('deleteDayTemplateConfirmModal');
  const targetName = document.getElementById('deleteDayTemplateTargetName');
  if (!modal) return;

  const tmpl = getDayTemplateById(templateId);
  if (targetName) {
    targetName.textContent = tmpl ? `"${tmpl.name}"` : 'this template';
  }
  modal.classList.add('active');
}

export function closeDeleteDayTemplateModal() {
  const modal = document.getElementById('deleteDayTemplateConfirmModal');
  if (modal) modal.classList.remove('active');
  pendingDeleteTemplateId = null;
}

// ========================================================
// CUSTOM TASK CATEGORIES CONTROLLER & MODAL HANDLERS
// ========================================================
const PRESET_EMOJIS = ['💼', '📚', '🏃', '🧹', '👨‍👩‍👧', '✈️', '📌', '🎯', '💡', '💻', '🎨', '🎵', '💰', '🛒', '🔬', '🏋️', '🧘', '🍽️', '✍️', '⚡'];
const PRESET_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#ec4899', '#f59e0b', '#06b6d4', '#6366f1', '#14b8a6', '#f43f5e', '#84cc16', '#eab308', '#64748b'];

let pendingArchiveCategory = null;
let activeCategoryModalCallback = null;

export function renderCategoriesManagementUI(onChangedCallback) {
  const cb = onChangedCallback || activeCategoryModalCallback || onSettingsChangedCallback;
  const container = document.getElementById('settingsCategoriesList');
  const archivedContainer = document.getElementById('archivedCategoriesList');
  const archivedSummary = document.getElementById('categoryArchivedSummary');
  const archivedCountEl = document.getElementById('archivedCategoryCount');

  if (!container) return;
  container.innerHTML = '';
  if (archivedContainer) archivedContainer.innerHTML = '';

  const allCategories = getAllCategories();
  const activeCategories = allCategories.filter(c => !c.isArchived);
  const archivedCategories = allCategories.filter(c => !!c.isArchived);

  if (archivedSummary && archivedCountEl) {
    if (archivedCategories.length > 0) {
      archivedSummary.style.display = 'block';
      archivedCountEl.textContent = archivedCategories.length;
    } else {
      archivedSummary.style.display = 'none';
      if (archivedContainer) archivedContainer.style.display = 'none';
    }
  }

  // Render active categories
  activeCategories.forEach(cat => {
    const row = document.createElement('div');
    row.className = 'category-manage-row';
    row.dataset.id = cat.id;
    row.dataset.name = cat.name;

    const isSystem = Boolean(cat.isSystem);
    const isProd = Boolean(cat.isProductive);

    row.innerHTML = `
      <div class="category-manage-info">
        <span class="category-color-dot" style="background-color: ${cat.color || '#64748b'};"></span>
        <span class="category-manage-icon">${cat.icon || '📌'}</span>
        <span class="category-manage-name">${escapeSettingsHtml(cat.name)}</span>
        <div class="category-manage-badges">
          ${isSystem ? '<span class="category-badge-system">System Default</span>' : ''}
          <button type="button" class="category-badge-prod-btn ${isProd ? 'is-prod' : 'is-standard'}" data-action="toggle-prod" title="${isProd ? 'Counts towards Work Effectiveness (Click to switch to Standard)' : 'Standard category (Click to mark as Productive)'}">
            ${isProd ? '⚡ Productive' : 'Standard'}
          </button>
        </div>
      </div>
      <div class="category-manage-actions">
        <button type="button" class="category-action-btn btn-edit-cat" data-action="edit" title="Edit Category (${escapeSettingsHtml(cat.name)})" aria-label="Edit category">
          ✏️
        </button>
        <button type="button" class="category-action-btn btn-del-cat ${isSystem ? 'disabled' : ''}" data-action="archive" ${isSystem ? 'disabled title="General is a protected system default and cannot be archived"' : `title="Archive Category (${escapeSettingsHtml(cat.name)})"`} aria-label="Archive category">
          ${isSystem ? '🔒' : '🗑️'}
        </button>
      </div>
    `;

    // Row button listeners
    const prodBtn = row.querySelector('[data-action="toggle-prod"]');
    if (prodBtn) {
      prodBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await toggleCategoryProductive(cat, cb);
      });
    }

    const editBtn = row.querySelector('[data-action="edit"]');
    if (editBtn) {
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openCategoryModal(cat, cb);
      });
    }

    const archiveBtn = row.querySelector('[data-action="archive"]');
    if (archiveBtn && !isSystem) {
      archiveBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openArchiveCategoryConfirmModal(cat, cb);
      });
    }

    container.appendChild(row);
  });

  // Render archived categories if any
  if (archivedContainer && archivedCategories.length > 0) {
    archivedCategories.forEach(cat => {
      const row = document.createElement('div');
      row.className = 'category-manage-row';
      row.style.opacity = '0.75';
      row.dataset.id = cat.id;
      row.dataset.name = cat.name;

      row.innerHTML = `
        <div class="category-manage-info">
          <span class="category-color-dot" style="background-color: ${cat.color || '#64748b'};"></span>
          <span class="category-manage-icon">${cat.icon || '📌'}</span>
          <span class="category-manage-name" style="text-decoration: line-through;">${escapeSettingsHtml(cat.name)}</span>
          <div class="category-manage-badges">
            <span class="category-badge-archived">Archived</span>
          </div>
        </div>
        <div class="category-manage-actions">
          <button type="button" class="btn btn-secondary btn-xs" data-action="unarchive" style="font-size: 0.75rem; padding: 0.2rem 0.5rem;" title="Restore Category">
            ↺ Restore
          </button>
        </div>
      `;

      const restoreBtn = row.querySelector('[data-action="unarchive"]');
      if (restoreBtn) {
        restoreBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const targetInState = (STATE.categories || []).find(c => c.id === cat.id || c.name.toLowerCase() === cat.name.toLowerCase());
          if (targetInState) {
            targetInState.isArchived = false;
          }
          cat.isArchived = false;
          saveCategoriesToStorage();
          renderCategoriesManagementUI(cb);
          if (typeof cb === 'function') cb();
          showToast(`Restored category "${cat.name}"`, 'success');

          // Optimistic pending tracking: mark as pending restore in local storage (Finding 46)
          markCategoryPendingSave(cat, false);

          try {
            let res = null;
            if (cat.id && !cat.id.startsWith('cat_')) {
              res = await ApiClient.updateCategory(cat.id, { isArchived: false });
            } else {
              res = await ApiClient.createCategory({
                name: cat.name,
                icon: cat.icon,
                color: cat.color,
                isProductive: cat.isProductive,
                sortOrder: cat.sortOrder
              });
            }
            if (res && res.id) {
              clearCategoryPendingSave(cat.id);
              cat.id = res.id;
              if (targetInState) targetInState.id = res.id;
              saveCategoriesToStorage();
            } else {
              clearCategoryPendingSave(cat.id);
            }
            await syncCategoriesWithApi(() => {
              renderCategoriesManagementUI(cb);
              if (typeof cb === 'function') cb();
            });
          } catch (err) {
            console.warn('Failed to restore category on server, kept locally in pending saves:', err);
          }
        });
      }

      archivedContainer.appendChild(row);
    });
  }
}

async function toggleCategoryProductive(cat, callback) {
  const newProd = !cat.isProductive;
  cat.isProductive = newProd;

  // Sync USER_SETTINGS.productiveCategories
  let currentList = [...(USER_SETTINGS.productiveCategories || ['Work', 'Learning'])];
  if (newProd && !currentList.includes(cat.name)) {
    currentList.push(cat.name);
  } else if (!newProd && currentList.includes(cat.name)) {
    currentList = currentList.filter(c => c !== cat.name);
  }
  USER_SETTINGS.productiveCategories = currentList;
  saveUserSettings({ productiveCategories: currentList });

  saveCategoriesToStorage();
  renderCategoriesManagementUI(callback);
  if (callback) callback();
  showToast(`${cat.name} is now ${newProd ? 'marked as Productive (⚡)' : 'marked as Standard'}`, 'success');

  // Optimistic pending tracking: mark as pending save in local storage (Finding 46)
  markCategoryPendingSave(cat, false);

  try {
    await ApiClient.updateCategory(cat.id, {
      name: cat.name,
      icon: cat.icon,
      color: cat.color,
      isProductive: newProd,
      sortOrder: cat.sortOrder
    });
    clearCategoryPendingSave(cat.id);
  } catch (err) {
    console.warn('Failed to sync category productivity update to server, kept locally in pending saves:', err);
  }
}

function openCategoryModal(cat = null, callback = null) {
  activeCategoryModalCallback = callback;
  const modal = document.getElementById('categoryModal');
  const titleEl = document.getElementById('categoryModalTitle');
  const idInput = document.getElementById('categoryEditId');
  const nameInput = document.getElementById('categoryEditName');
  const iconInput = document.getElementById('categoryEditIcon');
  const iconPreview = document.getElementById('categoryIconPreview');
  const colorPicker = document.getElementById('categoryEditColorPicker');
  const colorHexInput = document.getElementById('categoryEditColorHex');
  const colorPreview = document.getElementById('categoryColorPreview');
  const isProdInput = document.getElementById('categoryEditIsProductive');
  const systemHint = document.getElementById('categorySystemNameHint');
  const presetEmojisContainer = document.getElementById('categoryPresetEmojis');
  const presetColorsContainer = document.getElementById('categoryPresetColors');

  if (!modal) return;

  const isEditing = !!cat;
  const isSystem = isEditing && Boolean(cat.isSystem);

  if (titleEl) titleEl.textContent = isEditing ? `Edit Category: ${cat.name}` : 'Create Custom Category';
  if (idInput) idInput.value = isEditing ? cat.id : '';
  if (nameInput) {
    nameInput.value = isEditing ? cat.name : '';
    nameInput.disabled = isSystem;
  }
  if (systemHint) systemHint.style.display = isSystem ? 'block' : 'none';

  const initialIcon = isEditing ? (cat.icon || '📌') : '📌';
  if (iconInput) iconInput.value = initialIcon;
  if (iconPreview) iconPreview.textContent = initialIcon;

  const initialColor = isEditing ? (cat.color || '#3b82f6') : '#3b82f6';
  if (colorPicker) colorPicker.value = initialColor;
  if (colorHexInput) colorHexInput.value = initialColor;
  if (colorPreview) colorPreview.style.backgroundColor = initialColor;

  if (isProdInput) isProdInput.checked = isEditing ? Boolean(cat.isProductive) : false;

  // Render Preset Emojis
  if (presetEmojisContainer) {
    presetEmojisContainer.innerHTML = PRESET_EMOJIS.map(emoji => `
      <button type="button" class="category-emoji-btn ${emoji === initialIcon ? 'active' : ''}" data-emoji="${emoji}">
        ${emoji}
      </button>
    `).join('');

    presetEmojisContainer.querySelectorAll('.category-emoji-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const selected = btn.dataset.emoji;
        if (iconInput) iconInput.value = selected;
        if (iconPreview) iconPreview.textContent = selected;
        presetEmojisContainer.querySelectorAll('.category-emoji-btn').forEach(b => b.classList.toggle('active', b === btn));
      });
    });
  }

  // Render Preset Colors
  if (presetColorsContainer) {
    presetColorsContainer.innerHTML = PRESET_COLORS.map(color => `
      <button type="button" class="category-color-swatch-btn ${color.toLowerCase() === initialColor.toLowerCase() ? 'active' : ''}" data-color="${color}" style="background-color: ${color};" title="${color}"></button>
    `).join('');

    presetColorsContainer.querySelectorAll('.category-color-swatch-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const selected = btn.dataset.color;
        if (colorPicker) colorPicker.value = selected;
        if (colorHexInput) colorHexInput.value = selected;
        if (colorPreview) colorPreview.style.backgroundColor = selected;
        presetColorsContainer.querySelectorAll('.category-color-swatch-btn').forEach(b => b.classList.toggle('active', b === btn));
      });
    });
  }

  modal.classList.add('active');
  if (nameInput && !isSystem) nameInput.focus();
}

function closeCategoryModal() {
  const modal = document.getElementById('categoryModal');
  if (modal) modal.classList.remove('active');
}

function openArchiveCategoryConfirmModal(cat, callback) {
  pendingArchiveCategory = cat;
  activeCategoryModalCallback = callback;
  const modal = document.getElementById('archiveCategoryConfirmModal');
  const nameText = document.getElementById('archiveCategoryNameText');
  if (nameText) nameText.textContent = `"${cat.name}"`;
  if (modal) modal.classList.add('active');
}

function closeArchiveCategoryConfirmModal() {
  pendingArchiveCategory = null;
  const modal = document.getElementById('archiveCategoryConfirmModal');
  if (modal) modal.classList.remove('active');
}

export function initCategoryManagement(onChangedCallback) {
  const addBtn = document.getElementById('addNewCategoryBtn');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      openCategoryModal(null, onChangedCallback);
    });
  }

  // Category Modal Close & Cancel
  const closeBtn = document.getElementById('closeCategoryModalBtn');
  const cancelBtn = document.getElementById('cancelCategoryModalBtn');
  const modal = document.getElementById('categoryModal');

  if (closeBtn) closeBtn.addEventListener('click', closeCategoryModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeCategoryModal);
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeCategoryModal();
    });
  }

  // Icon Input & Color Input Sync
  const iconInput = document.getElementById('categoryEditIcon');
  const iconPreview = document.getElementById('categoryIconPreview');
  if (iconInput && iconPreview) {
    iconInput.addEventListener('input', () => {
      iconPreview.textContent = iconInput.value.trim() || '📌';
    });
  }

  const colorPicker = document.getElementById('categoryEditColorPicker');
  const colorHexInput = document.getElementById('categoryEditColorHex');
  const colorPreview = document.getElementById('categoryColorPreview');

  if (colorPicker) {
    colorPicker.addEventListener('input', () => {
      if (colorHexInput) colorHexInput.value = colorPicker.value;
      if (colorPreview) colorPreview.style.backgroundColor = colorPicker.value;
    });
  }

  if (colorHexInput) {
    colorHexInput.addEventListener('input', () => {
      const val = colorHexInput.value.trim();
      if (/^#[0-9a-fA-F]{6}$/.test(val)) {
        if (colorPicker) colorPicker.value = val;
        if (colorPreview) colorPreview.style.backgroundColor = val;
      }
    });
  }

  // Save Category Button
  const saveBtn = document.getElementById('saveCategoryModalBtn');
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const idInput = document.getElementById('categoryEditId');
      const nameInput = document.getElementById('categoryEditName');
      const isProdInput = document.getElementById('categoryEditIsProductive');

      const catId = idInput ? idInput.value : '';
      const name = nameInput ? nameInput.value.trim() : '';
      const icon = (iconInput ? iconInput.value.trim() : '') || '📌';
      const color = (colorHexInput ? colorHexInput.value.trim() : '') || '#3b82f6';
      const isProductive = isProdInput ? Boolean(isProdInput.checked) : false;

      if (!name) {
        showToast('Please enter a category name', 'error');
        if (nameInput) nameInput.focus();
        return;
      }

      const allCategories = getAllCategories();
      const existingWithSameName = allCategories.find(c => c.name.toLowerCase() === name.toLowerCase() && c.id !== catId);
      if (existingWithSameName) {
        showToast(`A category named "${name}" already exists`, 'error');
        return;
      }

      if (catId) {
        // Edit existing
        const targetCat = allCategories.find(c => c.id === catId);
        if (targetCat) {
          const oldName = targetCat.name;
          const finalName = targetCat.isSystem ? targetCat.name : name;

          targetCat.name = finalName;
          targetCat.icon = icon;
          targetCat.color = color;
          targetCat.isProductive = isProductive;

          if (oldName !== finalName) {
            cascadeCategoryRenameLocally(oldName, finalName);
          }

          saveCategoriesToStorage();
          closeCategoryModal();
          renderCategoriesManagementUI(activeCategoryModalCallback);
          if (activeCategoryModalCallback) activeCategoryModalCallback();
          showToast(`Category "${finalName}" updated successfully`, 'success');

          // Optimistic pending tracking: mark as pending save in local storage (Finding 46)
          markCategoryPendingSave({ ...targetCat, _originalName: oldName }, false, oldName);

          try {
            await ApiClient.updateCategory(catId, {
              name: finalName,
              icon,
              color,
              isProductive,
              sortOrder: targetCat.sortOrder || 0
            });
            clearCategoryPendingSave(catId);
          } catch (err) {
            console.warn('Failed to update category on server, kept locally in pending saves:', err);
          }
        }
      } else {
        // Create new
        const newCat = {
          id: generateUUID(),
          name,
          icon,
          color,
          isProductive,
          isSystem: false,
          isArchived: false,
          sortOrder: STATE.categories.length
        };

        STATE.categories.push(newCat);
        saveCategoriesToStorage();
        closeCategoryModal();
        renderCategoriesManagementUI(activeCategoryModalCallback);
        if (activeCategoryModalCallback) activeCategoryModalCallback();
        showToast(`Category "${name}" created successfully`, 'success');

        // Optimistic pending tracking: mark as pending save in local storage (Finding 46)
        markCategoryPendingSave(newCat, true);

        try {
          const res = await ApiClient.createCategory({
            name,
            icon,
            color,
            isProductive,
            sortOrder: newCat.sortOrder
          });
          if (res && res.id) {
            clearCategoryPendingSave(newCat.id);
            newCat.id = res.id;
            saveCategoriesToStorage();
          }
        } catch (err) {
          console.warn('Failed to save category to server, kept locally in pending saves:', err);
        }
      }
    });
  }

  // Archive Confirm Modal Handlers
  const closeArchiveBtn = document.getElementById('closeArchiveCategoryModalBtn');
  const cancelArchiveBtn = document.getElementById('cancelArchiveCategoryBtn');
  const confirmArchiveBtn = document.getElementById('confirmArchiveCategoryBtn');
  const archiveModal = document.getElementById('archiveCategoryConfirmModal');

  if (closeArchiveBtn) closeArchiveBtn.addEventListener('click', closeArchiveCategoryConfirmModal);
  if (cancelArchiveBtn) cancelArchiveBtn.addEventListener('click', closeArchiveCategoryConfirmModal);
  if (archiveModal) {
    archiveModal.addEventListener('click', (e) => {
      if (e.target === archiveModal) closeArchiveCategoryConfirmModal();
    });
  }

  if (confirmArchiveBtn) {
    confirmArchiveBtn.addEventListener('click', async () => {
      if (!pendingArchiveCategory) return;
      const target = pendingArchiveCategory;
      const targetInState = (STATE.categories || []).find(c => c.id === target.id || c.name.toLowerCase() === target.name.toLowerCase());
      if (targetInState) targetInState.isArchived = true;
      target.isArchived = true;
      saveCategoriesToStorage();
      closeArchiveCategoryConfirmModal();
      const cb = activeCategoryModalCallback || onSettingsChangedCallback;
      renderCategoriesManagementUI(cb);
      if (typeof cb === 'function') cb();
      showToast(`Category "${target.name}" archived`, 'info');

      // Optimistic pending tracking: mark as pending save in local storage (Finding 46)
      markCategoryPendingSave(target, false);

      try {
        await ApiClient.deleteCategory(target.id);
        clearCategoryPendingSave(target.id);
        await syncCategoriesWithApi(() => {
          renderCategoriesManagementUI(cb);
          if (typeof cb === 'function') cb();
        });
      } catch (err) {
        console.warn('Failed to archive category on server, kept locally in pending saves:', err);
      }
    });
  }

  // Show / Hide archived toggle
  const toggleArchivedBtn = document.getElementById('toggleArchivedCategoriesBtn');
  const archivedList = document.getElementById('archivedCategoriesList');
  if (toggleArchivedBtn && archivedList) {
    toggleArchivedBtn.addEventListener('click', () => {
      const isVisible = archivedList.style.display !== 'none';
      archivedList.style.display = isVisible ? 'none' : 'flex';
      toggleArchivedBtn.textContent = isVisible
        ? `Show Archived Categories (${document.getElementById('archivedCategoryCount')?.textContent || 0})`
        : `Hide Archived Categories (${document.getElementById('archivedCategoryCount')?.textContent || 0})`;
    });
  }

  renderCategoriesManagementUI(onChangedCallback);
}

// Modal Controller for Template Builder Modal
export function initDayTemplateModals() {
  const createBtn = document.getElementById('createDayTemplateBtn');
  if (createBtn) {
    createBtn.addEventListener('click', () => {
      openDayTemplateEditModal(null);
    });
  }

  const editModal = document.getElementById('dayTemplateEditModal');
  const closeEditBtn = document.getElementById('closeDayTemplateEditModalBtn');
  const cancelEditBtn = document.getElementById('cancelDayTemplateEditBtn');
  const saveConfirmBtn = document.getElementById('saveDayTemplateConfirmBtn');
  const addSlotRowBtn = document.getElementById('templateAddSlotRowBtn');

  if (closeEditBtn) closeEditBtn.addEventListener('click', closeDayTemplateEditModal);
  if (cancelEditBtn) cancelEditBtn.addEventListener('click', closeDayTemplateEditModal);
  if (editModal) {
    editModal.addEventListener('click', (e) => {
      if (e.target === editModal) closeDayTemplateEditModal();
    });
  }

  // Themed Delete Modal handlers
  const deleteModal = document.getElementById('deleteDayTemplateConfirmModal');
  const cancelDeleteBtn = document.getElementById('cancelDeleteDayTemplateBtn');
  const confirmDeleteBtn = document.getElementById('confirmDeleteDayTemplateBtn');

  if (cancelDeleteBtn) cancelDeleteBtn.addEventListener('click', closeDeleteDayTemplateModal);
  if (deleteModal) {
    deleteModal.addEventListener('click', (e) => {
      if (e.target === deleteModal) closeDeleteDayTemplateModal();
    });
  }
  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', () => {
      if (pendingDeleteTemplateId) {
        const idToDelete = pendingDeleteTemplateId;
        closeDeleteDayTemplateModal();
        deleteDayTemplate(idToDelete);
      }
    });
  }

  if (addSlotRowBtn) {
    addSlotRowBtn.addEventListener('click', () => {
      addTemplateSlotRow();
    });
  }

  if (saveConfirmBtn) {
    saveConfirmBtn.addEventListener('click', () => {
      handleSaveDayTemplateFromModal();
    });
  }

  // Initial render of templates list in Settings
  renderSettingsDayTemplatesUI();
}

export function openDayTemplateEditModal(templateId = null) {
  const modal = document.getElementById('dayTemplateEditModal');
  if (!modal) return;

  const titleEl = document.getElementById('dayTemplateEditModalTitle');
  const idInput = document.getElementById('dayTemplateEditId');
  const nameInput = document.getElementById('dayTemplateEditName');
  const descInput = document.getElementById('dayTemplateEditDesc');
  const rowsContainer = document.getElementById('templateSlotsRowsContainer');

  rowsContainer.innerHTML = '';

  if (templateId) {
    const tmpl = getDayTemplateById(templateId);
    if (!tmpl) return;
    if (titleEl) titleEl.textContent = 'Edit Day Template';
    if (idInput) idInput.value = tmpl.id;
    if (nameInput) nameInput.value = tmpl.name || '';
    if (descInput) descInput.value = tmpl.description || '';

    const slots = tmpl.slots || {};
    const sortedKeys = Object.keys(slots).sort();
    if (sortedKeys.length === 0) {
      addTemplateSlotRow('09:00', '', 'Work', 30);
    } else {
      sortedKeys.forEach(timeKey => {
        const s = slots[timeKey];
        addTemplateSlotRow(timeKey, s.title || s.plannedTask || '', s.category || 'General', s.planned || 30);
      });
    }
  } else {
    if (titleEl) titleEl.textContent = 'Create Day Template';
    if (idInput) idInput.value = '';
    if (nameInput) nameInput.value = '';
    if (descInput) descInput.value = '';
    addTemplateSlotRow('09:00', '', 'Work', 30);
    addTemplateSlotRow('10:00', '', 'Work', 60);
    addTemplateSlotRow('14:00', '', 'Work', 60);
  }

  modal.classList.add('active');
  if (nameInput) nameInput.focus();
}

export function closeDayTemplateEditModal() {
  const modal = document.getElementById('dayTemplateEditModal');
  if (modal) modal.classList.remove('active');
}

function addTemplateSlotRow(time = '09:00', title = '', category = 'Work', planned = 30) {
  const container = document.getElementById('templateSlotsRowsContainer');
  if (!container) return;

  const row = document.createElement('div');
  row.className = 'template-slot-edit-row';

  // Generate 30-min time options
  const timeOptions = [];
  for (let h = 0; h < 24; h++) {
    for (let m of [0, 30]) {
      const hh = String(h).padStart(2, '0');
      const mm = String(m).padStart(2, '0');
      const key = `${hh}:${mm}`;
      const isSel = key === time ? 'selected' : '';
      timeOptions.push(`<option value="${key}" ${isSel}>${key}</option>`);
    }
  }

  const activeCats = getActiveCategories().map(c => c.name);
  const categories = activeCats.length > 0 ? [...activeCats] : ['Work', 'Learning', 'Health', 'Household', 'Family', 'Travel', 'General'];
  if (category && !categories.includes(category)) {
    categories.push(category);
  }
  const catOptions = categories.map(c => `<option value="${escapeSettingsHtml(c)}" ${c === category ? 'selected' : ''}>${escapeSettingsHtml(c)}</option>`).join('');

  row.innerHTML = `
    <select class="select-input template-row-time" style="width: 100px;">
      ${timeOptions.join('')}
    </select>
    <input type="text" class="text-input template-row-title" placeholder="Task name / activity..." value="${escapeSettingsHtml(title)}" style="flex: 1;" required>
    <select class="select-input template-row-category" style="width: 110px;">
      ${catOptions}
    </select>
    <span class="template-row-duration-badge" style="font-size: 0.78rem; font-weight: 600; padding: 0.35rem 0.55rem; border-radius: 6px; background: rgba(99, 102, 241, 0.12); color: var(--accent-primary); border: 1px solid rgba(99, 102, 241, 0.25);" title="Slot duration is fixed at 30 minutes">30m</span>
    <button type="button" class="btn btn-secondary btn-sm template-row-delete-btn" title="Remove slot" style="padding: 0.3rem 0.6rem; color: #f87171;">✕</button>
  `;

  row.querySelector('.template-row-delete-btn').addEventListener('click', () => {
    row.remove();
  });

  container.appendChild(row);
}

function handleSaveDayTemplateFromModal() {
  const idInput = document.getElementById('dayTemplateEditId');
  const nameInput = document.getElementById('dayTemplateEditName');
  const descInput = document.getElementById('dayTemplateEditDesc');
  const container = document.getElementById('templateSlotsRowsContainer');

  const name = nameInput ? nameInput.value.trim() : '';
  if (!name) {
    showToast('Please enter a template name.', 'error');
    if (nameInput) nameInput.focus();
    return;
  }

  const slots = {};
  const rows = container.querySelectorAll('.template-slot-edit-row');
  rows.forEach(row => {
    const time = row.querySelector('.template-row-time')?.value;
    const title = row.querySelector('.template-row-title')?.value.trim();
    const category = row.querySelector('.template-row-category')?.value || 'General';

    if (time && title) {
      slots[time] = {
        title,
        plannedTask: title,
        category,
        planned: 30
      };
    }
  });

  const templateId = idInput && idInput.value ? idInput.value : `tmpl_${Date.now()}`;
  saveDayTemplate({
    id: templateId,
    name,
    description: descInput ? descInput.value.trim() : '',
    slots
  });

  closeDayTemplateEditModal();
}

