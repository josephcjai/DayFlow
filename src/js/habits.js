/**
 * DayFlow Habit Ledger Module
 * Supports date & time logging for past dates, robust row deletion, and Day/Week view filtering
 */
import { getCurrentWeekData, saveStateToStorage, getWeekKey, STATE, formatDateISO } from './state.js?v=2.3.1';
import { ApiClient } from './apiClient.js?v=2.3.1';
import { escapeHtml } from './utils.js?v=2.3.1';

export const DEFAULT_HABIT_PRESETS = [
  { id: 'p1', icon: '🍽️', name: 'Meal Logged', pts: 5, label: 'Log Meal & Cleaned Hands' },
  { id: 'p2', icon: '🛋️', name: 'Non-Working Hours Logged', pts: 10, label: 'Log Non-Working Hours' },
  { id: 'p3', icon: '🎯', name: 'Disciplined Focus Session', pts: 15, label: '2-Hour Deep Work Complete' },
  { id: 'p4', icon: '💻', name: 'Skill Practice Complete', pts: 10, label: 'WPF / WCF Coding Session' }
];

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
      btn.addEventListener('click', async () => {
        const rawId = btn.dataset.id;
        const numId = parseInt(rawId, 10);
        weekData.habits = weekData.habits.filter(h => String(h.id) !== String(rawId) && h.id !== numId);
        saveStateToStorage();
        renderHabits(habitLogTableBody, totalPointsBadge);
        await ApiClient.deleteHabit(rawId);
      });
    });
  }

  totalPointsBadge.textContent = `${totalPoints} Pts`;
}

export function renderQuickPresetsUI(container, habitLogTableBody, totalPointsBadge, getSelectedDateFn) {
  if (!container) return;
  const presets = getStoredPresets();
  container.innerHTML = '';

  presets.forEach(p => {
    const btnContainer = document.createElement('div');
    btnContainer.className = 'preset-btn-wrapper';
    btnContainer.innerHTML = `
      <button class="habit-btn" data-habit="${escapeHtml(p.name)}" data-pts="${p.pts}">
        <span class="icon">${p.icon || '⭐'}</span> ${escapeHtml(p.label || p.name)} <span class="pts">+${p.pts} pts</span>
      </button>
      <button class="remove-preset-badge" data-preset-id="${p.id}" title="Remove preset button">✕</button>
    `;

    btnContainer.querySelector('.habit-btn').addEventListener('click', () => {
      const selectedDate = getSelectedDateFn ? getSelectedDateFn() : formatDateISO(new Date());
      addHabitLog(p.name, p.pts, "Quick trigger action", habitLogTableBody, totalPointsBadge, selectedDate);
    });

    btnContainer.querySelector('.remove-preset-badge').addEventListener('click', (e) => {
      e.stopPropagation();
      const newPresets = getStoredPresets().filter(pr => pr.id !== p.id);
      saveStoredPresets(newPresets);
      renderQuickPresetsUI(container, habitLogTableBody, totalPointsBadge, getSelectedDateFn);
    });

    container.appendChild(btnContainer);
  });

  // Add Preset Button
  const addBtn = document.createElement('button');
  addBtn.className = 'btn btn-secondary add-preset-btn';
  addBtn.innerHTML = `<span>➕ Add Preset Action</span>`;
  addBtn.addEventListener('click', () => {
    const name = prompt("Enter quick action name (e.g. Morning Jog, Read 20 Mins):");
    if (!name) return;
    const ptsStr = prompt("Enter point value (e.g. 5, 10, 15):", "10");
    const pts = parseInt(ptsStr, 10) || 10;
    const icon = prompt("Enter an emoji icon (optional):", "⚡") || "⚡";

    const newPresets = getStoredPresets();
    newPresets.push({
      id: `p_${Date.now()}`,
      icon,
      name,
      pts,
      label: name
    });
    saveStoredPresets(newPresets);
    renderQuickPresetsUI(container, habitLogTableBody, totalPointsBadge, getSelectedDateFn);
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
