/**
 * DayFlow Notes & Todo Checklist Controller
 * Supports:
 * 1. Priority Badges (High / Medium / Low)
 * 2. Focus Category Badges
 * 3. Dynamic Filter Pills (All / High / Medium / Low / Pending / Done)
 * 4. 1-Click "Schedule to Grid" Timeblocking (Single & Multi-Day Span)
 * 5. Time Slot Conflict Detection, Warning Modal, & Auto-Find Next Free Slot
 * 6. Cascade Clear / Keep Scheduled Slots on Todo Deletion
 * 7. Per-user & per-week PostgreSQL persistence
 */
import { getCurrentWeekData, saveStateToStorage, getWeekDates, getWeekKey, getMonday, STATE, formatDateISO, formatDateDisplay, formatDateDisplayShort } from './state.js?v=2.6.3';
import { ApiClient } from './apiClient.js?v=2.6.3';
import { escapeHtml } from './utils.js?v=2.6.3';
import { TIME_SLOTS } from './grid.js?v=2.6.3';
import { parseMarkdown } from './markdown.js?v=2.6.3';

let activeTodoFilter = 'all';
let todoModalsInitialized = false;
let pendingDeleteTodo = null;
let activeSchedulingTodo = null;
let gridUpdateCallback = null;

// Multi-Day Timeblock State
let currentScheduleMode = 'single'; // 'single' | 'multi'
let multiSpanDays = 20;
let multiDayPattern = 'all'; // 'all' | 'weekdays' | 'weekends'
let activeMultiDays = new Set();

// Conflict Pending State
let pendingSingleConflict = null;

export function getActiveTodoFilter() {
  return activeTodoFilter;
}

export function setTodoFilter(filter) {
  activeTodoFilter = filter;
}

let dayScopeFilter = 'day'; // 'day' | 'week'

export function getDayScopeFilter() {
  return dayScopeFilter;
}

export function setDayScopeFilter(scope) {
  dayScopeFilter = scope;
}

export function getSlotConflict(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  const monKey = getWeekKey(getMonday(new Date(y, m - 1, d)));
  const week = STATE.scheduleData ? STATE.scheduleData[monKey] : null;
  if (!week || !week.slots) return null;

  const slotKey = `${dateStr}_${timeStr}`;
  const slot = week.slots[slotKey];
  if (!slot) return null;

  const hasPlanned = slot.plannedTask && slot.plannedTask.trim().length > 0;
  const hasActual = slot.actualTask && slot.actualTask.trim().length > 0;

  if (hasPlanned || hasActual) {
    return {
      isConflict: true,
      slotKey,
      dateStr,
      timeStr,
      task: slot.plannedTask || slot.actualTask,
      category: slot.category || 'General',
      slot
    };
  }
  return null;
}

export function findNextFreeSlot(dateStr, preferredTimeStr) {
  const currentIndex = TIME_SLOTS.findIndex(s => s.key === preferredTimeStr);
  const startIndex = currentIndex >= 0 ? currentIndex + 1 : 0;

  // Search forward
  for (let i = startIndex; i < TIME_SLOTS.length; i++) {
    const timeKey = TIME_SLOTS[i].key;
    if (!getSlotConflict(dateStr, timeKey)) {
      return timeKey;
    }
  }

  // Search from beginning if needed
  for (let i = 0; i < startIndex; i++) {
    const timeKey = TIME_SLOTS[i].key;
    if (!getSlotConflict(dateStr, timeKey)) {
      return timeKey;
    }
  }

  return null;
}

