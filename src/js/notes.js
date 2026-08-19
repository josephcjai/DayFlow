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
import { getCurrentWeekData, saveStateToStorage, getWeekDates, getWeekKey, getMonday, STATE, formatDateISO } from './state.js?v=2.5.1';
import { ApiClient } from './apiClient.js?v=2.5.1';
import { escapeHtml } from './utils.js?v=2.5.1';
import { TIME_SLOTS } from './grid.js?v=2.5.1';

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
      dateDisplay: curDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
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

        const d1 = new Date(firstDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const d2 = new Date(lastDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

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

    weekDates.forEach((dStr, idx) => {
      const dObj = new Date(dStr + 'T00:00:00');
      const dateDisplay = dObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const opt = document.createElement('option');
      opt.value = dStr;
      opt.textContent = `${dayNames[idx]}, ${dateDisplay} ${dStr === todayStr ? ' (Today)' : ''}`;
      if (todo.scheduledDate === dStr || (dStr === todayStr && !todo.scheduledDate)) {
        opt.selected = true;
      }
      dateSelect.appendChild(opt);
    });
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
  const dayAbbr = dObj.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });
  return `${dayAbbr} ${timeStr}`;
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
  updateTodoProgressBar(allTodos);

  // Filter based on active filter pill
  const filteredTodos = allTodos.filter(item => {
    if (activeTodoFilter === 'all') return true;
    if (activeTodoFilter === 'pending') return !item.completed;
    if (activeTodoFilter === 'completed') return !!item.completed;
    return (item.priority || 'Medium').toLowerCase() === activeTodoFilter.toLowerCase();
  });

  if (filteredTodos.length === 0) {
    const emptyMsg = allTodos.length === 0
      ? 'No priorities added for this week yet.'
      : `No items matching '${activeTodoFilter}' filter.`;
    todoList.innerHTML = `<li style="color: var(--text-muted); text-align: center; padding: 1.25rem; font-size: 0.85rem; border: 1px dashed var(--border-color); border-radius: var(--radius-md);">${emptyMsg}</li>`;
  } else {
    filteredTodos.forEach(item => {
      const li = document.createElement('li');
      li.className = `todo-item ${item.completed ? 'completed' : ''}`;
      const priorityHtml = getPriorityBadgeHtml(item.priority);
      const categoryHtml = item.category ? `<span class="todo-category-badge">${escapeHtml(item.category)}</span>` : '';
      
      const scheduledInfo = findScheduledSlotForTodo(item, weekData.slots);
      const scheduledHtml = scheduledInfo ? `<span class="todo-scheduled-badge" title="Scheduled on timeline grid">📅 ${scheduledInfo}</span>` : '';

      li.innerHTML = `
        <div class="todo-item-content">
          <input type="checkbox" ${item.completed ? 'checked' : ''} data-id="${item.id}" title="Toggle Completion">
          <div class="todo-item-details">
            <span class="todo-text">${escapeHtml(item.text)}</span>
            ${priorityHtml}
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

  if (weeklyNotesTextarea) {
    weeklyNotesTextarea.value = weekData.notes || '';
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
