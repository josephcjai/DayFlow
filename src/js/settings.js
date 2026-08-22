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
import { generateTimeSlots } from './grid.js?v=2.5.5';
import { STATE, getUserStorageKey, saveStateToStorage } from './state.js?v=2.5.5';

export const DEFAULT_SETTINGS = {
  timelineStartHour: 0,
  timelineEndHour: 23,
  timeFormat: '12h',
  defaultLandingView: 'grid',
  themeMode: 'dark', // 'dark', 'oled', 'emerald', 'light'
  accentColor: 'indigo', // 'indigo', 'emerald', 'cyan', 'purple', 'rose'
  compactGrid: false,
  dailyPointsTarget: 50,
  todoRewardPoints: 15
};

export let USER_SETTINGS = { ...DEFAULT_SETTINGS };
let onSettingsChangedCallback = null;

export function getSettingsStorageKey() {
  const userKey = getUserStorageKey();
  return `settings_${userKey}`;
}

export function loadUserSettings() {
  try {
    const key = getSettingsStorageKey();
    const stored = localStorage.getItem(key);
    if (stored) {
      USER_SETTINGS = { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    } else {
      USER_SETTINGS = { ...DEFAULT_SETTINGS };
    }
  } catch (e) {
    console.error('Failed to load user settings:', e);
    USER_SETTINGS = { ...DEFAULT_SETTINGS };
  }
  return USER_SETTINGS;
}

export function saveUserSettings(newSettings) {
  try {
    USER_SETTINGS = { ...USER_SETTINGS, ...newSettings };
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
  // 1. Rebuild Timeline Slots
  generateTimeSlots(settings.timelineStartHour, settings.timelineEndHour, settings.timeFormat);

  // 2. Apply Theme & Accent
  applyTheme(settings.themeMode);
  applyAccent(settings.accentColor);

  // 3. Compact Grid Class
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
      if (u.name) userName = u.name.replace(/[^a-zA-Z0-9]/g, '_');
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
  const defaultViewSelect = document.getElementById('settingsDefaultView');
  const compactGridToggle = document.getElementById('settingsCompactGrid');

  const dailyPointsInput = document.getElementById('settingsDailyPoints');
  const todoRewardInput = document.getElementById('settingsTodoReward');

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
    if (defaultViewSelect) defaultViewSelect.value = USER_SETTINGS.defaultLandingView || 'grid';
    if (compactGridToggle) compactGridToggle.checked = !!USER_SETTINGS.compactGrid;

    if (dailyPointsInput) dailyPointsInput.value = USER_SETTINGS.dailyPointsTarget || 50;
    if (todoRewardInput) todoRewardInput.value = USER_SETTINGS.todoRewardPoints || 15;

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
        defaultLandingView: defaultViewSelect?.value || 'grid',
        compactGrid: !!compactGridToggle?.checked,
        dailyPointsTarget: parseInt(dailyPointsInput?.value, 10) || 50,
        todoRewardPoints: parseInt(todoRewardInput?.value, 10) || 15,
        themeMode: activeThemeCard?.dataset.theme || 'dark',
        accentColor: activeAccentPill?.dataset.accent || 'indigo'
      };

      saveUserSettings(updated);
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
}
