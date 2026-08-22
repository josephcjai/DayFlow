/**
 * DayFlow Multi-View Schedule Grid Renderer
 * Supports Day View, Weekly View, and Monthly View modes
 */
import { STATE, getWeekDates, getCurrentWeekData, formatDateISO } from './state.js?v=2.5.5';
import { openTaskModal } from './modal.js?v=2.5.5';
import { escapeHtml } from './utils.js?v=2.5.5';

export const TIME_SLOTS = [];

export function generateTimeSlots(startHour = 0, endHour = 23, timeFormat = '12h') {
  TIME_SLOTS.length = 0;
  const start = Math.max(0, Math.min(23, parseInt(startHour, 10) || 0));
  const end = Math.max(start, Math.min(23, parseInt(endHour, 10) || 23));

  for (let hour = start; hour <= end; hour++) {
    for (let min = 0; min < 60; min += 30) {
      const hStr = String(hour).padStart(2, '0');
      const mStr = String(min).padStart(2, '0');
      const label = formatTimeLabel(hour, min, timeFormat);
      TIME_SLOTS.push({ key: `${hStr}:${mStr}`, hour, min, label });
    }
  }
  return TIME_SLOTS;
}

// Initialize Full 24 Hours default: 00:00 to 23:30 (48 half-hour slots)
generateTimeSlots(0, 23, '12h');

export function getCurrentSlotKey() {
  const now = new Date();
  const dateStr = formatDateISO(now);
  const hour = String(now.getHours()).padStart(2, '0');
  const slotMin = now.getMinutes() < 30 ? '00' : '30';
  return `${dateStr}_${hour}:${slotMin}`;
}

export function renderGrid(scheduleTableBody, onSwitchToDayView) {
  const gridWrapper = document.getElementById('gridWrapper');
  const monthViewContainer = document.getElementById('monthViewContainer');
  const scheduleTableHeader = document.getElementById('scheduleTableHeader') || document.querySelector('#scheduleTable thead');

  const mode = STATE.scheduleViewMode || 'week';

  if (mode === 'month') {
    if (gridWrapper) gridWrapper.style.display = 'none';
    if (monthViewContainer) {
      monthViewContainer.style.display = 'block';
      renderMonthGrid(monthViewContainer, onSwitchToDayView);
    }
    return;
  }

  // Day or Week View Mode
  if (monthViewContainer) monthViewContainer.style.display = 'none';
  if (gridWrapper) gridWrapper.style.display = 'block';

  if (mode === 'day') {
    renderDayGridHeader(scheduleTableHeader);
    renderDayGridBody(scheduleTableBody);
  } else {
    renderWeekGridHeader(scheduleTableHeader);
    renderWeekGridBody(scheduleTableBody);
  }
}

function renderWeekGridHeader(headerEl) {
  if (!headerEl) return;
  const dates = getWeekDates(STATE.currentWeekStart);
  headerEl.innerHTML = `
    <tr>
      <th class="time-col">Time (30m)</th>
      <th class="day-col" data-day="1">MON <span class="day-date">${formatHeaderDate(dates[0])}</span></th>
      <th class="day-col" data-day="2">TUE <span class="day-date">${formatHeaderDate(dates[1])}</span></th>
      <th class="day-col" data-day="3">WED <span class="day-date">${formatHeaderDate(dates[2])}</span></th>
      <th class="day-col" data-day="4">THU <span class="day-date">${formatHeaderDate(dates[3])}</span></th>
      <th class="day-col" data-day="5">FRI <span class="day-date">${formatHeaderDate(dates[4])}</span></th>
      <th class="day-col" data-day="6">SAT <span class="day-date">${formatHeaderDate(dates[5])}</span></th>
      <th class="day-col" data-day="7">SUN <span class="day-date">${formatHeaderDate(dates[6])}</span></th>
    </tr>
  `;
}

function renderDayGridHeader(headerEl) {
  if (!headerEl) return;
  const d = STATE.selectedDate || new Date();
  const dayName = d.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
  const dateStr = formatDateISO(d);
  
  headerEl.innerHTML = `
    <tr>
      <th class="time-col">Time (30m)</th>
      <th class="day-col day-view-single-col">${dayName} <span class="day-date">${formatHeaderDate(dateStr)}</span></th>
    </tr>
  `;
}

