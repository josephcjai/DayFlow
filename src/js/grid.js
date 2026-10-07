/**
 * DayFlow Multi-View Schedule Grid Renderer
 * Supports Day View, Weekly View, and Monthly View modes
 */
import { STATE, getWeekDates, getCurrentWeekData, getWeekKey, formatDateISO, formatDateDisplay, formatDateDisplayShort, getSelectedSlotKeys, clearSelectedSlotKeys, addSelectedSlotKey, removeSelectedSlotKey, toggleSelectedSlotKey, isSlotMultiSelected, getCategoryColor, getCategoryIcon } from './state.js?v=2.9.27';
import { openTaskModal } from './modal.js?v=2.9.27';
import { escapeHtml } from './utils.js?v=2.9.27';
import { isSlotProductive } from './settings.js?v=2.9.27';

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

let hasAutoScrolledToNow = false;

export function resetGridAutoScroll() {
  hasAutoScrolledToNow = false;
}

let currentSlotTicker = null;
let tickerListenersAttached = false;

/**
 * Dynamically updates the current active slot (NOW pill & highlight) across
 * Week, Day, and Month views without re-rendering the full grid or resetting scroll.
 */
export function updateCurrentSlotIndicator() {
  const currentSlotKey = getCurrentSlotKey();

  // 1. Clear NOW highlighting from any slot cells that are no longer the current slot
  const activeCells = document.querySelectorAll('.slot-cell.current-active-slot');
  activeCells.forEach(cell => {
    if (cell.dataset.slotKey !== currentSlotKey) {
      cell.classList.remove('current-active-slot');

      // Remove .now-pill elements
      const nowPills = cell.querySelectorAll('.now-pill');
      nowPills.forEach(p => p.remove());

      // If this cell was an empty slot displaying the current-empty-content prompt, restore clean empty cell
      const emptyContent = cell.querySelector('.current-empty-content');
      if (emptyContent) {
        cell.innerHTML = '';
        cell.classList.add('empty');
      }
    }
  });

  // 2. Add NOW highlighting to the new current slot cell (if present in the current DOM view)
  const newActiveCell = document.querySelector(`.slot-cell[data-slot-key="${currentSlotKey}"]`);
  if (newActiveCell) {
    if (!newActiveCell.classList.contains('current-active-slot')) {
      newActiveCell.classList.add('current-active-slot');
    }

    // Ensure it has the NOW pill
    if (!newActiveCell.querySelector('.now-pill')) {
      const statusIndicator = newActiveCell.querySelector('.status-indicator');
      if (statusIndicator) {
        // Populated task cell: insert NOW badge at start of status indicator
        statusIndicator.insertAdjacentHTML('afterbegin', '<span class="now-pill">📍 NOW</span>');
      } else if (newActiveCell.classList.contains('empty') || !newActiveCell.querySelector('.slot-content')) {
        // Empty slot cell: display the current empty slot prompt
        newActiveCell.classList.add('empty');
        const isDayView = newActiveCell.classList.contains('day-view-cell');
        newActiveCell.innerHTML = `
          <div class="slot-content current-empty-content">
            <div class="now-badge-row"><span class="now-pill">📍 NOW</span></div>
            <div class="now-hint-text">${isDayView ? '+ Click to log task for current 30-min slot' : '+ Log current task'}</div>
          </div>
        `;
      }
    }
  }

  // 3. Update Month View if active (update TODAY badge on day rollover)
  const todayDateStr = formatDateISO(new Date());
  const activeTodayCells = document.querySelectorAll('.month-day-cell.today-cell');
  activeTodayCells.forEach(cell => {
    if (cell.dataset.date !== todayDateStr) {
      cell.classList.remove('today-cell');
      const tag = cell.querySelector('.today-tag');
      if (tag) tag.remove();
    }
  });
  const newTodayCell = document.querySelector(`.month-day-cell[data-date="${todayDateStr}"]`);
  if (newTodayCell && !newTodayCell.classList.contains('today-cell')) {
    newTodayCell.classList.add('today-cell');
    const dayNumEl = newTodayCell.querySelector('.month-day-num');
    if (dayNumEl && !dayNumEl.querySelector('.today-tag')) {
      dayNumEl.insertAdjacentHTML('beforeend', ' <span class="today-tag">TODAY</span>');
    }
  }
}