export function getScheduledSlotsForTodo(todoText) {
  if (!todoText || !STATE.scheduleData) return [];
  const normalized = todoText.trim().toLowerCase();
  const matchedSlots = [];

  Object.entries(STATE.scheduleData).forEach(([weekKey, weekData]) => {
    if (weekData && weekData.slots) {
      Object.entries(weekData.slots).forEach(([slotKey, slot]) => {
        if (slot && slot.plannedTask && slot.plannedTask.trim().toLowerCase() === normalized) {
          const [dateStr, timeStr] = slotKey.split('_');
          const dObj = new Date(dateStr + 'T00:00:00');
          const dayName = dObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
          const [h, m] = timeStr.split(':').map(Number);
          const ampm = h >= 12 ? 'PM' : 'AM';
          const h12 = h % 12 === 0 ? 12 : h % 12;
          const timeLabel = `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;

          matchedSlots.push({
            weekKey,
            slotKey,
            dateStr,
            timeStr,
            display: `${dayName} @ ${timeLabel}`
          });
        }
      });
    }
  });

  // Sort ascending by date and time
  matchedSlots.sort((a, b) => {
    if (a.dateStr !== b.dateStr) {
      return a.dateStr.localeCompare(b.dateStr);
    }
    return a.timeStr.localeCompare(b.timeStr);
  });

  return matchedSlots;
}

export function initTodoFilterBar(filterBarContainer, todoList, weeklyNotesTextarea) {
  if (!filterBarContainer) return;
  const pills = filterBarContainer.querySelectorAll('.todo-filter-pill');
  pills.forEach(pill => {
    pill.addEventListener('click', () => {
      pills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      activeTodoFilter = pill.dataset.filter || 'all';
      renderNotes(todoList, weeklyNotesTextarea, gridUpdateCallback);
    });
  });

  const dayFocusPill = filterBarContainer.querySelector('#todoDayFocusPill');
  const weekBacklogPill = filterBarContainer.querySelector('#todoWeekBacklogPill');
  if (dayFocusPill) {
    dayFocusPill.addEventListener('click', () => {
      dayScopeFilter = 'day';
      if (weekBacklogPill) weekBacklogPill.classList.remove('active');
      dayFocusPill.classList.add('active');
      renderNotes(todoList, weeklyNotesTextarea, gridUpdateCallback);
    });
  }
  if (weekBacklogPill) {
    weekBacklogPill.addEventListener('click', () => {
      dayScopeFilter = 'week';
      if (dayFocusPill) dayFocusPill.classList.remove('active');
      weekBacklogPill.classList.add('active');
      renderNotes(todoList, weeklyNotesTextarea, gridUpdateCallback);
    });
  }
}

function initDeleteTodoModal(todoList, weeklyNotesTextarea) {
  const deleteTodoModal = document.getElementById('deleteTodoConfirmModal');
  const cancelDeleteTodoBtn = document.getElementById('cancelDeleteTodoBtn');
  const confirmDeleteTodoBtn = document.getElementById('confirmDeleteTodoBtn');

  const standardSubdesc = document.getElementById('deleteTodoStandardSubdesc');
  const slotsWarningBox = document.getElementById('deleteTodoSlotsWarning');
  const standardActions = document.getElementById('deleteTodoStandardActions');
  const cascadeActions = document.getElementById('deleteTodoCascadeActions');

  const confirmDeleteAndClearSlotsBtn = document.getElementById('confirmDeleteAndClearSlotsBtn');
  const confirmDeleteOnlyGoalBtn = document.getElementById('confirmDeleteOnlyGoalBtn');
  const cancelDeleteTodoCascadeBtn = document.getElementById('cancelDeleteTodoCascadeBtn');

  const closeDeleteModal = () => {
    if (deleteTodoModal) deleteTodoModal.classList.remove('active');
    pendingDeleteTodo = null;
  };

  if (cancelDeleteTodoBtn) cancelDeleteTodoBtn.addEventListener('click', closeDeleteModal);
  if (cancelDeleteTodoCascadeBtn) cancelDeleteTodoCascadeBtn.addEventListener('click', closeDeleteModal);

  if (deleteTodoModal) {
    deleteTodoModal.addEventListener('click', (e) => {
      if (e.target === deleteTodoModal) closeDeleteModal();
    });
  }

  // Standard Delete & Keep Slots Delete Handler
  const executeTodoOnlyDelete = async () => {
    if (!pendingDeleteTodo) {
      closeDeleteModal();
      return;
    }
    const weekData = getCurrentWeekData();
    const targetId = pendingDeleteTodo.id;
    const targetNumId = pendingDeleteTodo.numId;

    weekData.todos = (weekData.todos || []).filter(t => String(t.id) !== String(targetId) && t.id !== targetNumId);
    saveStateToStorage();
    closeDeleteModal();
    renderNotes(todoList, weeklyNotesTextarea, gridUpdateCallback);
    await ApiClient.deleteTodo(targetId);
  };

  if (confirmDeleteTodoBtn) confirmDeleteTodoBtn.addEventListener('click', executeTodoOnlyDelete);
  if (confirmDeleteOnlyGoalBtn) confirmDeleteOnlyGoalBtn.addEventListener('click', executeTodoOnlyDelete);

  // Cascade Delete: Removes Todo AND Clears Scheduled Grid Slots
  if (confirmDeleteAndClearSlotsBtn) {
    confirmDeleteAndClearSlotsBtn.addEventListener('click', async () => {
      if (!pendingDeleteTodo) {
        closeDeleteModal();
        return;
      }
      const weekData = getCurrentWeekData();
      const targetId = pendingDeleteTodo.id;
      const targetNumId = pendingDeleteTodo.numId;
      const scheduledSlots = pendingDeleteTodo.scheduledSlots || [];

      // 1. Clear scheduled slots from all week data and delete from database
      for (const slotRef of scheduledSlots) {
        if (STATE.scheduleData && STATE.scheduleData[slotRef.weekKey] && STATE.scheduleData[slotRef.weekKey].slots) {
          delete STATE.scheduleData[slotRef.weekKey].slots[slotRef.slotKey];
        }
        // Completely delete the slot row from PostgreSQL
        await ApiClient.deleteSlot(slotRef.weekKey, slotRef.slotKey);
      }

      // 2. Remove Todo item
      weekData.todos = (weekData.todos || []).filter(t => String(t.id) !== String(targetId) && t.id !== targetNumId);
      saveStateToStorage();
      closeDeleteModal();

      renderNotes(todoList, weeklyNotesTextarea, gridUpdateCallback);
      if (gridUpdateCallback) gridUpdateCallback();

      await ApiClient.deleteTodo(targetId);
    });
  }
}

function initConflictModal(todoList, weeklyNotesTextarea, onGridUpdated) {
  const modal = document.getElementById('scheduleConflictModal');
  const cancelBtn = document.getElementById('cancelConflictBtn');
  const autoResolveBtn = document.getElementById('autoResolveNextSlotBtn');
  const overwriteBtn = document.getElementById('overwriteConflictBtn');

  const closeConflictModal = () => {
    if (modal) modal.classList.remove('active');
    pendingSingleConflict = null;
  };

  if (cancelBtn) cancelBtn.addEventListener('click', closeConflictModal);
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeConflictModal();
    });
  }

  if (autoResolveBtn) {
    autoResolveBtn.addEventListener('click', async () => {
      if (!pendingSingleConflict) {
        closeConflictModal();
        return;
      }
      const { targetDate, startTime, durationMins, chosenCategory } = pendingSingleConflict;
      const nextFreeTime = findNextFreeSlot(targetDate, startTime);

      if (!nextFreeTime) {
        alert(`No free time slots available on ${targetDate}. Please pick another day.`);
        closeConflictModal();
        return;
      }

      closeConflictModal();
      await executeSingleSlotSchedule(targetDate, nextFreeTime, durationMins, chosenCategory, todoList, weeklyNotesTextarea, onGridUpdated);
    });
  }

  if (overwriteBtn) {
    overwriteBtn.addEventListener('click', async () => {
      if (!pendingSingleConflict) {
        closeConflictModal();
        return;
      }
      const { targetDate, startTime, durationMins, chosenCategory } = pendingSingleConflict;
      closeConflictModal();
      await executeSingleSlotSchedule(targetDate, startTime, durationMins, chosenCategory, todoList, weeklyNotesTextarea, onGridUpdated);
    });
  }
}

async function executeSingleSlotSchedule(targetDate, startTime, durationMins, chosenCategory, todoList, weeklyNotesTextarea, onGridUpdated) {
  const [y, m, d] = targetDate.split('-').map(Number);
  const monKey = getWeekKey(getMonday(new Date(y, m - 1, d)));

  if (!STATE.scheduleData[monKey]) {
    STATE.scheduleData[monKey] = { slots: {}, habits: [], todos: [], notes: '' };
  }
  if (!STATE.scheduleData[monKey].slots) {
    STATE.scheduleData[monKey].slots = {};
  }

  const slotKey = `${targetDate}_${startTime}`;
  const slotData = {
    plannedTask: activeSchedulingTodo.text,
    actualTask: '',
    category: chosenCategory,
    planned: durationMins,
    actual: 0,
    status: 'Planned',
    notes: `Scheduled from Priority Checklist: ${activeSchedulingTodo.priority || 'Medium'} Priority`
  };

  STATE.scheduleData[monKey].slots[slotKey] = slotData;

  activeSchedulingTodo.scheduledSlot = slotKey;
  activeSchedulingTodo.scheduledDate = targetDate;
  activeSchedulingTodo.scheduledTime = startTime;
  delete activeSchedulingTodo.scheduledSlotInfo;

  saveStateToStorage();
  const scheduleModal = document.getElementById('scheduleTodoModal');
  if (scheduleModal) scheduleModal.classList.remove('active');

  renderNotes(todoList, weeklyNotesTextarea, onGridUpdated);
  if (onGridUpdated) onGridUpdated();
  await ApiClient.saveSlot(monKey, slotKey, slotData);
}

function updateMultiDayChipsUI(startDate, chipsContainer, summaryEl, submitBtn, selectedStartTime) {
  if (!chipsContainer) return;
  chipsContainer.innerHTML = '';
  activeMultiDays.clear();

  const dayNamesShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const generatedDates = [];
  const timeToCheck = selectedStartTime || document.getElementById('scheduleTodoTimeSelect')?.value || '09:00';

  for (let i = 0; i < multiSpanDays; i++) {
    const curDate = new Date(startDate.getTime());
    curDate.setDate(curDate.getDate() + i);
    const dateStr = formatDateISO(curDate);
    const dayOfWeek = curDate.getDay();

    let shouldInclude = true;
    if (multiDayPattern === 'weekdays') {
      shouldInclude = (dayOfWeek >= 1 && dayOfWeek <= 5);
    } else if (multiDayPattern === 'weekends') {
      shouldInclude = (dayOfWeek === 0 || dayOfWeek === 6);
    }

    if (shouldInclude) {
      activeMultiDays.add(dateStr);
    }

    const conflict = getSlotConflict(dateStr, timeToCheck);

    generatedDates.push({
      dateStr,
      dayName: dayNamesShort[dayOfWeek],
      dateDisplay: formatDateDisplayShort(curDate),
      isWeekend: (dayOfWeek === 0 || dayOfWeek === 6),
      conflict
    });
  }

  const conflictBanner = document.getElementById('multiDayConflictBanner');
  const conflictText = document.getElementById('multiDayConflictText');
  const skipConflictBtn = document.getElementById('skipAllConflictedDaysBtn');

  const updateSummaryText = () => {
    const selectedCount = activeMultiDays.size;
    const skippedCount = multiSpanDays - selectedCount;

    // Count conflicts among active selections
    let activeConflictsCount = 0;
    generatedDates.forEach(d => {
      if (activeMultiDays.has(d.dateStr) && d.conflict) {
        activeConflictsCount++;
      }
    });

    if (summaryEl) {
      summaryEl.textContent = `${selectedCount} of ${multiSpanDays} days selected (${skippedCount} skipped)`;
      if (selectedCount === 0) {
        summaryEl.style.color = '#f87171';
        summaryEl.style.borderColor = 'rgba(239, 68, 68, 0.4)';
      } else {
        summaryEl.style.color = '#34d399';
        summaryEl.style.borderColor = 'rgba(16, 185, 129, 0.3)';
      }
    }

    if (conflictBanner && conflictText) {
      if (activeConflictsCount > 0 && currentScheduleMode === 'multi') {
        conflictBanner.style.display = 'flex';
        conflictText.textContent = `${activeConflictsCount} selected day(s) have conflicting tasks at ${timeToCheck}`;
      } else {
        conflictBanner.style.display = 'none';
      }
    }

    if (submitBtn) {
      submitBtn.textContent = currentScheduleMode === 'multi'
        ? `📅 Schedule into ${selectedCount} Selected Days`
        : `📅 Place into Schedule Grid`;
    }
  };

  if (skipConflictBtn) {
    skipConflictBtn.onclick = () => {
      generatedDates.forEach(d => {
        if (d.conflict && activeMultiDays.has(d.dateStr)) {
          activeMultiDays.delete(d.dateStr);
        }
      });
      const chips = chipsContainer.querySelectorAll('.day-chip');
      chips.forEach(chip => {
        const dStr = chip.dataset.date;
        if (!activeMultiDays.has(dStr)) {
          chip.classList.remove('active');
          chip.classList.add('skipped');
        }
      });
      updateSummaryText();
    };
  }

  generatedDates.forEach(d => {
    const chip = document.createElement('div');
    const isSelected = activeMultiDays.has(d.dateStr);
    const hasConflictClass = d.conflict ? 'has-conflict' : '';
    chip.className = `day-chip ${isSelected ? 'active' : 'skipped'} ${hasConflictClass}`;
    chip.dataset.date = d.dateStr;

    const conflictTitle = d.conflict ? `⚠️ Occupied by: "${d.conflict.task}" (${d.conflict.category})` : '';
    if (conflictTitle) chip.title = conflictTitle;

    chip.innerHTML = `
      <span class="day-chip-name">${d.dayName}</span>
      <span class="day-chip-date">${d.conflict ? '⚠️ ' : ''}${d.dateDisplay}</span>
    `;

    chip.addEventListener('click', () => {
      if (activeMultiDays.has(d.dateStr)) {
        activeMultiDays.delete(d.dateStr);
        chip.classList.remove('active');
        chip.classList.add('skipped');
      } else {
        activeMultiDays.add(d.dateStr);
        chip.classList.remove('skipped');
        chip.classList.add('active');
      }
      updateSummaryText();
    });

    chipsContainer.appendChild(chip);
  });

  updateSummaryText();
}

function initScheduleTodoModal(todoList, weeklyNotesTextarea, onGridUpdated) {
  const modal = document.getElementById('scheduleTodoModal');
  const closeBtn = document.getElementById('closeScheduleTodoModalBtn');
  const cancelBtn = document.getElementById('cancelScheduleTodoBtn');
  const form = document.getElementById('scheduleTodoForm');
  const submitBtn = document.getElementById('confirmScheduleTodoBtn');

  const modeSingleBtn = document.getElementById('scheduleModeSingleBtn');
  const modeMultiBtn = document.getElementById('scheduleModeMultiBtn');
  const singleContainer = document.getElementById('singleDayScheduleContainer');
  const multiContainer = document.getElementById('multiDayScheduleContainer');

  const dateSelect = document.getElementById('scheduleTodoDateSelect');
  const timeSelect = document.getElementById('scheduleTodoTimeSelect');
  const durationSelect = document.getElementById('scheduleTodoDurationSelect');
  const categorySelect = document.getElementById('scheduleTodoCategorySelect');

  const chipsContainer = document.getElementById('scheduleMultiDayChipsContainer');
  const summaryEl = document.getElementById('scheduleMultiDaySummary');

  const spanPillBtns = document.querySelectorAll('.span-pill-btn');
  const patternPillBtns = document.querySelectorAll('.pattern-pill-btn');

  const closeModal = () => {
    if (modal) modal.classList.remove('active');
    activeSchedulingTodo = null;
  };

  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }

  // When start time changes, re-evaluate conflicts in multi-day view
  if (timeSelect) {
    timeSelect.addEventListener('change', () => {
      if (currentScheduleMode === 'multi') {
        const startDate = STATE.selectedDate || new Date();
        updateMultiDayChipsUI(startDate, chipsContainer, summaryEl, submitBtn, timeSelect.value);
      }
    });
  }

  // Mode Switcher handlers
  if (modeSingleBtn && modeMultiBtn) {
    modeSingleBtn.addEventListener('click', () => {
      currentScheduleMode = 'single';
      modeSingleBtn.classList.add('active');
      modeMultiBtn.classList.remove('active');
      if (singleContainer) singleContainer.style.display = 'block';
      if (multiContainer) multiContainer.style.display = 'none';
      if (submitBtn) submitBtn.textContent = '📅 Place into Schedule Grid';
    });

    modeMultiBtn.addEventListener('click', () => {
      currentScheduleMode = 'multi';
      modeMultiBtn.classList.add('active');
      modeSingleBtn.classList.remove('active');
      if (singleContainer) singleContainer.style.display = 'none';
      if (multiContainer) multiContainer.style.display = 'block';
      const startDate = STATE.selectedDate || new Date();
      updateMultiDayChipsUI(startDate, chipsContainer, summaryEl, submitBtn, timeSelect?.value);
    });
  }

  // Span selector buttons (7, 14, 20, 30 days)
  spanPillBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      spanPillBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      multiSpanDays = parseInt(btn.dataset.span, 10) || 20;
      const startDate = STATE.selectedDate || new Date();
      updateMultiDayChipsUI(startDate, chipsContainer, summaryEl, submitBtn, timeSelect?.value);
    });
  });

  // Pattern filter buttons (All, Weekdays, Weekends)
  patternPillBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      patternPillBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      multiDayPattern = btn.dataset.pattern || 'all';
      const startDate = STATE.selectedDate || new Date();
      updateMultiDayChipsUI(startDate, chipsContainer, summaryEl, submitBtn, timeSelect?.value);
    });
  });

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!activeSchedulingTodo) {
        closeModal();
        return;
      }

      const startTime = timeSelect.value;
      const durationMins = parseInt(durationSelect.value, 10) || 30;
      const chosenCategory = categorySelect.value || 'General';

      if (currentScheduleMode === 'single') {
        const targetDate = dateSelect.value;
        const conflict = getSlotConflict(targetDate, startTime);

        if (conflict) {
          pendingSingleConflict = { targetDate, startTime, durationMins, chosenCategory, conflict };
          const conflictModal = document.getElementById('scheduleConflictModal');
          const conflictDayTimeEl = document.getElementById('conflictSlotDayTime');
          const conflictExistingTextEl = document.getElementById('conflictExistingTaskText');
          const conflictExistingCatEl = document.getElementById('conflictExistingCategoryBadge');
          const conflictIncomingTextEl = document.getElementById('conflictIncomingTaskText');
          const conflictIncomingCatEl = document.getElementById('conflictIncomingCategoryBadge');

          const dObj = new Date(targetDate + 'T00:00:00');
          const dayName = dObj.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
          const [h, m] = startTime.split(':').map(Number);
          const ampm = h >= 12 ? 'PM' : 'AM';
          const h12 = h % 12 === 0 ? 12 : h % 12;
          const timeLabel = `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;

          if (conflictDayTimeEl) conflictDayTimeEl.textContent = `${dayName} at ${timeLabel}`;
          if (conflictExistingTextEl) conflictExistingTextEl.textContent = conflict.task;
          if (conflictExistingCatEl) conflictExistingCatEl.textContent = conflict.category;
          if (conflictIncomingTextEl) conflictIncomingTextEl.textContent = activeSchedulingTodo.text;
          if (conflictIncomingCatEl) conflictIncomingCatEl.textContent = chosenCategory;

          if (conflictModal) conflictModal.classList.add('active');
          return;
        }

        await executeSingleSlotSchedule(targetDate, startTime, durationMins, chosenCategory, todoList, weeklyNotesTextarea, onGridUpdated);

      } else {
        // Multi-Day Range Scheduling
        if (activeMultiDays.size === 0) {
          alert('Please select at least one day to schedule this task.');
          return;
        }

        const datesArray = Array.from(activeMultiDays).sort();
        const firstDate = datesArray[0];
        const lastDate = datesArray[datesArray.length - 1];

        const d1 = formatDateDisplayShort(firstDate);
        const d2 = formatDateDisplayShort(lastDate);

        const slotDataTemplate = {
          plannedTask: activeSchedulingTodo.text,
          actualTask: '',
          category: chosenCategory,
          planned: durationMins,
          actual: 0,
          status: 'Planned',
          notes: `Multi-Day Timeblock (${datesArray.length} days): ${activeSchedulingTodo.priority || 'Medium'} Priority`
        };

        // Create slots across all weeks
        for (const dateStr of datesArray) {
          const [y, m, d] = dateStr.split('-').map(Number);
          const monKey = getWeekKey(getMonday(new Date(y, m - 1, d)));

          if (!STATE.scheduleData[monKey]) {
            STATE.scheduleData[monKey] = { slots: {}, habits: [], todos: [], notes: '' };
          }
          if (!STATE.scheduleData[monKey].slots) {
            STATE.scheduleData[monKey].slots = {};
          }

          const slotKey = `${dateStr}_${startTime}`;
          STATE.scheduleData[monKey].slots[slotKey] = { ...slotDataTemplate };

          // Persist each slot in background
          ApiClient.saveSlot(monKey, slotKey, STATE.scheduleData[monKey].slots[slotKey]);
        }

        activeSchedulingTodo.scheduledSlotInfo = {
          count: datesArray.length,
          time: startTime,
          span: `${d1} – ${d2}`
        };
        activeSchedulingTodo.scheduledDate = firstDate;
        activeSchedulingTodo.scheduledTime = startTime;

        saveStateToStorage();
        closeModal();
        renderNotes(todoList, weeklyNotesTextarea, onGridUpdated);

        if (onGridUpdated) onGridUpdated();
      }
    });
  }
}

function openScheduleTodoModal(todo) {
  activeSchedulingTodo = todo;
  const modal = document.getElementById('scheduleTodoModal');
  const taskTextEl = document.getElementById('scheduleTodoTaskText');
  const priorityBadgeEl = document.getElementById('scheduleTodoPriorityBadge');
  const categoryBadgeEl = document.getElementById('scheduleTodoCategoryBadge');
  const dateSelect = document.getElementById('scheduleTodoDateSelect');
  const timeSelect = document.getElementById('scheduleTodoTimeSelect');
  const categorySelect = document.getElementById('scheduleTodoCategorySelect');
  const chipsContainer = document.getElementById('scheduleMultiDayChipsContainer');
  const summaryEl = document.getElementById('scheduleMultiDaySummary');
  const submitBtn = document.getElementById('confirmScheduleTodoBtn');

  if (taskTextEl) taskTextEl.textContent = todo.text;
  if (priorityBadgeEl) {
    priorityBadgeEl.className = `priority-badge priority-${(todo.priority || 'Medium').toLowerCase()}`;
    priorityBadgeEl.textContent = `${todo.priority === 'High' ? '🔴 High' : (todo.priority === 'Low' ? '🟢 Low' : '🟡 Med')}`;
  }
  if (categoryBadgeEl) {
    categoryBadgeEl.textContent = todo.category || 'General';
  }
  if (categorySelect) {
    categorySelect.value = todo.category || 'General';
  }

  // Populate Single-Day Dates of the active week
  if (dateSelect) {
    dateSelect.innerHTML = '';
    const weekDates = getWeekDates(STATE.currentWeekStart);
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const todayStr = formatDateISO(new Date());

    const targetDateStr = (todo && todo.dueDate) ? todo.dueDate : (todo && todo.scheduledDate ? todo.scheduledDate : todayStr);
    let targetSelected = false;

    weekDates.forEach((dStr, idx) => {
      const dateDisplay = formatDateDisplayShort(dStr);
      const opt = document.createElement('option');
      opt.value = dStr;
      opt.textContent = `${dayNames[idx]}, ${dateDisplay} ${dStr === todayStr ? ' (Today)' : ''}`;
      if (dStr === targetDateStr) {
        opt.selected = true;
        targetSelected = true;
      }
      dateSelect.appendChild(opt);
    });

    if (!targetSelected && todo && todo.dueDate) {
      const [ty, tm, td] = todo.dueDate.split('-').map(Number);
      const targetObj = new Date(ty, tm - 1, td);
      const dayName = targetObj.toLocaleDateString('en-US', { weekday: 'long' });
      const targetDisplay = formatDateDisplay(todo.dueDate);
      const opt = document.createElement('option');
      opt.value = todo.dueDate;
      opt.textContent = `${dayName}, ${targetDisplay} (Due Date)`;
      opt.selected = true;
      dateSelect.prepend(opt);
    }
  }

  // Populate 30-min Time Slots
  if (timeSelect) {
    timeSelect.innerHTML = '';
    TIME_SLOTS.forEach(slot => {
      const opt = document.createElement('option');
      opt.value = slot.key;
      opt.textContent = `${slot.key} (${slot.label})`;
      if (todo.scheduledTime === slot.key || (!todo.scheduledTime && slot.key === '09:00')) {
        opt.selected = true;
      }
      timeSelect.appendChild(opt);
    });
  }

  // Initialize Multi-Day Chips
  const startDate = STATE.selectedDate || new Date();
  const selectedTime = timeSelect ? timeSelect.value : '09:00';
  updateMultiDayChipsUI(startDate, chipsContainer, summaryEl, submitBtn, selectedTime);

  if (modal) modal.classList.add('active');
}

function getPriorityBadgeHtml(priority) {
  const p = (priority || 'Medium').toLowerCase();
  if (p === 'high') {
    return `<span class="priority-badge priority-high" title="High Priority">🔴 High</span>`;
  }
  if (p === 'low') {
    return `<span class="priority-badge priority-low" title="Low Priority">🟢 Low</span>`;
  }
  return `<span class="priority-badge priority-medium" title="Medium Priority">🟡 Med</span>`;
}

function getDueDateBadgeHtml(dueDate, isCompleted) {
  if (!dueDate || typeof dueDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    return '';
  }

  const todayStr = formatDateISO(new Date());
  const tom = new Date();
  tom.setDate(tom.getDate() + 1);
  const tomorrowStr = formatDateISO(tom);

  const dayDisplay = formatDateDisplay(dueDate);

  if (dueDate < todayStr && !isCompleted) {
    return `<span class="todo-due-badge todo-due-overdue" title="Overdue (Target was ${dayDisplay})">🔴 Overdue (${dayDisplay})</span>`;
  }
  if (dueDate === todayStr) {
    return `<span class="todo-due-badge todo-due-today" title="Due Today (${dayDisplay})">🟢 Due Today</span>`;
  }
  if (dueDate === tomorrowStr) {
    return `<span class="todo-due-badge todo-due-tomorrow" title="Due Tomorrow (${dayDisplay})">🟡 Due Tomorrow</span>`;
  }
  return `<span class="todo-due-badge todo-due-future" title="Target Due Date: ${dayDisplay}">📅 Due ${dayDisplay}</span>`;
}

function findScheduledSlotForTodo(item, weekSlots) {
  if (item.scheduledSlotInfo) {
    return `${item.scheduledSlotInfo.count} Days (${item.scheduledSlotInfo.span}) @ ${item.scheduledSlotInfo.time}`;
  }
  if (!weekSlots || !item.text) return null;
  const match = Object.entries(weekSlots).find(([k, slot]) => slot.plannedTask && slot.plannedTask.trim() === item.text.trim());
  if (!match) return null;
  const [slotKey] = match;
  const [dateStr, timeStr] = slotKey.split('_');
  const dObj = new Date(dateStr + 'T00:00:00');
  const dayAbbr = dObj.toLocaleDateString('en-US', { weekday: 'short' });
  const dateFormatted = formatDateDisplayShort(dateStr);
  return `${dayAbbr}, ${dateFormatted} @ ${timeStr}`;
}

export function updateTodoProgressBar(todos) {
  const countEl = document.getElementById('todoProgressCountText');
  const fillEl = document.getElementById('todoProgressBarFill');
  const celebrationEl = document.getElementById('todoProgressCelebration');

  const list = todos || [];
  const total = list.length;
  const completed = list.filter(t => !!t.completed).length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  if (countEl) {
    countEl.textContent = `${completed} of ${total} Completed (${pct}%)`;
    if (pct === 100 && total > 0) {
      countEl.style.color = '#34d399';
      countEl.style.borderColor = 'rgba(16, 185, 129, 0.4)';
    } else {
      countEl.style.color = 'var(--accent-primary)';
      countEl.style.borderColor = 'rgba(99, 102, 241, 0.3)';
    }
  }

  if (fillEl) {
    fillEl.style.width = `${pct}%`;
  }

  if (celebrationEl) {
    celebrationEl.style.display = (total > 0 && completed === total) ? 'block' : 'none';
  }
}

export function renderNotes(todoList, weeklyNotesTextarea, onGridUpdated) {
  if (!todoList) return;
  gridUpdateCallback = onGridUpdated;

  if (!todoModalsInitialized) {
    todoModalsInitialized = true;
    initDeleteTodoModal(todoList, weeklyNotesTextarea);
    initConflictModal(todoList, weeklyNotesTextarea, onGridUpdated);
    initScheduleTodoModal(todoList, weeklyNotesTextarea, onGridUpdated);
  }

  const weekData = getCurrentWeekData();
  todoList.innerHTML = '';

  const allTodos = weekData.todos || [];

  // Manage Day Scope Bar visibility and filtering
  const isDayView = STATE.scheduleViewMode === 'day';
  const dayScopeContainer = document.getElementById('todoDayScopeContainer');
  const dayFocusPill = document.getElementById('todoDayFocusPill');
  const weekBacklogPill = document.getElementById('todoWeekBacklogPill');
  if (dayScopeContainer) {
    dayScopeContainer.style.display = isDayView ? 'inline-flex' : 'none';
    if (dayFocusPill && weekBacklogPill) {
      dayFocusPill.classList.toggle('active', dayScopeFilter === 'day');
      weekBacklogPill.classList.toggle('active', dayScopeFilter === 'week');
    }
  }

  const activeDayStr = STATE.selectedDate ? formatDateISO(STATE.selectedDate) : formatDateISO(new Date());

  // Filter based on day view scope
  const scopedTodos = allTodos.filter(item => {
    if (isDayView && dayScopeFilter === 'day') {
      if (item.dueDate) {
        if (item.dueDate === activeDayStr) return true;
        if (item.dueDate < activeDayStr && !item.completed) return true;
        return false;
      }
      return false; // Day Focus concentrates on active day commitments + overdue
    }
    return true; // Full week backlog
  });

  updateTodoProgressBar(scopedTodos);

  // Filter based on active filter pill
  const filteredTodos = scopedTodos.filter(item => {
    if (activeTodoFilter === 'all') return true;
    if (activeTodoFilter === 'pending') return !item.completed;
    if (activeTodoFilter === 'completed') return !!item.completed;
    return (item.priority || 'Medium').toLowerCase() === activeTodoFilter.toLowerCase();
  });

  if (filteredTodos.length === 0) {
    let emptyMsg = allTodos.length === 0
      ? 'No priorities added for this week yet.'
      : `No items matching '${activeTodoFilter}' filter.`;
    if (isDayView && dayScopeFilter === 'day' && allTodos.length > 0) {
      emptyMsg = `No items due on this day (${activeDayStr}). Click 'All Week' to view weekly backlog.`;
    }
    todoList.innerHTML = `<li style="color: var(--text-muted); text-align: center; padding: 1.25rem; font-size: 0.85rem; border: 1px dashed var(--border-color); border-radius: var(--radius-md);">${emptyMsg}</li>`;
  } else {
    filteredTodos.forEach(item => {
      const li = document.createElement('li');
      li.className = `todo-item ${item.completed ? 'completed' : ''}`;
      const priorityHtml = getPriorityBadgeHtml(item.priority);
      const dueBadgeHtml = getDueDateBadgeHtml(item.dueDate, item.completed);
      const categoryHtml = item.category ? `<span class="todo-category-badge">${escapeHtml(item.category)}</span>` : '';
      
      const scheduledInfo = findScheduledSlotForTodo(item, weekData.slots);
      const scheduledHtml = scheduledInfo ? `<span class="todo-scheduled-badge" title="Scheduled on timeline grid">📅 ${scheduledInfo}</span>` : '';

      li.innerHTML = `
        <div class="todo-item-content">
          <input type="checkbox" ${item.completed ? 'checked' : ''} data-id="${item.id}" title="Toggle Completion">
          <div class="todo-item-details">
            <span class="todo-text">${escapeHtml(item.text)}</span>
            ${priorityHtml}
            ${dueBadgeHtml}
            ${categoryHtml}
            ${scheduledHtml}
          </div>
        </div>
        <div class="todo-item-actions">
          <button type="button" class="schedule-todo-btn" data-id="${item.id}" title="Schedule this priority goal across 15–20 days or into a single time slot">📅 Schedule</button>
          <button class="delete-todo-btn" data-id="${item.id}" title="Delete Item">✕</button>
        </div>
      `;
      todoList.appendChild(li);
    });
  }

  renderNoteSheetsTabs();
  const activeSheet = getActiveSheet();
  if (weeklyNotesTextarea) {
    weeklyNotesTextarea.value = activeSheet ? (activeSheet.content || '') : (weekData.notes || '');
    updateMarkdownPreview(weeklyNotesTextarea);
  }

  // Event Listeners for checkboxes and deletes
  todoList.querySelectorAll('input[type="checkbox"]').forEach(chk => {
    chk.addEventListener('change', async () => {
      const id = chk.dataset.id;
      const numId = parseInt(id, 10);
      const todo = (weekData.todos || []).find(t => String(t.id) === String(id) || t.id === numId);
      if (todo) {
        todo.completed = chk.checked;
        saveStateToStorage();
        renderNotes(todoList, weeklyNotesTextarea, gridUpdateCallback);
        if (gridUpdateCallback) gridUpdateCallback();
        await ApiClient.toggleTodo(todo.id, chk.checked);
      }
    });
  });

  // Schedule to Grid Modal Trigger
  todoList.querySelectorAll('.schedule-todo-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const numId = parseInt(id, 10);
      const todo = (weekData.todos || []).find(t => String(t.id) === String(id) || t.id === numId);
      if (todo) {
        openScheduleTodoModal(todo);
      }
    });
  });

  // Deletion with Warning Confirmation Modal & Cascade Clear Slot Option
  todoList.querySelectorAll('.delete-todo-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const numId = parseInt(id, 10);
      const todo = (weekData.todos || []).find(t => String(t.id) === String(id) || t.id === numId);
      if (!todo) return;

      const scheduledSlots = getScheduledSlotsForTodo(todo.text);
      pendingDeleteTodo = { id, numId, text: todo.text, scheduledSlots };

      const deleteModal = document.getElementById('deleteTodoConfirmModal');
      const targetNameEl = document.getElementById('deleteTodoTargetName');
      const standardSubdesc = document.getElementById('deleteTodoStandardSubdesc');
      const slotsWarningBox = document.getElementById('deleteTodoSlotsWarning');
      const slotsCountText = document.getElementById('deleteTodoSlotsCountText');
      const slotsList = document.getElementById('deleteTodoSlotsList');
      const standardActions = document.getElementById('deleteTodoStandardActions');
      const cascadeActions = document.getElementById('deleteTodoCascadeActions');
      const clearSlotsBtn = document.getElementById('confirmDeleteAndClearSlotsBtn');

      if (targetNameEl) {
        targetNameEl.textContent = `"${todo.text}"`;
      }

      if (scheduledSlots.length > 0) {
        if (standardSubdesc) standardSubdesc.style.display = 'none';
        if (standardActions) standardActions.style.display = 'none';
        if (slotsWarningBox) slotsWarningBox.style.display = 'block';
        if (cascadeActions) cascadeActions.style.display = 'flex';

        if (slotsCountText) {
          slotsCountText.textContent = `Scheduled in ${scheduledSlots.length} time slot${scheduledSlots.length > 1 ? 's' : ''} on your calendar:`;
        }

        if (slotsList) {
          slotsList.innerHTML = '';
          scheduledSlots.forEach(s => {
            const tag = document.createElement('span');
            tag.className = 'slot-tag-badge';
            tag.textContent = s.display;
            slotsList.appendChild(tag);
          });
        }

        if (clearSlotsBtn) {
          clearSlotsBtn.textContent = `🗑️ Delete Goal & Clear ${scheduledSlots.length} Scheduled Slot${scheduledSlots.length > 1 ? 's' : ''}`;
        }
      } else {
        if (standardSubdesc) standardSubdesc.style.display = 'block';
        if (standardActions) standardActions.style.display = 'flex';
        if (slotsWarningBox) slotsWarningBox.style.display = 'none';
        if (cascadeActions) cascadeActions.style.display = 'none';
      }

      if (deleteModal) {
        deleteModal.classList.add('active');
      }
    });
  });
}

