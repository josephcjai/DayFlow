/**
 * DayFlow Habit Ledger Module
 */
import { getCurrentWeekData, saveStateToStorage } from './state.js';

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
        <td><span style="color: ${log.pts >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)'}; font-weight:700;">${log.pts >= 0 ? '+' : ''}${log.pts} pts</span></td>
        <td>${escapeHtml(log.notes || '-')}</td>
        <td><button class="btn btn-sm btn-danger delete-habit-btn" data-id="${log.id}">Remove</button></td>
      `;
      habitLogTableBody.appendChild(tr);
    });
  }

  totalPointsBadge.textContent = `Total Score: ${totalPoints} pts`;

  habitLogTableBody.querySelectorAll('.delete-habit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const logId = parseInt(btn.dataset.id, 10);
      weekData.habits = weekData.habits.filter(h => h.id !== logId);
      saveStateToStorage();
      renderHabits(habitLogTableBody, totalPointsBadge);
    });
  });
}

export function addHabitLog(name, pts, notes, habitLogTableBody, totalPointsBadge) {
  const weekData = getCurrentWeekData();
  const now = new Date();
  weekData.habits.push({
    id: Date.now(),
    name,
    pts,
    time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    notes
  });
  saveStateToStorage();
  renderHabits(habitLogTableBody, totalPointsBadge);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
