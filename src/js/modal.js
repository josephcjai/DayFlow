/**
 * DayFlow Task Editor Modal Controller
 * Implements Planned vs Actual Task distinction, clear slot button, & time-lock rules
 */
import { STATE, getCurrentWeekData, isSlotTimePassed, saveStateToStorage, getWeekKey, recordUndoAction, markSlotPendingSave, clearSlotPendingSave, isCategoryProductive } from './state.js?v=2.9.29';
import { ApiClient } from './apiClient.js?v=2.9.29';
import { clearSlotSelection } from './grid.js?v=2.9.29';
import { isSlotProductive, USER_SETTINGS } from './settings.js?v=2.9.29';

let modalElements = {};
let renderCallback = null;

function updateModalProductiveHint() {
  if (!modalElements.taskProductiveHint) return;
  const currentCat = modalElements.taskCategorySelect ? modalElements.taskCategorySelect.value : 'General';
  const catIsDefault = isCategoryProductive(currentCat);
  const isExplicit = modalElements.taskIsProductiveInput?.dataset.userEdited === 'true';
  const isChecked = !!modalElements.taskIsProductiveInput?.checked;

  if (isExplicit) {
    modalElements.taskProductiveHint.textContent = `Custom override: ${isChecked ? '⚡ Productive' : 'Standard'} (Default for ${currentCat} is ${catIsDefault ? 'Productive' : 'Standard'})`;
  } else {
    modalElements.taskProductiveHint.textContent = `Category default: ${catIsDefault ? '⚡ Productive' : 'Standard'}`;
  }
}

export function initModal(elements, onSaveOrDelete) {
  modalElements = elements;
  renderCallback = onSaveOrDelete;

  // Auto-sync Actual Task from Planned Task if user hasn't explicitly diverged
  modalElements.plannedTaskInput.addEventListener('input', () => {
    if (!modalElements.plannedTaskInput.disabled) {
      if (!modalElements.actualTaskInput.dataset.userEdited) {
        modalElements.actualTaskInput.value = modalElements.plannedTaskInput.value;
      }
    }
  });

  modalElements.actualTaskInput.addEventListener('input', () => {
    modalElements.actualTaskInput.dataset.userEdited = 'true';
  });

  if (modalElements.taskCategorySelect) {
    modalElements.taskCategorySelect.addEventListener('change', () => {
      if (modalElements.taskIsProductiveInput && modalElements.taskIsProductiveInput.dataset.userEdited !== 'true') {
        modalElements.taskIsProductiveInput.checked = isCategoryProductive(modalElements.taskCategorySelect.value);
      }
      updateModalProductiveHint();
    });
  }

  if (modalElements.taskIsProductiveInput) {
    modalElements.taskIsProductiveInput.addEventListener('change', () => {
      modalElements.taskIsProductiveInput.dataset.userEdited = 'true';
      updateModalProductiveHint();
    });
  }

  modalElements.closeModalBtn.addEventListener('click', closeModal);
  modalElements.taskModal.addEventListener('click', (e) => {
    if (e.target === modalElements.taskModal) closeModal();
  });

  modalElements.taskForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveSlotTask();
  });

  modalElements.deleteTaskBtn.addEventListener('click', async () => {
    await deleteActiveSlot();
  });
}

function getSlotWeekKey(slotKey) {
  if (!slotKey) return getWeekKey(STATE.currentWeekStart);
  const parts = slotKey.split('_');
  if (parts.length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(parts[0])) {
    const [y, m, d] = parts[0].split('-').map(Number);
    return getWeekKey(new Date(y, m - 1, d));
  }
  return getWeekKey(STATE.currentWeekStart);
}

async function deleteActiveSlot() {
  if (STATE.activeSlotKey) {
    const slotKey = STATE.activeSlotKey;
    const weekKey = getSlotWeekKey(slotKey);
    if (!STATE.scheduleData[weekKey]) {
      STATE.scheduleData[weekKey] = { slots: {}, habits: [], todos: [], notes: '' };
    }
    const previousData = STATE.scheduleData[weekKey].slots[slotKey]
      ? JSON.parse(JSON.stringify(STATE.scheduleData[weekKey].slots[slotKey]))
      : null;
    if (previousData) {
      recordUndoAction({
        type: 'slot_delete',
        weekKey,
        slotKey,
        previousData,
        newData: null,
        label: previousData.plannedTask || previousData.actualTask || 'Task'
      });
    }
    delete STATE.scheduleData[weekKey].slots[slotKey];
    clearSlotPendingSave(slotKey);
    saveStateToStorage();
    
    closeModal();
    if (renderCallback) renderCallback();

    // Sync delete directly with PostgreSQL database
    await ApiClient.deleteSlot(weekKey, slotKey);
  }
}