/**
 * Phase 4 & 5: Markdown Scratchpad & Multiple Note Sheets Controller
 */
let scratchpadInitialized = false;
let currentScratchpadMode = localStorage.getItem('dayflow_scratchpad_mode') || 'edit';
let activeSheetId = 'journal';
let selectedSheetIcon = '📓';

export function getActiveSheetId() {
  return activeSheetId;
}

export function setActiveSheetId(id) {
  activeSheetId = id;
}

export function getWeekNoteSheets() {
  const weekData = getCurrentWeekData();
  if (!weekData.noteSheets || !Array.isArray(weekData.noteSheets) || weekData.noteSheets.length === 0) {
    weekData.noteSheets = [
      { id: 'journal', title: 'Weekly Journal', icon: '📓', content: weekData.notes || '', isDefault: true },
      { id: 'tech', title: 'Tech & Architecture', icon: '💻', content: '', isDefault: true },
      { id: 'backlog', title: 'Sprint Backlog', icon: '💼', content: '', isDefault: true },
      { id: 'scratchpad', title: 'Quick Scratchpad', icon: '⚡', content: '', isDefault: true }
    ];
  }
  return weekData.noteSheets;
}

export function getActiveSheet() {
  const sheets = getWeekNoteSheets();
  let active = sheets.find(s => s.id === activeSheetId);
  if (!active) {
    activeSheetId = sheets[0]?.id || 'journal';
    active = sheets.find(s => s.id === activeSheetId) || sheets[0];
  }
  return active;
}

