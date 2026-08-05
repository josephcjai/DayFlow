/**
 * DayFlow Schedule Grid Renderer
 */
import { STATE, getWeekDates, getCurrentWeekData } from './state.js';
import { openTaskModal } from './modal.js';

export const TIME_SLOTS = [];
for (let hour = 4; hour <= 23; hour++) {
  for (let min = 0; min < 60; min += 30) {
    if (hour === 23 && min > 0) break;
    const hStr = String(hour).padStart(2, '0');
    const mStr = String(min).padStart(2, '0');
    const label = formatTimeLabel(hour, min);
    TIME_SLOTS.push({ key: `${hStr}:${mStr}`, hour, min, label });
  }
}

export function renderGrid(scheduleTableBody) {
  const weekData = getCurrentWeekData();
  const dates = getWeekDates(STATE.currentWeekStart);
  scheduleTableBody.innerHTML = '';

  TIME_SLOTS.forEach(slotInfo => {
    const tr = document.createElement('tr');

    // Time Label Cell
    const timeTd = document.createElement('td');
    timeTd.className = 'time-cell';
    timeTd.textContent = slotInfo.label;
    tr.appendChild(timeTd);

    // Days 1-7 (Mon to Sun)
    for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
      const dateStr = dates[dayIdx];
      const slotKey = `${dateStr}_${slotInfo.key}`;
      const slotData = weekData.slots[slotKey];

      const td = document.createElement('td');
      td.className = 'slot-cell';
      td.dataset.slotKey = slotKey;
      td.dataset.dayName = getDayName(dayIdx);
      td.dataset.timeLabel = slotInfo.label;

      let isFilteredOut = false;
      if (STATE.selectedCategoryFilter !== 'ALL' && slotData) {
        if (slotData.category !== STATE.selectedCategoryFilter) {
          isFilteredOut = true;
        }
      }

      if (slotData && !isFilteredOut) {
        td.classList.add(`status-${(slotData.status || 'Pending').split(' ')[0]}`);

        const statusIcon = getStatusIcon(slotData.status);
        const catName = slotData.category || 'General';
        
        // Display Planned Task & Actual Task
        const plannedText = slotData.plannedTask || slotData.title || '';
        const actualText = slotData.actualTask || slotData.title || plannedText;
        const isDifferent = plannedText && actualText && (plannedText.toLowerCase() !== actualText.toLowerCase());

        td.innerHTML = `
          <div class="slot-content">
            <div class="slot-header-row">
              <span class="slot-title" title="Actual: ${escapeHtml(actualText)} | Planned: ${escapeHtml(plannedText)}">
                ${escapeHtml(actualText)}
              </span>
              <span class="status-indicator">${statusIcon}</span>
            </div>
            ${isDifferent ? `<div class="planned-subtext">Plan: ${escapeHtml(plannedText)}</div>` : ''}
            <div class="slot-footer-row">
              <span class="category-tag ${catName}">${catName}</span>
              <span class="time-dur-badge">${slotData.planned || 30}m | <strong>${slotData.actual || 0}m</strong></span>
            </div>
          </div>
        `;
      } else {
        td.classList.add('empty');
      }

      td.addEventListener('click', () => openTaskModal(slotKey, td.dataset.dayName, slotInfo.label, slotData));
      tr.appendChild(td);
    }

    scheduleTableBody.appendChild(tr);
  });
}

function formatTimeLabel(hour, min) {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  const displayMin = String(min).padStart(2, '0');
  return `${String(displayHour).padStart(2, '0')}:${displayMin} ${period}`;
}

function getDayName(dayIdx) {
  const names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  return names[dayIdx] || '';
}

function getStatusIcon(status) {
  switch (status) {
    case 'Done': return '✅';
    case 'Partially Done': return '🟡';
    case 'Not Done': return '❌';
    default: return '⚪';
  }
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