function renderWeekGridBody(scheduleTableBody) {
  if (!scheduleTableBody) return;
  const weekData = getCurrentWeekData();
  const dates = getWeekDates(STATE.currentWeekStart);
  const currentSlotKey = getCurrentSlotKey();
  let currentActiveTd = null;

  scheduleTableBody.innerHTML = '';

  TIME_SLOTS.forEach(slotInfo => {
    const tr = document.createElement('tr');

    const timeTd = document.createElement('td');
    timeTd.className = 'time-cell';
    timeTd.textContent = slotInfo.label;
    tr.appendChild(timeTd);

    for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
      const dateStr = dates[dayIdx];
      const slotKey = `${dateStr}_${slotInfo.key}`;
      const slotData = weekData.slots[slotKey];
      const isCurrentSlot = (slotKey === currentSlotKey);

      const td = document.createElement('td');
      td.className = 'slot-cell';
      td.dataset.slotKey = slotKey;
      td.dataset.dayName = getDayName(dayIdx);
      td.dataset.timeLabel = slotInfo.label;

      if (isCurrentSlot) {
        td.classList.add('current-active-slot');
        currentActiveTd = td;
      }

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
        const escapedCat = escapeHtml(catName);
        
        const plannedText = slotData.plannedTask || slotData.title || '';
        const actualText = slotData.actualTask || slotData.title || plannedText;
        const isDifferent = plannedText && actualText && (plannedText.toLowerCase() !== actualText.toLowerCase());

        td.innerHTML = `
          <div class="slot-content">
            <div class="slot-header-row">
              <span class="slot-title" title="Actual: ${escapeHtml(actualText)} | Planned: ${escapeHtml(plannedText)}">
                ${escapeHtml(actualText)}
              </span>
              <span class="status-indicator">
                ${isCurrentSlot ? '<span class="now-pill">📍 NOW</span>' : ''}
                ${statusIcon}
              </span>
            </div>
            ${isDifferent ? `<div class="planned-subtext">Plan: ${escapeHtml(plannedText)}</div>` : ''}
            <div class="slot-footer-row">
              <span class="category-tag ${escapedCat}">${escapedCat}</span>
              <span class="time-dur-badge">${slotData.planned || 30}m | <strong>${slotData.actual || 0}m</strong></span>
            </div>
          </div>
        `;
      } else {
        td.classList.add('empty');
        if (isCurrentSlot) {
          td.innerHTML = `
            <div class="slot-content current-empty-content">
              <div class="now-badge-row"><span class="now-pill">📍 NOW</span></div>
              <div class="now-hint-text">+ Log current task</div>
            </div>
          `;
        }
      }

      td.addEventListener('click', () => openTaskModal(slotKey, td.dataset.dayName, slotInfo.label, slotData));
      tr.appendChild(td);
    }

    scheduleTableBody.appendChild(tr);
  });

  if (currentActiveTd) {
    setTimeout(() => {
      const container = document.querySelector('.timeline-table-container');
      if (container) {
        const tdTop = currentActiveTd.offsetTop;
        const containerHeight = container.clientHeight;
        container.scrollTo({ top: Math.max(0, tdTop - containerHeight / 2 + 40), behavior: 'smooth' });
      }
    }, 150);
  }
}

function renderDayGridBody(scheduleTableBody) {
  if (!scheduleTableBody) return;
  const weekData = getCurrentWeekData();
  const d = STATE.selectedDate || new Date();
  const dateStr = formatDateISO(d);
  const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
  const currentSlotKey = getCurrentSlotKey();
  let currentActiveTd = null;

  scheduleTableBody.innerHTML = '';

  TIME_SLOTS.forEach(slotInfo => {
    const tr = document.createElement('tr');

    const timeTd = document.createElement('td');
    timeTd.className = 'time-cell';
    timeTd.textContent = slotInfo.label;
    tr.appendChild(timeTd);

    const slotKey = `${dateStr}_${slotInfo.key}`;
    const slotData = weekData.slots[slotKey];
    const isCurrentSlot = (slotKey === currentSlotKey);

    const td = document.createElement('td');
    td.className = 'slot-cell day-view-cell';
    td.dataset.slotKey = slotKey;
    td.dataset.dayName = dayName;
    td.dataset.timeLabel = slotInfo.label;

    if (isCurrentSlot) {
      td.classList.add('current-active-slot');
      currentActiveTd = td;
    }

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
      const escapedCat = escapeHtml(catName);
      const plannedText = slotData.plannedTask || slotData.title || '';
      const actualText = slotData.actualTask || slotData.title || plannedText;

      td.innerHTML = `
        <div class="slot-content day-view-content">
          <div class="slot-header-row">
            <span class="slot-title lg-title">
              ${escapeHtml(actualText)}
            </span>
            <span class="status-indicator">
              ${isCurrentSlot ? '<span class="now-pill">📍 NOW</span>' : ''}
              ${statusIcon} <span class="status-name">${slotData.status || 'Pending'}</span>
            </span>
          </div>
          ${plannedText && plannedText !== actualText ? `<div class="planned-subtext">Baseline Plan: ${escapeHtml(plannedText)}</div>` : ''}
          ${slotData.notes ? `<div class="slot-notes-preview">📝 ${escapeHtml(slotData.notes)}</div>` : ''}
          <div class="slot-footer-row">
            <span class="category-tag ${escapedCat}">${escapedCat}</span>
            <span class="time-dur-badge">Planned: ${slotData.planned || 30}m | <strong>Actual: ${slotData.actual || 0}m</strong></span>
          </div>
        </div>
      `;
    } else {
      td.classList.add('empty');
      if (isCurrentSlot) {
        td.innerHTML = `
          <div class="slot-content current-empty-content">
            <div class="now-badge-row"><span class="now-pill">📍 NOW</span></div>
            <div class="now-hint-text">+ Click to log task for current 30-min slot</div>
          </div>
        `;
      }
    }

    td.addEventListener('click', () => openTaskModal(slotKey, dayName, slotInfo.label, slotData));
    tr.appendChild(td);
    scheduleTableBody.appendChild(tr);
  });

  if (currentActiveTd) {
    setTimeout(() => {
      const container = document.querySelector('.timeline-table-container');
      if (container) {
        const tdTop = currentActiveTd.offsetTop;
        const containerHeight = container.clientHeight;
        container.scrollTo({ top: Math.max(0, tdTop - containerHeight / 2 + 40), behavior: 'smooth' });
      }
    }, 150);
  }
}