/**
 * Starts the live background interval to ensure the NOW indicator stays accurate
 * as time elapses, without requiring a manual page refresh.
 */
export function startCurrentSlotTicker() {
  if (!currentSlotTicker) {
    // Check every 10 seconds so the NOW indicator advances smoothly across 30-min marks
    currentSlotTicker = setInterval(() => {
      updateCurrentSlotIndicator();
    }, 10000);
  }

  if (!tickerListenersAttached && typeof document !== 'undefined') {
    tickerListenersAttached = true;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        updateCurrentSlotIndicator();
      }
    });
    window.addEventListener('focus', () => {
      updateCurrentSlotIndicator();
    });
  }
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
    startCurrentSlotTicker();
    return;
  }

  // Day or Week View Mode
  if (monthViewContainer) monthViewContainer.style.display = 'none';
  if (gridWrapper) gridWrapper.style.display = 'block';

  const scheduleTable = document.getElementById('scheduleTable');
  if (mode === 'day') {
    if (scheduleTable) scheduleTable.classList.add('day-view-mode');
    renderDayGridHeader(scheduleTableHeader);
    renderDayGridBody(scheduleTableBody);
  } else {
    if (scheduleTable) scheduleTable.classList.remove('day-view-mode');
    renderWeekGridHeader(scheduleTableHeader, onSwitchToDayView);
    renderWeekGridBody(scheduleTableBody);
  }

  // Ensure live slot ticker is running
  startCurrentSlotTicker();
}

let isNavPillScrolling = false;
let navPillScrollTimeout = null;

function renderGridScrollNav(dates) {
  const nav = document.getElementById('gridHorizontalScrollNav');
  const pillsBar = document.getElementById('gridDayPillsBar');
  const leftBtn = document.getElementById('gridScrollLeftBtn');
  const rightBtn = document.getElementById('gridScrollRightBtn');
  const fadeRight = document.getElementById('gridScrollFadeRight');
  const container = document.querySelector('.timeline-table-container');

  if (!nav || !pillsBar || !container) return;

  const mode = STATE.scheduleViewMode || 'week';
  if (mode !== 'week') {
    nav.style.display = 'none';
    if (fadeRight) fadeRight.style.display = 'none';
    return;
  }

  nav.style.display = '';
  if (fadeRight) fadeRight.style.display = '';

  const dayNamesShort = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  pillsBar.innerHTML = '';

  dates.forEach((dateStr, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'grid-day-pill' + (idx === 0 ? ' active' : '');
    const dayNum = dateStr.split('-')[2];
    btn.textContent = `${dayNamesShort[idx]} ${dayNum}`;
    btn.dataset.dayIndex = idx;
    btn.title = `Scroll to ${dayNamesShort[idx]} (${dateStr})`;

    btn.addEventListener('click', () => {
      const pills = pillsBar.querySelectorAll('.grid-day-pill');
      pills.forEach((p, i) => p.classList.toggle('active', i === idx));
      isNavPillScrolling = true;
      clearTimeout(navPillScrollTimeout);
      navPillScrollTimeout = setTimeout(() => { isNavPillScrolling = false; }, 500);

      const th = document.querySelector(`.schedule-table th.day-col[data-day="${idx + 1}"]`);
      if (th) {
        const timeCol = document.querySelector('.schedule-table th.time-col');
        const timeColWidth = timeCol ? timeCol.offsetWidth : 80;
        const targetLeft = Math.max(0, th.offsetLeft - timeColWidth);
        container.scrollTo({ left: targetLeft, behavior: 'smooth' });
      }
    });

    pillsBar.appendChild(btn);
  });

  if (leftBtn && !leftBtn.dataset.bound) {
    leftBtn.dataset.bound = 'true';
    leftBtn.addEventListener('click', () => {
      container.scrollBy({ left: -140, behavior: 'smooth' });
    });
  }

  if (rightBtn && !rightBtn.dataset.bound) {
    rightBtn.dataset.bound = 'true';
    rightBtn.addEventListener('click', () => {
      container.scrollBy({ left: 140, behavior: 'smooth' });
    });
  }

  if (!container.dataset.scrollNavBound) {
    container.dataset.scrollNavBound = 'true';
    container.addEventListener('scroll', () => {
      const scrollLeft = container.scrollLeft;
      const maxScroll = container.scrollWidth - container.clientWidth;

      if (fadeRight) {
        fadeRight.style.opacity = (scrollLeft >= maxScroll - 10) ? '0' : '1';
      }

      if (!isNavPillScrolling) {
        const ths = document.querySelectorAll('.schedule-table th.day-col');
        const timeCol = document.querySelector('.schedule-table th.time-col');
        const timeColWidth = timeCol ? timeCol.offsetWidth : 80;
        let activeIdx = 0;

        ths.forEach((th, i) => {
          if (th.offsetLeft - timeColWidth <= scrollLeft + 30) {
            activeIdx = i;
          }
        });

        const pills = pillsBar.querySelectorAll('.grid-day-pill');
        pills.forEach((p, i) => p.classList.toggle('active', i === activeIdx));
      }
    });
  }
}

