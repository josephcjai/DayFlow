/**
 * DayFlow Habit Ledger Module
 */
import { getCurrentWeekData, saveStateToStorage, getWeekKey, STATE } from './state.js';
import { ApiClient } from './apiClient.js';
import { escapeHtml } from './utils.js';

export function renderHabits(habitLogTableBody, totalPointsBadge) {
  const weekData = getCurrentWeekData();
  habitLogTableBody.innerHTML = '';

  let totalPoints = 0;
  const habits = weekData.habits || [];

  if (habits.length === 0) {
    habitLogTableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color: var(--text-muted);">No habit logs recorded for this week yet. Click quick actions above!</td></tr>`;
  } else {
    habits.slice().reverse().forEach((log) => {
      totalPoints += (log.pts || 0);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(log.time)}</td>
        <td><strong>${escapeHtml(log.name)}</strong></td>
        <td><span class="pts-badge">+${log.pts} pts</span></td>
        <td>${escapeHtml(log.notes || '—')}</td>
        <td><button class="delete-habit-btn" data-id="${log.id}">✕</button></td>
      `;
      habitLogTableBody.appendChild(tr);
    });

    habitLogTableBody.querySelectorAll('.delete-habit-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = parseInt(btn.dataset.id, 10);
        weekData.habits = weekData.habits.filter(h => h.id !== id);
        saveStateToStorage();
        renderHabits(habitLogTableBody, totalPointsBadge);
        await ApiClient.deleteHabit(id);
      });
    });
  }

  totalPointsBadge.textContent = `${totalPoints} Pts`;
}

export async function addHabitLog(name, pts, notes, habitLogTableBody, totalPointsBadge) {
  const weekKey = getWeekKey(STATE.currentWeekStart);
  const weekData = getCurrentWeekData();
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const newLog = {
    id: Date.now(),
    name,
    pts: pts || 5,
    time: timeStr,
    notes: notes || ''
  };

  weekData.habits.push(newLog);
  saveStateToStorage();
  renderHabits(habitLogTableBody, totalPointsBadge);

  await ApiClient.logHabit(weekKey, name, pts, notes);
}
