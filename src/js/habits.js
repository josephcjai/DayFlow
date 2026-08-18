/**
 * DayFlow Habit Ledger Module
 * Supports:
 * 1. Creating and editing quick action presets with emoji & point pickers
 * 2. Confirmation warning before deleting a quick action preset
 * 3. Confirmation warning before deleting a habit history log entry
 * Robust row deletion, date & time logging for past dates, and Day/Week view filtering
 */
import { getCurrentWeekData, saveStateToStorage, getWeekKey, STATE, formatDateISO } from './state.js?v=2.4.0';
import { ApiClient } from './apiClient.js?v=2.4.0';
import { escapeHtml } from './utils.js?v=2.4.0';

export const DEFAULT_HABIT_PRESETS = [
  { id: 'p1', icon: '🍽️', name: 'Meal Logged', pts: 5, label: 'Log Meal & Cleaned Hands' },
  { id: 'p2', icon: '🛋️', name: 'Non-Working Hours Logged', pts: 10, label: 'Log Non-Working Hours' },
  { id: 'p3', icon: '🎯', name: 'Disciplined Focus Session', pts: 15, label: '2-Hour Deep Work Complete' },
  { id: 'p4', icon: '💻', name: 'Skill Practice Complete', pts: 10, label: 'WPF / WCF Coding Session' }
];

let pendingDeletePreset = null;
let pendingDeleteLog = null;
let editingPresetId = null;
let modalsInitialized = false;