function renderWeekGridHeader(headerEl, onSwitchToDayView) {
  if (!headerEl) return;
  const dates = getWeekDates(STATE.currentWeekStart);
  renderGridScrollNav(dates);
  const dayNames = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

  headerEl.innerHTML = `
    <tr>
      <th class="time-col">Time (30m)</th>
      ${dates.map((dStr, idx) => `
        <th class="day-col" data-day="${idx + 1}" data-date="${dStr}">
          <div class="day-col-header-wrap">
            <span class="day-col-title" style="cursor: pointer;" title="Click to view full day schedule">
              ${dayNames[idx]} <span class="day-date">${formatHeaderDate(dStr)}</span>
            </span>
            <button type="button" class="day-template-action-btn" data-date="${dStr}" title="Apply template to ${dayNames[idx]} (or save as template)" aria-label="Template for ${dayNames[idx]}">📋</button>
          </div>
        </th>
      `).join('')}
    </tr>
  `;

  if (onSwitchToDayView) {
    headerEl.querySelectorAll('.day-col[data-date] .day-col-title').forEach(titleSpan => {
      titleSpan.addEventListener('click', (e) => {
        e.stopPropagation();
        const th = titleSpan.closest('.day-col');
        if (th && th.dataset.date) onSwitchToDayView(th.dataset.date);
      });
    });
  }
}

function renderDayGridHeader(headerEl) {
  if (!headerEl) return;
  const nav = document.getElementById('gridHorizontalScrollNav');
  if (nav) nav.style.display = 'none';
  const fadeRight = document.getElementById('gridScrollFadeRight');
  if (fadeRight) fadeRight.style.display = 'none';

  const d = STATE.selectedDate || new Date();
  const dayName = d.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
  const dateStr = formatDateISO(d);
  
  headerEl.innerHTML = `
    <tr>
      <th class="time-col">Time (30m)</th>
      <th class="day-col day-view-single-col">
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 0 0.5rem; flex-wrap: wrap; gap: 0.5rem;">
          <div>
            ${dayName} <span class="day-date">${formatDateDisplay(dateStr)}</span>
          </div>
          <div class="day-view-template-actions">
            <button type="button" class="btn btn-secondary btn-sm day-view-apply-template-btn" data-date="${dateStr}" title="Apply a day template to this day">📋 Apply Template</button>
            <button type="button" class="btn btn-secondary btn-sm day-view-save-template-btn" data-date="${dateStr}" title="Save today's schedule as a new reusable template">💾 Save as Template</button>
          </div>
        </div>
      </th>
    </tr>
  `;
}