export function renderNoteSheetsTabs(tabBarEl, textarea, previewEl, wordCountEl) {
  const tabBar = tabBarEl || document.getElementById('notesSheetsTabBar');
  const ta = textarea || document.getElementById('weeklyNotesTextarea');
  const preview = previewEl || document.getElementById('weeklyNotesPreview');
  const wordCount = wordCountEl || document.getElementById('notesWordCount');
  if (!tabBar) return;

  const sheets = getWeekNoteSheets();
  const currentActive = getActiveSheet();

  tabBar.innerHTML = '';
  sheets.forEach(sheet => {
    const tabBtn = document.createElement('button');
    tabBtn.type = 'button';
    tabBtn.className = `note-sheet-tab ${sheet.id === activeSheetId ? 'active' : ''}`;
    tabBtn.dataset.id = sheet.id;
    tabBtn.title = `Switch to ${sheet.title}`;

    let deleteBtnHtml = '';
    if (!sheet.isDefault) {
      deleteBtnHtml = `<button type="button" class="note-sheet-tab-delete" data-id="${sheet.id}" title="Delete Sheet">✕</button>`;
    }

    tabBtn.innerHTML = `
      <span class="note-sheet-tab-icon">${sheet.icon || '📝'}</span>
      <span class="note-sheet-tab-title">${escapeHtml(sheet.title)}</span>
      ${deleteBtnHtml}
    `;

    // Switch Sheet on Tab Click
    tabBtn.addEventListener('click', (e) => {
      if (e.target.closest('.note-sheet-tab-delete')) return;
      if (sheet.id === activeSheetId) return;

      // Flush current editor content to outgoing sheet
      const outgoing = sheets.find(s => s.id === activeSheetId);
      if (outgoing && ta) {
        outgoing.content = ta.value;
      }

      activeSheetId = sheet.id;
      if (ta) {
        ta.value = sheet.content || '';
      }
      updateMarkdownPreview(ta, preview, wordCount);
      saveStateToStorage();
      renderNoteSheetsTabs(tabBar, ta, preview, wordCount);
    });

    // Delete custom sheet listener with themed confirmation modal
    const delBtn = tabBtn.querySelector('.note-sheet-tab-delete');
    if (delBtn) {
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openDeleteNoteSheetModal(sheet, ta, preview, wordCount, tabBar);
      });
    }

    tabBar.appendChild(tabBtn);
  });
}

