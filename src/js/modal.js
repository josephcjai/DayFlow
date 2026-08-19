/**
 * DayFlow Task Editor Modal Controller
 * Implements Planned vs Actual Task distinction, clear slot button, & time-lock rules
 */
import { STATE, getCurrentWeekData, isSlotTimePassed, saveStateToStorage, getWeekKey } from './state.js?v=2.4.10';
import { ApiClient } from './apiClient.js?v=2.4.10';

let modalElements = {};
let renderCallback = null;

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
    delete STATE.scheduleData[weekKey].slots[slotKey];
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
    modalElements.plannedDurationInput.value = existingData.planned || 30;
    modalElements.actualDurationInput.value = existingData.actual !== undefined ? existingData.actual : 30;
    modalElements.taskNotesInput.value = existingData.notes || '';
  } else {
    modalElements.modalTitle.textContent = 'Schedule 30-Min Time Slot';
    modalElements.plannedTaskInput.value = '';
    modalElements.actualTaskInput.value = '';
    modalElements.taskCategorySelect.value = 'Learning';
    modalElements.taskStatusSelect.value = 'Pending';
    modalElements.plannedDurationInput.value = 30;
    modalElements.actualDurationInput.value = 30;
    modalElements.taskNotesInput.value = '';
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

  const slotObject = {
    ...existing,
    plannedTask: finalPlannedTask,
    actualTask: finalActualTask,
    category: modalElements.taskCategorySelect.value || 'General',
    status: modalElements.taskStatusSelect.value || 'Pending',
    planned: parseInt(modalElements.plannedDurationInput.value, 10) || 30,
    actual: modalElements.actualDurationInput.value !== '' ? (parseInt(modalElements.actualDurationInput.value, 10) || 0) : 30,
    notes: modalElements.taskNotesInput.value.trim()
  };

  weekData.slots[slotKey] = slotObject;
  saveStateToStorage();

  closeModal();
  if (renderCallback) renderCallback();

  // Sync save directly with PostgreSQL DB via Express REST API
  await ApiClient.saveSlot(weekKey, slotKey, slotObject);
}