export function getStoredPresets() {
  try {
    const saved = localStorage.getItem('dayflow_habit_presets');
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return DEFAULT_HABIT_PRESETS;
}

export function saveStoredPresets(presets) {
  try {
    localStorage.setItem('dayflow_habit_presets', JSON.stringify(presets));
  } catch (e) {}
}

export function openDeleteHabitLogModal(log, rawId, weekData, habitLogTableBody, totalPointsBadge) {
  pendingDeleteLog = { log, rawId, weekData, habitLogTableBody, totalPointsBadge };
  const deleteHabitLogConfirmModal = document.getElementById('deleteHabitLogConfirmModal');
  const deleteHabitLogTargetName = document.getElementById('deleteHabitLogTargetName');

  if (deleteHabitLogTargetName) {
    const ptsText = log.pts ? ` (+${log.pts} pts)` : '';
    deleteHabitLogTargetName.textContent = `"${log.name}"${ptsText}`;
  }

  if (deleteHabitLogConfirmModal) {
    deleteHabitLogConfirmModal.classList.add('active');
  }
}

export function renderHabits(habitLogTableBody, totalPointsBadge) {
  const weekData = getCurrentWeekData();
  habitLogTableBody.innerHTML = '';

  let totalPoints = 0;
  const allHabits = weekData.habits || [];

  // Filter habits according to active view mode (Day vs Week/Month)
  const isDayView = STATE.scheduleViewMode === 'day';
  const selectedDateStr = STATE.selectedDate ? formatDateISO(STATE.selectedDate) : null;

  const habits = allHabits.filter(log => {
    if (isDayView && selectedDateStr) {
      let logDateStr = '';
      if (log.time && log.time.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(log.time)) {
        logDateStr = log.time.slice(0, 10);
      } else {
        logDateStr = getWeekKey(STATE.currentWeekStart);
      }
      return logDateStr === selectedDateStr;
    }
    return true;
  });

  if (habits.length === 0) {
    const periodLabel = (isDayView && selectedDateStr) ? `for ${selectedDateStr}` : `for this week`;
    habitLogTableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color: var(--text-muted);">No habit logs recorded ${periodLabel} yet. Use the form above to log actions!</td></tr>`;
  } else {
    habits.slice().reverse().forEach((log) => {
      totalPoints += (log.pts || 0);
      let displayTime = log.time || '—';
      if (displayTime !== '—') {
        const hasDate = /^\d{4}-\d{2}-\d{2}/.test(displayTime) || /^\d{1,2}\/\d{1,2}/.test(displayTime);
        if (!hasDate) {
          const weekKey = getWeekKey(STATE.currentWeekStart);
          displayTime = `${weekKey} ${displayTime}`;
        }
      }

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><span class="habit-time-badge">${escapeHtml(displayTime)}</span></td>
        <td><strong>${escapeHtml(log.name)}</strong></td>
        <td><span class="pts-badge">+${log.pts} pts</span></td>
        <td>${escapeHtml(log.notes || '—')}</td>
        <td><button class="delete-habit-btn" data-id="${log.id}" title="Remove entry">✕</button></td>
      `;
      habitLogTableBody.appendChild(tr);
    });

    habitLogTableBody.querySelectorAll('.delete-habit-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const rawId = btn.dataset.id;
        const numId = parseInt(rawId, 10);
        const targetLog = weekData.habits.find(h => String(h.id) === String(rawId) || h.id === numId) || { name: 'Habit Entry' };
        openDeleteHabitLogModal(targetLog, rawId, weekData, habitLogTableBody, totalPointsBadge);
      });
    });
  }

  totalPointsBadge.textContent = `${totalPoints} Pts`;
}

function initHabitModals(container, habitLogTableBody, totalPointsBadge, getSelectedDateFn) {
  if (modalsInitialized) return;
  modalsInitialized = true;

  // Add / Edit Preset Modal elements
  const presetModal = document.getElementById('presetModal');
  const closePresetModalBtn = document.getElementById('closePresetModalBtn');
  const cancelPresetBtn = document.getElementById('cancelPresetBtn');
  const presetHabitForm = document.getElementById('presetHabitForm');
  const presetNameInput = document.getElementById('presetNameInput');
  const presetIconInput = document.getElementById('presetIconInput');
  const presetPtsInput = document.getElementById('presetPtsInput');
  const presetLabelInput = document.getElementById('presetLabelInput');
  const emojiPills = document.querySelectorAll('.emoji-pill');
  const pointsPills = document.querySelectorAll('.points-pill');

  // Delete Preset Confirm Modal elements
  const deleteConfirmModal = document.getElementById('deletePresetConfirmModal');
  const cancelDeletePresetBtn = document.getElementById('cancelDeletePresetBtn');
  const confirmDeletePresetBtn = document.getElementById('confirmDeletePresetBtn');

  // Delete Habit Log Confirm Modal elements
  const deleteHabitLogConfirmModal = document.getElementById('deleteHabitLogConfirmModal');
  const cancelDeleteHabitLogBtn = document.getElementById('cancelDeleteHabitLogBtn');
  const confirmDeleteHabitLogBtn = document.getElementById('confirmDeleteHabitLogBtn');

  const closeAddModal = () => {
    if (presetModal) presetModal.classList.remove('active');
    editingPresetId = null;
  };

  const closeDeletePresetModal = () => {
    if (deleteConfirmModal) deleteConfirmModal.classList.remove('active');
    pendingDeletePreset = null;
  };

  const closeDeleteHabitLogModal = () => {
    if (deleteHabitLogConfirmModal) deleteHabitLogConfirmModal.classList.remove('active');
    pendingDeleteLog = null;
  };

  if (closePresetModalBtn) closePresetModalBtn.addEventListener('click', closeAddModal);
  if (cancelPresetBtn) cancelPresetBtn.addEventListener('click', closeAddModal);
  if (presetModal) {
    presetModal.addEventListener('click', (e) => {
      if (e.target === presetModal) closeAddModal();
    });
  }

  if (cancelDeletePresetBtn) cancelDeletePresetBtn.addEventListener('click', closeDeletePresetModal);
  if (deleteConfirmModal) {
    deleteConfirmModal.addEventListener('click', (e) => {
      if (e.target === deleteConfirmModal) closeDeletePresetModal();
    });
  }

  if (cancelDeleteHabitLogBtn) cancelDeleteHabitLogBtn.addEventListener('click', closeDeleteHabitLogModal);
  if (deleteHabitLogConfirmModal) {
    deleteHabitLogConfirmModal.addEventListener('click', (e) => {
      if (e.target === deleteHabitLogConfirmModal) closeDeleteHabitLogModal();
    });
  }

  // Emoji pill quick selection
  emojiPills.forEach(pill => {
    pill.addEventListener('click', () => {
      emojiPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      if (presetIconInput) presetIconInput.value = pill.dataset.emoji;
    });
  });

  if (presetIconInput) {
    presetIconInput.addEventListener('input', () => {
      const val = presetIconInput.value.trim();
      emojiPills.forEach(p => {
        if (p.dataset.emoji === val) p.classList.add('active');
        else p.classList.remove('active');
      });
    });
  }

  // Points pill quick selection
  pointsPills.forEach(pill => {
    pill.addEventListener('click', () => {
      pointsPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      if (presetPtsInput) presetPtsInput.value = pill.dataset.pts;
    });
  });

  if (presetPtsInput) {
    presetPtsInput.addEventListener('input', () => {
      const val = presetPtsInput.value.trim();
      pointsPills.forEach(p => {
        if (p.dataset.pts === val) p.classList.add('active');
        else p.classList.remove('active');
      });
    });
  }

  // Submit new or edited preset
  if (presetHabitForm) {
    presetHabitForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = presetNameInput ? presetNameInput.value.trim() : '';
      if (!name) return;

      const icon = presetIconInput && presetIconInput.value.trim() ? presetIconInput.value.trim() : '⚡';
      const pts = presetPtsInput ? (parseInt(presetPtsInput.value, 10) || 10) : 10;
      const customLabel = presetLabelInput && presetLabelInput.value.trim() ? presetLabelInput.value.trim() : name;

      const presets = getStoredPresets();

      if (editingPresetId) {
        // Edit existing preset
        const idx = presets.findIndex(p => p.id === editingPresetId);
        if (idx !== -1) {
          presets[idx] = {
            ...presets[idx],
            icon,
            name,
            pts,
            label: customLabel
          };
        }
      } else {
        // Create new preset
        presets.push({
          id: `p_${Date.now()}`,
          icon,
          name,
          pts,
          label: customLabel
        });
      }

      saveStoredPresets(presets);
      closeAddModal();
      renderQuickPresetsUI(container, habitLogTableBody, totalPointsBadge, getSelectedDateFn);
    });
  }

  // Confirm delete preset
  if (confirmDeletePresetBtn) {
    confirmDeletePresetBtn.addEventListener('click', () => {
      if (!pendingDeletePreset) return;
      const targetId = pendingDeletePreset.id;
      const newPresets = getStoredPresets().filter(pr => pr.id !== targetId);
      saveStoredPresets(newPresets);
      closeDeletePresetModal();
      renderQuickPresetsUI(container, habitLogTableBody, totalPointsBadge, getSelectedDateFn);
    });
  }

  // Confirm delete habit history log entry
  if (confirmDeleteHabitLogBtn) {
    confirmDeleteHabitLogBtn.addEventListener('click', async () => {
      if (!pendingDeleteLog) return;
      const { rawId, weekData: targetWeekData, habitLogTableBody: targetBody, totalPointsBadge: targetBadge } = pendingDeleteLog;
      const numId = parseInt(rawId, 10);
      
      targetWeekData.habits = (targetWeekData.habits || []).filter(h => String(h.id) !== String(rawId) && h.id !== numId);
      saveStateToStorage();
      closeDeleteHabitLogModal();
      renderHabits(targetBody, targetBadge);
      await ApiClient.deleteHabit(rawId);
    });
  }
}

export function openAddPresetModal() {
  editingPresetId = null;
  const presetModal = document.getElementById('presetModal');
  const presetModalHeading = document.getElementById('presetModalHeading');
  const presetSubmitBtn = document.getElementById('presetSubmitBtn');
  const presetHabitForm = document.getElementById('presetHabitForm');
  const presetNameInput = document.getElementById('presetNameInput');
  const presetIconInput = document.getElementById('presetIconInput');
  const presetPtsInput = document.getElementById('presetPtsInput');
  const presetLabelInput = document.getElementById('presetLabelInput');
  const emojiPills = document.querySelectorAll('.emoji-pill');
  const pointsPills = document.querySelectorAll('.points-pill');

  if (presetModalHeading) presetModalHeading.textContent = 'Create Quick Action Preset';
  if (presetSubmitBtn) presetSubmitBtn.innerHTML = '➕ Create Preset Action';

  if (presetHabitForm) presetHabitForm.reset();
  if (presetIconInput) presetIconInput.value = '⚡';
  if (presetPtsInput) presetPtsInput.value = '10';

  emojiPills.forEach(p => {
    if (p.dataset.emoji === '⚡') p.classList.add('active');
    else p.classList.remove('active');
  });

  pointsPills.forEach(p => {
    if (p.dataset.pts === '10') p.classList.add('active');
    else p.classList.remove('active');
  });

  if (presetModal) {
    presetModal.classList.add('active');
    if (presetNameInput) setTimeout(() => presetNameInput.focus(), 50);
  }
}

export function openEditPresetModal(preset) {
  if (!preset) return;
  editingPresetId = preset.id;

  const presetModal = document.getElementById('presetModal');
  const presetModalHeading = document.getElementById('presetModalHeading');
  const presetSubmitBtn = document.getElementById('presetSubmitBtn');
  const presetNameInput = document.getElementById('presetNameInput');
  const presetIconInput = document.getElementById('presetIconInput');
  const presetPtsInput = document.getElementById('presetPtsInput');
  const presetLabelInput = document.getElementById('presetLabelInput');
  const emojiPills = document.querySelectorAll('.emoji-pill');
  const pointsPills = document.querySelectorAll('.points-pill');

  if (presetModalHeading) presetModalHeading.textContent = 'Edit Quick Action Preset';
  if (presetSubmitBtn) presetSubmitBtn.innerHTML = '💾 Save Changes';

  if (presetNameInput) presetNameInput.value = preset.name || '';
  if (presetIconInput) presetIconInput.value = preset.icon || '⚡';
  if (presetPtsInput) presetPtsInput.value = preset.pts || 10;
  if (presetLabelInput) presetLabelInput.value = preset.label || preset.name || '';

  const activeEmoji = preset.icon || '⚡';
  emojiPills.forEach(p => {
    if (p.dataset.emoji === activeEmoji) p.classList.add('active');
    else p.classList.remove('active');
  });

  const activePtsStr = String(preset.pts || 10);
  pointsPills.forEach(p => {
    if (p.dataset.pts === activePtsStr) p.classList.add('active');
    else p.classList.remove('active');
  });

  if (presetModal) {
    presetModal.classList.add('active');
    if (presetNameInput) setTimeout(() => presetNameInput.focus(), 50);
  }
}

export function openDeletePresetModal(preset) {
  pendingDeletePreset = preset;
  const deleteConfirmModal = document.getElementById('deletePresetConfirmModal');
  const deletePresetTargetName = document.getElementById('deletePresetTargetName');

  if (deletePresetTargetName) {
    deletePresetTargetName.textContent = `"${preset.label || preset.name}"`;
  }

  if (deleteConfirmModal) {
    deleteConfirmModal.classList.add('active');
  }
}

export function renderQuickPresetsUI(container, habitLogTableBody, totalPointsBadge, getSelectedDateFn) {
  if (!container) return;
  initHabitModals(container, habitLogTableBody, totalPointsBadge, getSelectedDateFn);

  const presets = getStoredPresets();
  container.innerHTML = '';

  presets.forEach(p => {
    const btnContainer = document.createElement('div');
    btnContainer.className = 'preset-btn-wrapper';
    btnContainer.innerHTML = `
      <button type="button" class="habit-btn" data-habit="${escapeHtml(p.name)}" data-pts="${p.pts}">
        <span class="icon">${p.icon || '⭐'}</span> ${escapeHtml(p.label || p.name)} <span class="pts">+${p.pts} pts</span>
      </button>
      <div class="preset-actions-badges">
        <button type="button" class="edit-preset-badge" data-preset-id="${p.id}" title="Edit preset">✏️</button>
        <button type="button" class="remove-preset-badge" data-preset-id="${p.id}" title="Remove preset button">✕</button>
      </div>
    `;

    btnContainer.querySelector('.habit-btn').addEventListener('click', () => {
      const selectedDate = getSelectedDateFn ? getSelectedDateFn() : formatDateISO(new Date());
      addHabitLog(p.name, p.pts, "Quick trigger action", habitLogTableBody, totalPointsBadge, selectedDate);
    });

    btnContainer.querySelector('.edit-preset-badge').addEventListener('click', (e) => {
      e.stopPropagation();
      openEditPresetModal(p);
    });

    btnContainer.querySelector('.remove-preset-badge').addEventListener('click', (e) => {
      e.stopPropagation();
      openDeletePresetModal(p);
    });

    container.appendChild(btnContainer);
  });

  // Add Preset Button
  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'btn btn-secondary add-preset-btn';
  addBtn.innerHTML = `<span>➕ Add Preset Action</span>`;
  addBtn.addEventListener('click', () => {
    openAddPresetModal();
  });

  container.appendChild(addBtn);
}

export async function addHabitLog(name, pts, notes, habitLogTableBody, totalPointsBadge, customDateStr = null) {
  const now = new Date();
  const timeOfDayStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  let targetDateISO = customDateStr || formatDateISO(now);
  let timestampStr = `${targetDateISO} ${timeOfDayStr}`;

  // Determine target week key for the habit date
  const [y, m, d] = targetDateISO.split('-').map(Number);
  const targetDateObj = new Date(y, m - 1, d);
  const targetWeekKey = getWeekKey(targetDateObj);

  if (!STATE.scheduleData[targetWeekKey]) {
    STATE.scheduleData[targetWeekKey] = {
      slots: {},
      habits: [],
      todos: [],
      notes: ''
    };
  }

  const targetWeekData = STATE.scheduleData[targetWeekKey];

  const newLog = {
    id: Date.now(),
    name,
    pts: pts || 5,
    time: timestampStr,
    notes: notes || ''
  };

  targetWeekData.habits.push(newLog);
  saveStateToStorage();
  
  // Re-render habit table if currently viewing the same week
  const currentWeekKey = getWeekKey(STATE.currentWeekStart);
  if (currentWeekKey === targetWeekKey) {
    renderHabits(habitLogTableBody, totalPointsBadge);
  }

  await ApiClient.logHabit(targetWeekKey, name, pts, notes, timestampStr);
}