let pendingDeleteSheet = null;

export function openDeleteNoteSheetModal(sheet, ta, preview, wordCount, tabBar) {
  pendingDeleteSheet = sheet;
  const modal = document.getElementById('deleteNoteSheetConfirmModal');
  const targetName = document.getElementById('deleteNoteSheetTargetName');
  if (targetName) {
    targetName.textContent = `"${sheet.title}"`;
  }
  if (modal) {
    modal.classList.add('active');
  }
}

export function updateMarkdownPreview(textarea, previewContainer, wordCountContainer) {
  const ta = textarea || document.getElementById('weeklyNotesTextarea');
  const preview = previewContainer || document.getElementById('weeklyNotesPreview');
  const wordCount = wordCountContainer || document.getElementById('notesWordCount');

  if (!ta) return;
  const content = ta.value || '';

  if (preview) {
    preview.innerHTML = parseMarkdown(content);
    // Bind copy buttons inside code blocks
    preview.querySelectorAll('.code-copy-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const rawCode = decodeURIComponent(btn.dataset.code || '');
        try {
          await navigator.clipboard.writeText(rawCode);
          btn.classList.add('copied');
          btn.innerHTML = '<span class="copy-icon">✓</span> Copied!';
          setTimeout(() => {
            btn.classList.remove('copied');
            btn.innerHTML = '<span class="copy-icon">📋</span> Copy';
          }, 2000);
        } catch (err) {
          console.warn('Clipboard copy failed:', err);
        }
      });
    });
  }

  if (wordCount) {
    const trimmed = content.trim();
    const words = trimmed ? trimmed.split(/\s+/).length : 0;
    const chars = content.length;
    wordCount.textContent = `${words} ${words === 1 ? 'word' : 'words'} • ${chars} ${chars === 1 ? 'char' : 'chars'}`;
  }
}

