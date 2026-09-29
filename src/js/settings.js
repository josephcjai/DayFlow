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
import { generateTimeSlots } from './grid.js?v=2.9.13';
import { STATE, getUserStorageKey, saveStateToStorage, setActiveDateFormat } from './state.js?v=2.9.13';
import { playNotificationSound, requestNotificationPermission, getNotificationPermissionStatus, updateNotificationBellUI } from './notifications.js?v=2.9.13';
import { ApiClient } from './apiClient.js?v=2.9.13';

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
  dayTemplates: DEFAULT_DAY_TEMPLATES
};

export let USER_SETTINGS = { ...DEFAULT_SETTINGS };
let onSettingsChangedCallback = null;

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
        dayTemplates: Array.isArray(parsed.dayTemplates) ? parsed.dayTemplates : JSON.parse(JSON.stringify(DEFAULT_DAY_TEMPLATES))
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
    updatePermissionBadgeUI();

    // Theme cards active state
    themeCards.forEach(card => {
      card.classList.toggle('active', card.dataset.theme === USER_SETTINGS.themeMode);
    });

    // Accent pills active state
    accentPills.forEach(pill => {
      pill.classList.toggle('active', pill.dataset.accent === USER_SETTINGS.accentColor);
    });
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
        notifySlotEnd: !!notifSlotEndToggle?.checked
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

  // Initialize Day Templates Modals and List
  initDayTemplateModals();
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

export function saveDayTemplate(templateData) {
  const templates = getDayTemplates();
  const existingIdx = templates.findIndex(t => t.id === templateData.id);

  if (existingIdx >= 0) {
    templates[existingIdx] = {
      ...templates[existingIdx],
      ...templateData,
      updatedAt: new Date().toISOString()
    };
  } else {
    templates.push({
      ...templateData,
      id: templateData.id || `tmpl_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }

  saveUserSettings({ dayTemplates: templates });
  renderSettingsDayTemplatesUI();
  return templateData;
}

export function deleteDayTemplate(id) {
  let templates = getDayTemplates();
  templates = templates.filter(t => t.id !== id);
  saveUserSettings({ dayTemplates: templates });
  renderSettingsDayTemplatesUI();
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
      const tmpl = getDayTemplateById(id);
      if (confirm(`Are you sure you want to delete the template "${tmpl?.name || 'this template'}"?`)) {
        deleteDayTemplate(id);
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

  const categories = ['Work', 'Learning', 'Health', 'Household', 'Family', 'Travel', 'General'];
  const catOptions = categories.map(c => `<option value="${c}" ${c === category ? 'selected' : ''}>${c}</option>`).join('');

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
    alert('Please enter a template name.');
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