function renderMonthGrid(container, onSwitchToDayView) {
  if (!container) return;
  const currentDate = STATE.selectedDate || new Date();
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  let startDayOfWeek = firstDay.getDay() - 1; // Mon = 0
  if (startDayOfWeek === -1) startDayOfWeek = 6; // Sun = 6

  const daysInMonth = lastDay.getDate();
  const weekData = getCurrentWeekData();
  const todayISO = formatDateISO(new Date());

  let html = `
    <div class="month-grid-wrapper">
      <div class="month-header-bar">
        <h3>${escapeHtml(monthName)}</h3>
        <span class="month-subtitle">Click any day card to open Day View</span>
      </div>
      <div class="month-days-header">
        <div>MON</div><div>TUE</div><div>WED</div><div>THU</div><div>FRI</div><div>SAT</div><div>SUN</div>
      </div>
      <div class="month-days-matrix">
  `;

  // Lead-in empty days
  for (let i = 0; i < startDayOfWeek; i++) {
    html += `<div class="month-day-cell pad"></div>`;
  }

  // Days of month
  for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
    const dObj = new Date(year, month, dayNum);
    const dateStr = formatDateISO(dObj);
    const isToday = (dateStr === todayISO);

    let actualMins = 0;
    let taskCount = 0;

    Object.keys(weekData.slots || {}).forEach(sKey => {
      if (sKey.startsWith(dateStr)) {
        const s = weekData.slots[sKey];
        if (s && (s.plannedTask || s.actualTask)) {
          taskCount++;
          actualMins += parseInt(s.actual || 0, 10);
        }
      }
    });

    const hoursLogged = (actualMins / 60).toFixed(1);

    html += `
      <div class="month-day-cell ${isToday ? 'today-cell' : ''}" data-date="${dateStr}">
        <div class="month-day-num">${dayNum} ${isToday ? '<span class="today-tag">TODAY</span>' : ''}</div>
        <div class="month-day-body">
          ${taskCount > 0 ? `
            <div class="month-metric-badge">🎯 ${taskCount} Tasks</div>
            <div class="month-metric-badge actual">⏱️ ${hoursLogged} hrs</div>
          ` : `
            <div class="month-empty-text">No tasks</div>
          `}
        </div>
      </div>
    `;
  }

  html += `
      </div>
    </div>
  `;

  container.innerHTML = html;

  container.querySelectorAll('.month-day-cell[data-date]').forEach(cell => {
    cell.addEventListener('click', () => {
      const targetDate = cell.dataset.date;
      if (targetDate && onSwitchToDayView) {
        onSwitchToDayView(targetDate);
      }
    });
  });
}

function formatHeaderDate(isoDateStr) {
  if (!isoDateStr) return '';
  const parts = isoDateStr.split('-');
  return `${parseInt(parts[1], 10)}/${parseInt(parts[2], 10)}`;
}

export function formatTimeLabel(hour, min, timeFormat = '12h') {
  const displayMin = String(min).padStart(2, '0');
  if (timeFormat === '24h') {
    return `${String(hour).padStart(2, '0')}:${displayMin}`;
  }
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
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