export function initMarkdownScratchpad(domElements) {
  if (scratchpadInitialized) return;
  scratchpadInitialized = true;

  const {
    weeklyNotesTextarea: ta,
    weeklyNotesPreview: preview,
    notesDualPaneContainer: container,
    notesModeEditBtn: btnEdit,
    notesModeSplitBtn: btnSplit,
    notesModePreviewBtn: btnPreview,
    notesMarkdownToolbar: toolbar,
    notesSnippetSelect: snippetSelect,
    notesWordCount: wordCount
  } = domElements;

  if (!ta || !container) return;

  // View Mode Switcher
  const setMode = (mode) => {
    currentScratchpadMode = mode;
    localStorage.setItem('dayflow_scratchpad_mode', mode);

    container.classList.remove('mode-edit', 'mode-split', 'mode-preview');
    container.classList.add(`mode-${mode}`);

    if (btnEdit) btnEdit.classList.toggle('active', mode === 'edit');
    if (btnSplit) btnSplit.classList.toggle('active', mode === 'split');
    if (btnPreview) btnPreview.classList.toggle('active', mode === 'preview');

    if (mode === 'split' || mode === 'preview') {
      updateMarkdownPreview(ta, preview, wordCount);
    }
  };

  // Restore saved view mode
  setMode(currentScratchpadMode);

  if (btnEdit) btnEdit.addEventListener('click', () => setMode('edit'));
  if (btnSplit) btnSplit.addEventListener('click', () => setMode('split'));
  if (btnPreview) btnPreview.addEventListener('click', () => setMode('preview'));

  // Live input update for preview and word count
  ta.addEventListener('input', () => {
    updateMarkdownPreview(ta, preview, wordCount);
  });

  // Text formatting insertion helper
  const insertFormatting = (prefix, suffix = '', defaultText = '') => {
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const text = ta.value;
    const selected = text.substring(start, end);

    const replacement = selected.length > 0
      ? `${prefix}${selected}${suffix}`
      : `${prefix}${defaultText}${suffix}`;

    ta.setRangeText(replacement, start, end, 'end');
    ta.focus();

    if (selected.length === 0 && defaultText.length > 0) {
      ta.setSelectionRange(start + prefix.length, start + prefix.length + defaultText.length);
    }

    ta.dispatchEvent(new Event('input', { bubbles: true }));
  };

  // Line prefix helper (for headers, lists, quotes)
  const insertLinePrefix = (linePrefix) => {
    const start = ta.selectionStart;
    const text = ta.value;
    const lineStart = text.lastIndexOf('\n', start - 1) + 1;
    const currentLine = text.substring(lineStart);

    if (currentLine.startsWith(linePrefix)) {
      ta.focus();
      return;
    }

    ta.setSelectionRange(lineStart, lineStart);
    ta.setRangeText(linePrefix, lineStart, lineStart, 'end');
    ta.focus();
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  };

  // Toolbar action listeners
  if (toolbar) {
    toolbar.querySelectorAll('.toolbar-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const action = btn.dataset.action;
        switch (action) {
          case 'bold':
            insertFormatting('**', '**', 'bold text');
            break;
          case 'italic':
            insertFormatting('*', '*', 'italic text');
            break;
          case 'strike':
            insertFormatting('~~', '~~', 'strikethrough text');
            break;
          case 'h1':
            insertLinePrefix('# ');
            break;
          case 'h2':
            insertLinePrefix('## ');
            break;
          case 'h3':
            insertLinePrefix('### ');
            break;
          case 'bullet':
            insertLinePrefix('- ');
            break;
          case 'numbered':
            insertLinePrefix('1. ');
            break;
          case 'task':
            insertLinePrefix('- [ ] ');
            break;
          case 'quote':
            insertLinePrefix('> ');
            break;
          case 'table':
            const tableTemplate = `\n| Item / Task | Category | Status | Notes |\n| :--- | :--- | :--- | :--- |\n| Core Architecture | Learning | In Progress | Review DB schemas |\n| UI Polish | Frontend | Ready | Glassmorphism styling |\n\n`;
            insertFormatting('', '', tableTemplate);
            break;
          case 'inline-code':
            insertFormatting('`', '`', 'code');
            break;
          case 'code-block':
            insertFormatting('```csharp\n', '\n```', '// Enter code snippet here');
            break;
        }
      });
    });
  }

  // Snippet Template selector
  if (snippetSelect) {
    snippetSelect.addEventListener('change', () => {
      const val = snippetSelect.value;
      if (!val) return;

      let snippetText = '';
      if (val === 'cs') {
        snippetText = `\n\`\`\`csharp\n// C# Async Service Method\npublic async Task<List<ScheduleSlot>> GetScheduleSlotsAsync(DateTime weekStart)\n{\n    using var connection = new NpgsqlConnection(connectionString);\n    await connection.OpenAsync();\n    return await connection.QueryAsync<ScheduleSlot>("SELECT * FROM schedule_slots");\n}\n\`\`\`\n\n`;
      } else if (val === 'xaml') {
        snippetText = `\n\`\`\`xaml\n<!-- WPF XAML Grid & Card Layout -->\n<Grid Margin="16">\n    <Grid.RowDefinitions>\n        <RowDefinition Height="Auto" />\n        <RowDefinition Height="*" />\n    </Grid.RowDefinitions>\n    <TextBlock Grid.Row="0" Text="Weekly Focus" FontSize="18" FontWeight="Bold" />\n    <Button Grid.Row="1" Content="Log Task" Style="{StaticResource PrimaryButtonStyle}" />\n</Grid>\n\`\`\`\n\n`;
      } else if (val === 'sql') {
        snippetText = `\n\`\`\`sql\n-- PostgreSQL Schedule Query\nSELECT id, start_time, task_description, category, is_completed\nFROM schedule_slots\nWHERE user_id = 1 AND schedule_date >= '2026-09-01'\nORDER BY schedule_date ASC, start_time ASC;\n\`\`\`\n\n`;
      } else if (val === 'js') {
        snippetText = `\n\`\`\`typescript\n// TypeScript Model & Discipline Score Calculation\nexport interface WeeklySchedule {\n  weekKey: string;\n  completedTasks: number;\n}\n\nexport function calculateDisciplineScore(schedule: WeeklySchedule): number {\n  return Math.min(100, Math.round((schedule.completedTasks / 20) * 100));\n}\n\`\`\`\n\n`;
      } else if (val === 'reflection') {
        snippetText = `\n## 🌟 Weekly Reflection & Retrospective\n\n### 🎯 Key Wins this Week\n- \n- \n\n### 💡 Learnings & Technical Insights\n- \n\n### 🚀 Next Week Priorities\n- [ ] \n- [ ] \n\n`;
      }

      insertFormatting('', '', snippetText);
      snippetSelect.selectedIndex = 0;
    });
  }

  // Keyboard Shortcuts: Tab indents 2 spaces, Ctrl+B / Ctrl+I
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      insertFormatting('  ', '', '');
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      insertFormatting('**', '**', 'bold text');
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
      e.preventDefault();
      insertFormatting('*', '*', 'italic text');
    }
  });

  // Add Custom Note Sheet Modal Wiring
  const addSheetModal = document.getElementById('addNoteSheetModal');
  const addSheetBtn = document.getElementById('addNoteSheetBtn');
  const closeAddSheetModalBtn = document.getElementById('closeAddSheetModalBtn');
  const cancelAddSheetBtn = document.getElementById('cancelAddSheetBtn');
  const confirmAddSheetBtn = document.getElementById('confirmAddSheetBtn');
  const newSheetTitleInput = document.getElementById('newSheetTitleInput');
  const iconPicker = document.getElementById('sheetIconPicker');

  if (iconPicker) {
    iconPicker.querySelectorAll('.sheet-icon-option').forEach(opt => {
      opt.addEventListener('click', (e) => {
        e.preventDefault();
        iconPicker.querySelectorAll('.sheet-icon-option').forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        selectedSheetIcon = opt.dataset.icon || '📓';
      });
    });
  }

  const openAddSheetModal = () => {
    if (newSheetTitleInput) {
      newSheetTitleInput.value = '';
    }
    selectedSheetIcon = '📓';
    if (iconPicker) {
      iconPicker.querySelectorAll('.sheet-icon-option').forEach(o => {
        o.classList.toggle('active', o.dataset.icon === '📓');
      });
    }
    if (addSheetModal) addSheetModal.classList.add('active');
    setTimeout(() => { if (newSheetTitleInput) newSheetTitleInput.focus(); }, 50);
  };

  const closeAddSheetModal = () => {
    if (addSheetModal) addSheetModal.classList.remove('active');
  };

  if (addSheetBtn) addSheetBtn.addEventListener('click', openAddSheetModal);
  if (closeAddSheetModalBtn) closeAddSheetModalBtn.addEventListener('click', closeAddSheetModal);
  if (cancelAddSheetBtn) cancelAddSheetBtn.addEventListener('click', closeAddSheetModal);

  // Themed Delete Note Sheet Confirmation Modal Wiring
  const deleteSheetModal = document.getElementById('deleteNoteSheetConfirmModal');
  const cancelDeleteSheetBtn = document.getElementById('cancelDeleteNoteSheetBtn');
  const confirmDeleteNoteSheetBtn = document.getElementById('confirmDeleteNoteSheetBtn');

  const closeDeleteSheetModal = () => {
    if (deleteSheetModal) deleteSheetModal.classList.remove('active');
    pendingDeleteSheet = null;
  };

  if (cancelDeleteSheetBtn) cancelDeleteSheetBtn.addEventListener('click', closeDeleteSheetModal);
  if (deleteSheetModal) {
    deleteSheetModal.addEventListener('click', (e) => {
      if (e.target === deleteSheetModal) closeDeleteSheetModal();
    });
  }

  if (confirmDeleteNoteSheetBtn) {
    confirmDeleteNoteSheetBtn.addEventListener('click', () => {
      if (!pendingDeleteSheet) return;
      const sheet = pendingDeleteSheet;
      const weekData = getCurrentWeekData();
      weekData.noteSheets = (weekData.noteSheets || []).filter(s => s.id !== sheet.id);
      if (activeSheetId === sheet.id) {
        activeSheetId = 'journal';
      }
      const nextActive = getActiveSheet();
      if (ta) {
        ta.value = nextActive.content || '';
      }
      updateMarkdownPreview(ta, preview, wordCount);
      saveStateToStorage();
      const weekKey = getWeekKey(STATE.currentWeekStart);
      ApiClient.saveNotes(weekKey, weekData.notes, weekData.noteSheets);
      renderNoteSheetsTabs();
      closeDeleteSheetModal();
    });
  }

  if (confirmAddSheetBtn) {
    confirmAddSheetBtn.addEventListener('click', () => {
      const title = (newSheetTitleInput ? newSheetTitleInput.value : '').trim();
      if (!title) {
        if (newSheetTitleInput) newSheetTitleInput.focus();
        return;
      }

      // Flush current active sheet
      const currentActive = getActiveSheet();
      if (currentActive && ta) {
        currentActive.content = ta.value;
      }

      const weekData = getCurrentWeekData();
      const sheets = getWeekNoteSheets();
      const newSheetId = `custom_${Date.now()}`;
      const newSheet = {
        id: newSheetId,
        title,
        icon: selectedSheetIcon || '📓',
        content: '',
        isDefault: false
      };

      sheets.push(newSheet);
      activeSheetId = newSheetId;

      if (ta) {
        ta.value = '';
      }
      updateMarkdownPreview(ta, preview, wordCount);
      saveStateToStorage();

      const weekKey = getWeekKey(STATE.currentWeekStart);
      ApiClient.saveNotes(weekKey, weekData.notes, weekData.noteSheets);

      renderNoteSheetsTabs();
      closeAddSheetModal();
      if (ta) ta.focus();
    });
  }

  // Initial render of tabs and preview
  renderNoteSheetsTabs();
  const activeSheet = getActiveSheet();
  if (ta && activeSheet) {
    ta.value = activeSheet.content || '';
  }
  updateMarkdownPreview(ta, preview, wordCount);
}