export function openTaskModal(slotKey, dayName, timeLabel, existingData) {
  STATE.activeSlotKey = slotKey;
  modalElements.modalSlotDay.textContent = dayName;
  modalElements.modalSlotTime.textContent = timeLabel;
  
  delete modalElements.actualTaskInput.dataset.userEdited;

  const isPast = isSlotTimePassed(slotKey);

  // Clear Slot button is ALWAYS available to clear any task
  modalElements.deleteTaskBtn.style.display = 'inline-flex';

  if (existingData) {
    modalElements.modalTitle.textContent = 'Edit 30-Min Time Slot';
    modalElements.plannedTaskInput.value = existingData.plannedTask || existingData.title || '';
    modalElements.actualTaskInput.value = existingData.actualTask || existingData.title || existingData.plannedTask || '';
    modalElements.taskCategorySelect.value = existingData.category || 'General';
    modalElements.taskStatusSelect.value = existingData.status || 'Pending';
    modalElements.plannedDurationInput.value = Math.min(30, Math.max(5, parseInt(existingData.planned, 10) || 30));
    modalElements.actualDurationInput.value = existingData.actual !== undefined ? Math.min(30, Math.max(0, parseInt(existingData.actual, 10))) : 30;
    modalElements.taskNotesInput.value = existingData.notes || '';

    if (modalElements.taskIsProductiveInput) {
      if (typeof existingData.isProductive === 'boolean') {
        modalElements.taskIsProductiveInput.checked = existingData.isProductive;
        modalElements.taskIsProductiveInput.dataset.userEdited = 'true';
      } else {
        modalElements.taskIsProductiveInput.checked = isSlotProductive(existingData);
        delete modalElements.taskIsProductiveInput.dataset.userEdited;
      }
      updateModalProductiveHint();
    }
  } else {
    modalElements.modalTitle.textContent = 'Schedule 30-Min Time Slot';
    modalElements.plannedTaskInput.value = '';
    modalElements.actualTaskInput.value = '';
    modalElements.taskCategorySelect.value = 'Learning';
    modalElements.taskStatusSelect.value = 'Pending';
    modalElements.plannedDurationInput.value = 30;
    modalElements.actualDurationInput.value = 30;
    modalElements.taskNotesInput.value = '';

    if (modalElements.taskIsProductiveInput) {
      const prodCats = USER_SETTINGS?.productiveCategories || ['Work', 'Learning'];
      modalElements.taskIsProductiveInput.checked = prodCats.includes('Learning');
      delete modalElements.taskIsProductiveInput.dataset.userEdited;
      updateModalProductiveHint();
    }
  }

  // Enforce Time-Lock Rule on Planned Task for past slots
  if (isPast) {
    modalElements.plannedTaskInput.disabled = true;
    modalElements.plannedTaskInput.classList.add('input-locked');
    modalElements.plannedLockMsg.style.display = 'block';
  } else {
    modalElements.plannedTaskInput.disabled = false;
    modalElements.plannedTaskInput.classList.remove('input-locked');
    modalElements.plannedLockMsg.style.display = 'none';
  }

  // Actual Task is ALWAYS editable
  modalElements.actualTaskInput.disabled = false;

  modalElements.taskModal.classList.add('active');
}

export function closeModal() {
  modalElements.taskModal.classList.remove('active');
  STATE.activeSlotKey = null;
  clearSlotSelection();
}

async function saveSlotTask() {
  if (!STATE.activeSlotKey) return;

  const plannedTask = modalElements.plannedTaskInput.value.trim();
  const actualTask = modalElements.actualTaskInput.value.trim();

  // If user cleared both fields and saved, delete the slot entry
  if (!plannedTask && !actualTask) {
    await deleteActiveSlot();
    return;
  }

  const slotKey = STATE.activeSlotKey;
  const weekKey = getSlotWeekKey(slotKey);
  if (!STATE.scheduleData[weekKey]) {
    STATE.scheduleData[weekKey] = { slots: {}, habits: [], todos: [], notes: '' };
  }
  const weekData = STATE.scheduleData[weekKey];
  const existing = weekData.slots[slotKey] || {};

  const finalPlannedTask = modalElements.plannedTaskInput.disabled
    ? (existing.plannedTask || plannedTask || actualTask)
    : (plannedTask || actualTask);
  const finalActualTask = actualTask || plannedTask;

  const isProductiveVal = modalElements.taskIsProductiveInput
    ? modalElements.taskIsProductiveInput.checked
    : isSlotProductive({ category: modalElements.taskCategorySelect.value });

  const slotObject = {
    ...existing,
    plannedTask: finalPlannedTask,
    actualTask: finalActualTask,
    category: modalElements.taskCategorySelect.value || 'General',
    status: modalElements.taskStatusSelect.value || 'Pending',
    planned: Math.min(30, Math.max(5, parseInt(modalElements.plannedDurationInput.value, 10) || 30)),
    actual: modalElements.actualDurationInput.value !== '' ? Math.min(30, Math.max(0, parseInt(modalElements.actualDurationInput.value, 10) || 0)) : 30,
    isProductive: isProductiveVal,
    notes: modalElements.taskNotesInput.value.trim()
  };

  const previousData = existing && (existing.plannedTask || existing.actualTask)
    ? JSON.parse(JSON.stringify(existing))
    : null;
  recordUndoAction({
    type: 'slot_save',
    weekKey,
    slotKey,
    previousData,
    newData: JSON.parse(JSON.stringify(slotObject)),
    label: slotObject.plannedTask || slotObject.actualTask || 'Task'
  });

  weekData.slots[slotKey] = slotObject;
  markSlotPendingSave(weekKey, slotKey, slotObject);
  saveStateToStorage();

  closeModal();
  if (renderCallback) renderCallback();

  // Sync save directly with PostgreSQL DB via Express REST API
  try {
    const ok = await ApiClient.saveSlot(weekKey, slotKey, slotObject);
    if (ok) {
      clearSlotPendingSave(slotKey);
    }
  } catch (e) {
    console.warn('Failed to sync slot to backend, kept in pending saves:', e);
  }
}