function renderWeekGridBody(scheduleTableBody) {
  if (!scheduleTableBody) return;
  const container = document.querySelector('.timeline-table-container');
  const prevScrollTop = container ? container.scrollTop : 0;
  const prevScrollLeft = container ? container.scrollLeft : 0;

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
      td.tabIndex = 0;
      td.dataset.slotKey = slotKey;
      td.dataset.dayName = getDayName(dayIdx);
      td.dataset.timeLabel = slotInfo.label;

      if (isCurrentSlot) {
        td.classList.add('current-active-slot');
        currentActiveTd = td;
      }
      if (STATE.selectedSlotKey === slotKey) {
        td.classList.add('selected-slot');
      }
      if (STATE.selectedSlotKeys && STATE.selectedSlotKeys.has(slotKey)) {
        td.classList.add('multi-selected-slot');
      }
      if (STATE.copiedSlotKey === slotKey) {
        td.classList.add('copied-source');
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
        const isProd = isSlotProductive(slotData);
        
        const plannedText = slotData.plannedTask || slotData.title || '';
        const actualText = slotData.actualTask || slotData.title || plannedText;
        const isDifferent = plannedText && actualText && (plannedText.toLowerCase() !== actualText.toLowerCase());

        td.innerHTML = `
          <div class="slot-content">
            <div class="slot-header-row">
              <span class="slot-title inline-editable" data-slot-key="${slotKey}" title="Click to edit task title | Double-click slot for full modal">
                ${escapeHtml(actualText)}
              </span>
              <span class="status-indicator">
                ${isCurrentSlot ? '<span class="now-pill">📍 NOW</span>' : ''}
                <button type="button" class="status-quick-btn status-btn-${escapeHtml((slotData.status || 'Pending').split(' ')[0])}" data-slot-key="${slotKey}" title="Status: ${escapeHtml(slotData.status || 'Pending')} (Click: Toggle Done | Right-Click: Status Menu | Alt+Click: Cycle)" aria-label="Status: ${escapeHtml(slotData.status || 'Pending')}">
                  <span class="status-btn-icon">${statusIcon}</span>
                </button>
              </span>
            </div>
            ${isDifferent ? `<div class="planned-subtext">Plan: ${escapeHtml(plannedText)}</div>` : ''}
            <div class="slot-footer-row">
              <span class="category-tag ${escapedCat}" style="background-color: ${getCategoryColor(catName)}; color: #ffffff;">${getCategoryIcon(catName) ? `${getCategoryIcon(catName)} ` : ''}${escapedCat}</span>
              ${isProd ? '<span class="slot-prod-icon" title="Marked as Productive (High-Impact Work)">⚡</span>' : ''}
              <span class="time-dur-badge">${slotData.planned || 30}m | <strong class="actual-time-badge inline-editable" data-slot-key="${slotKey}" title="Click to edit actual duration">${slotData.actual !== undefined ? slotData.actual : 0}m</strong></span>
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

      td.addEventListener('click', (e) => {
        if (e.target.closest('.status-quick-btn') || e.target.closest('.inline-editable') || e.target.closest('input')) {
          return;
        }
        if (e.ctrlKey || e.metaKey || e.shiftKey) {
          selectSlotCell(slotKey, td, e);
          return;
        }
        if (STATE.selectedSlotKeys && STATE.selectedSlotKeys.size > 1 && STATE.selectedSlotKeys.has(slotKey)) {
          selectSlotCell(slotKey, td, e);
          return;
        }
        if (STATE.selectedSlotKey === slotKey) {
          openTaskModal(slotKey, td.dataset.dayName, slotInfo.label, slotData);
        } else {
          selectSlotCell(slotKey, td, e);
        }
      });

      td.addEventListener('dblclick', (e) => {
        e.preventDefault();
        openTaskModal(slotKey, td.dataset.dayName, slotInfo.label, slotData);
      });
      tr.appendChild(td);
    }

    scheduleTableBody.appendChild(tr);
  });

  if (!hasAutoScrolledToNow && currentActiveTd) {
    setTimeout(() => {
      const c = document.querySelector('.timeline-table-container');
      if (c) {
        const tdTop = currentActiveTd.offsetTop;
        const containerHeight = c.clientHeight;
        c.scrollTo({ top: Math.max(0, tdTop - containerHeight / 2 + 40), behavior: 'smooth' });
        hasAutoScrolledToNow = true;
      }
    }, 150);
  } else if (container) {
    container.scrollTop = prevScrollTop;
    container.scrollLeft = prevScrollLeft;
  }
}

function renderDayGridBody(scheduleTableBody) {
  if (!scheduleTableBody) return;
  const container = document.querySelector('.timeline-table-container');
  const prevScrollTop = container ? container.scrollTop : 0;
  const prevScrollLeft = container ? container.scrollLeft : 0;

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
    td.tabIndex = 0;
    td.dataset.slotKey = slotKey;
    td.dataset.dayName = dayName;
    td.dataset.timeLabel = slotInfo.label;

    if (isCurrentSlot) {
      td.classList.add('current-active-slot');
      currentActiveTd = td;
    }
    if (STATE.selectedSlotKey === slotKey) {
      td.classList.add('selected-slot');
    }
    if (STATE.selectedSlotKeys && STATE.selectedSlotKeys.has(slotKey)) {
      td.classList.add('multi-selected-slot');
    }
    if (STATE.copiedSlotKey === slotKey) {
      td.classList.add('copied-source');
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
      const isProd = isSlotProductive(slotData);

      td.innerHTML = `
        <div class="slot-content day-view-content">
          <div class="slot-header-row">
            <span class="slot-title lg-title inline-editable" data-slot-key="${slotKey}" title="Click to edit task title | Double-click slot for full modal">
              ${escapeHtml(actualText)}
            </span>
            <span class="status-indicator">
              ${isCurrentSlot ? '<span class="now-pill">📍 NOW</span>' : ''}
              <button type="button" class="status-quick-btn status-btn-${escapeHtml((slotData.status || 'Pending').split(' ')[0])}" data-slot-key="${slotKey}" title="Status: ${escapeHtml(slotData.status || 'Pending')} (Click: Toggle Done | Right-Click: Status Menu | Alt+Click: Cycle)" aria-label="Status: ${escapeHtml(slotData.status || 'Pending')}">
                <span class="status-btn-icon">${statusIcon}</span>
                <span class="status-name">${escapeHtml(slotData.status || 'Pending')}</span>
              </button>
            </span>
          </div>
          ${plannedText && plannedText !== actualText ? `<div class="planned-subtext">Baseline Plan: ${escapeHtml(plannedText)}</div>` : ''}
          ${slotData.notes ? `<div class="slot-notes-preview">📝 ${escapeHtml(slotData.notes)}</div>` : ''}
          <div class="slot-footer-row">
            <span class="category-tag ${escapedCat}" style="background-color: ${getCategoryColor(catName)}; color: #ffffff;">${getCategoryIcon(catName) ? `${getCategoryIcon(catName)} ` : ''}${escapedCat}</span>
            ${isProd ? '<span class="slot-prod-icon" title="Marked as Productive (High-Impact Work)">⚡</span>' : ''}
            <span class="time-dur-badge">Planned: ${slotData.planned || 30}m | <strong class="actual-time-badge inline-editable" data-slot-key="${slotKey}" title="Click to edit actual duration">Actual: ${slotData.actual !== undefined ? slotData.actual : 0}m</strong></span>
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

    td.addEventListener('click', (e) => {
      if (e.target.closest('.status-quick-btn') || e.target.closest('.inline-editable') || e.target.closest('input')) {
        return;
      }
      if (e.ctrlKey || e.metaKey || e.shiftKey) {
        selectSlotCell(slotKey, td, e);
        return;
      }
      if (STATE.selectedSlotKeys && STATE.selectedSlotKeys.size > 1 && STATE.selectedSlotKeys.has(slotKey)) {
        selectSlotCell(slotKey, td, e);
        return;
      }
      if (STATE.selectedSlotKey === slotKey) {
        openTaskModal(slotKey, dayName, slotInfo.label, slotData);
      } else {
        selectSlotCell(slotKey, td, e);
      }
    });

    td.addEventListener('dblclick', (e) => {
      e.preventDefault();
      openTaskModal(slotKey, dayName, slotInfo.label, slotData);
    });
    tr.appendChild(td);
    scheduleTableBody.appendChild(tr);
  });

  if (!hasAutoScrolledToNow && currentActiveTd) {
    setTimeout(() => {
      const c = document.querySelector('.timeline-table-container');
      if (c) {
        const tdTop = currentActiveTd.offsetTop;
        const containerHeight = c.clientHeight;
        c.scrollTo({ top: Math.max(0, tdTop - containerHeight / 2 + 40), behavior: 'smooth' });
        hasAutoScrolledToNow = true;
      }
    }, 150);
  } else if (container) {
    container.scrollTop = prevScrollTop;
    container.scrollLeft = prevScrollLeft;
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
        <div title="Monday"><span class="day-full">MON</span><span class="day-short">M</span></div>
        <div title="Tuesday"><span class="day-full">TUE</span><span class="day-short">T</span></div>
        <div title="Wednesday"><span class="day-full">WED</span><span class="day-short">W</span></div>
        <div title="Thursday"><span class="day-full">THU</span><span class="day-short">T</span></div>
        <div title="Friday"><span class="day-full">FRI</span><span class="day-short">F</span></div>
        <div title="Saturday"><span class="day-full">SAT</span><span class="day-short">S</span></div>
        <div title="Sunday"><span class="day-full">SUN</span><span class="day-short">S</span></div>
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

    const dWeekKey = getWeekKey(dObj);
    const dWeekData = STATE.scheduleData[dWeekKey] || weekData;

    Object.keys(dWeekData.slots || {}).forEach(sKey => {
      if (sKey.startsWith(dateStr)) {
        const s = dWeekData.slots[sKey];
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
            <div class="month-metric-badge" title="${taskCount} Tasks"><span class="badge-icon">🎯</span> <span class="badge-full">${taskCount} Tasks</span><span class="badge-mini">${taskCount}t</span></div>
            <div class="month-metric-badge actual" title="${hoursLogged} hrs logged"><span class="badge-icon">⏱️</span> <span class="badge-full">${hoursLogged} hrs</span><span class="badge-mini">${hoursLogged}h</span></div>
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
  return formatDateDisplayShort(isoDateStr);
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

export function syncMultiSelectedClasses() {
  document.querySelectorAll('.slot-cell').forEach(el => {
    const k = el.dataset.slotKey;
    if (k && STATE.selectedSlotKeys && STATE.selectedSlotKeys.has(k)) {
      el.classList.add('multi-selected-slot');
    } else {
      el.classList.remove('multi-selected-slot');
    }
  });
}

export function updateBulkActionBar() {
  const bar = document.getElementById('bulkActionBar');
  if (!bar) return;

  const count = STATE.selectedSlotKeys ? STATE.selectedSlotKeys.size : 0;
  if (count >= 2) {
    bar.style.display = 'flex';
    const countEl = document.getElementById('bulkSelectedCount');
    if (countEl) countEl.textContent = count;

    const durEl = document.getElementById('bulkSelectedDuration');
    if (durEl) {
      const totalMinutes = count * 30;
      if (totalMinutes >= 60) {
        const hrs = Math.floor(totalMinutes / 60);
        const mins = totalMinutes % 60;
        durEl.textContent = mins > 0 ? `(${hrs}h ${mins}m)` : `(${hrs}h)`;
      } else {
        durEl.textContent = `(${totalMinutes}m)`;
      }
    }
  } else {
    bar.style.display = 'none';
    const catMenu = document.getElementById('bulkCategoryMenu');
    if (catMenu) catMenu.style.display = 'none';
  }
}

export function getRangeSlotKeys(startKey, endKey) {
  if (!startKey || !endKey) return startKey ? [startKey] : (endKey ? [endKey] : []);
  if (startKey === endKey) return [startKey];

  const [startDateStr, startTimeKey] = startKey.split('_');
  const [endDateStr, endTimeKey] = endKey.split('_');

  const startTimeIdx = TIME_SLOTS.findIndex(s => s.key === startTimeKey);
  const endTimeIdx = TIME_SLOTS.findIndex(s => s.key === endTimeKey);

  if (startTimeIdx === -1 || endTimeIdx === -1) {
    return [startKey, endKey];
  }

  const minTimeIdx = Math.min(startTimeIdx, endTimeIdx);
  const maxTimeIdx = Math.max(startTimeIdx, endTimeIdx);

  const mode = STATE.scheduleViewMode || 'week';
  const rangeKeys = [];

  if (mode === 'day' || startDateStr === endDateStr) {
    for (let t = minTimeIdx; t <= maxTimeIdx; t++) {
      rangeKeys.push(`${startDateStr}_${TIME_SLOTS[t].key}`);
    }
  } else {
    const weekDates = getWeekDates(STATE.currentWeekStart);
    const startDayIdx = weekDates.indexOf(startDateStr);
    const endDayIdx = weekDates.indexOf(endDateStr);

    if (startDayIdx !== -1 && endDayIdx !== -1) {
      const minDayIdx = Math.min(startDayIdx, endDayIdx);
      const maxDayIdx = Math.max(startDayIdx, endDayIdx);

      for (let d = minDayIdx; d <= maxDayIdx; d++) {
        for (let t = minTimeIdx; t <= maxTimeIdx; t++) {
          rangeKeys.push(`${weekDates[d]}_${TIME_SLOTS[t].key}`);
        }
      }
    } else {
      rangeKeys.push(startKey, endKey);
    }
  }

  return rangeKeys;
}

export function selectSlotCell(slotKey, cellElement = null, event = null) {
  if (!STATE.selectedSlotKeys) {
    STATE.selectedSlotKeys = new Set();
  }

  const isCtrl = event && (event.ctrlKey || event.metaKey);
  const isShift = event && event.shiftKey;

  if (isCtrl) {
    if (STATE.selectedSlotKeys.size === 0 && STATE.selectedSlotKey && STATE.selectedSlotKey !== slotKey) {
      STATE.selectedSlotKeys.add(STATE.selectedSlotKey);
    }

    if (STATE.selectedSlotKeys.has(slotKey)) {
      STATE.selectedSlotKeys.delete(slotKey);
      if (STATE.selectedSlotKey === slotKey) {
        STATE.selectedSlotKey = Array.from(STATE.selectedSlotKeys).pop() || null;
      }
    } else {
      STATE.selectedSlotKeys.add(slotKey);
      STATE.selectedSlotKey = slotKey;
    }

    syncMultiSelectedClasses();
    updateBulkActionBar();
    return;
  }

  if (isShift) {
    const anchorKey = STATE.selectedSlotKey || slotKey;
    const rangeKeys = getRangeSlotKeys(anchorKey, slotKey);

    rangeKeys.forEach(k => STATE.selectedSlotKeys.add(k));
    STATE.selectedSlotKey = slotKey;

    syncMultiSelectedClasses();
    updateBulkActionBar();
    return;
  }

  STATE.selectedSlotKeys.clear();
  STATE.selectedSlotKey = slotKey;

  document.querySelectorAll('.slot-cell.selected-slot').forEach(el => el.classList.remove('selected-slot'));
  document.querySelectorAll('.slot-cell.multi-selected-slot').forEach(el => el.classList.remove('multi-selected-slot'));

  const target = cellElement || document.querySelector(`.slot-cell[data-slot-key="${slotKey}"]`);
  if (target) {
    target.classList.add('selected-slot');
    target.focus({ preventScroll: true });
  }

  updateBulkActionBar();
}

export function clearSlotSelection() {
  STATE.selectedSlotKey = null;
  STATE.copiedSlotKey = null;
  if (STATE.selectedSlotKeys) {
    STATE.selectedSlotKeys.clear();
  }
  document.querySelectorAll('.slot-cell.selected-slot').forEach(el => el.classList.remove('selected-slot'));
  document.querySelectorAll('.slot-cell.multi-selected-slot').forEach(el => el.classList.remove('multi-selected-slot'));
  document.querySelectorAll('.slot-cell.copied-source').forEach(el => el.classList.remove('copied-source'));
  updateBulkActionBar();
}

export function clearCopiedSource() {
  STATE.copiedSlotKey = null;
  document.querySelectorAll('.slot-cell.copied-source').forEach(el => el.classList.remove('copied-source'));
}

export function getAdjacentSlotKey(currentSlotKey, direction) {
  if (!currentSlotKey) return null;
  const parts = currentSlotKey.split('_');
  if (parts.length < 2) return null;
  const dateStr = parts[0];
  const timeKey = parts[1];

  const timeIdx = TIME_SLOTS.findIndex(s => s.key === timeKey);
  if (timeIdx === -1) return null;

  const mode = STATE.scheduleViewMode || 'week';

  if (direction === 'up') {
    if (timeIdx > 0) {
      return `${dateStr}_${TIME_SLOTS[timeIdx - 1].key}`;
    }
    return null;
  }

  if (direction === 'down') {
    if (timeIdx < TIME_SLOTS.length - 1) {
      return `${dateStr}_${TIME_SLOTS[timeIdx + 1].key}`;
    }
    return null;
  }

  if (mode === 'day') {
    const [y, m, d] = dateStr.split('-').map(Number);
    const curr = new Date(y, m - 1, d);
    if (direction === 'left') {
      curr.setDate(curr.getDate() - 1);
      return `${formatDateISO(curr)}_${timeKey}`;
    }
    if (direction === 'right') {
      curr.setDate(curr.getDate() + 1);
      return `${formatDateISO(curr)}_${timeKey}`;
    }
    return null;
  }

  // Week view
  const dates = getWeekDates(STATE.currentWeekStart);
  const dayIdx = dates.indexOf(dateStr);
  if (dayIdx === -1) return null;

  if (direction === 'left') {
    if (dayIdx > 0) {
      return `${dates[dayIdx - 1]}_${timeKey}`;
    }
    return null;
  }

  if (direction === 'right') {
    if (dayIdx < dates.length - 1) {
      return `${dates[dayIdx + 1]}_${timeKey}`;
    }
    return null;
  }

  return null;
}

