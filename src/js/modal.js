/**
 * DayFlow Task Editor Modal Controller
 * Implements Planned vs Actual Task distinction & time-lock rules
 */
import { STATE, getCurrentWeekData, isSlotTimePassed, saveStateToStorage } from './state.js';

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

  modalElements.taskForm.addEventListener('submit', (e) => {
    e.preventDefault();
    saveSlotTask();
  });

  modalElements.deleteTaskBtn.addEventListener('click', () => {
    if (STATE.activeSlotKey) {
      const weekData = getCurrentWeekData();
      delete weekData.slots[STATE.activeSlotKey];
      saveStateToStorage();
      closeModal();
      if (renderCallback) renderCallback();
    }
  });
}

export function openTaskModal(slotKey, dayName, timeLabel, existingData) {
  STATE.activeSlotKey = slotKey;
  modalElements.modalSlotDay.textContent = dayName;
  modalElements.modalSlotTime.textContent = timeLabel;
  
  delete modalElements.actualTaskInput.dataset.userEdited;

  const isPast = isSlotTimePassed(slotKey);

  if (existingData) {
    modalElements.modalTitle.textContent = 'Edit 30-Min Time Slot';
    modalElements.plannedTaskInput.value = existingData.plannedTask || existingData.title || '';
    modalElements.actualTaskInput.value = existingData.actualTask || existingData.title || existingData.plannedTask || '';
    modalElements.taskCategorySelect.value = existingData.category || 'General';
    modalElements.taskStatusSelect.value = existingData.status || 'Pending';
    modalElements.plannedDurationInput.value = existingData.planned || 30;
    modalElements.actualDurationInput.value = existingData.actual !== undefined ? existingData.actual : 30;
    modalElements.taskNotesInput.value = existingData.notes || '';
    modalElements.deleteTaskBtn.style.display = 'inline-flex';
  } else {
    modalElements.modalTitle.textContent = 'Schedule 30-Min Time Slot';
    modalElements.plannedTaskInput.value = '';
    modalElements.actualTaskInput.value = '';
    modalElements.taskCategorySelect.value = 'Learning';
    modalElements.taskStatusSelect.value = 'Pending';
    modalElements.plannedDurationInput.value = 30;
    modalElements.actualDurationInput.value = 30;
    modalElements.taskNotesInput.value = '';
    modalElements.deleteTaskBtn.style.display = 'none';
  }

  // Enforce Time-Lock Rule on Planned Task
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

function saveSlotTask() {
  if (!STATE.activeSlotKey) return;

  const plannedTask = modalElements.plannedTaskInput.value.trim();
  const actualTask = modalElements.actualTaskInput.value.trim() || plannedTask;

  if (!plannedTask && !actualTask) return;

  const weekData = getCurrentWeekData();
  const existing = weekData.slots[STATE.activeSlotKey] || {};

  weekData.slots[STATE.activeSlotKey] = {
    ...existing,
    plannedTask: modalElements.plannedTaskInput.disabled ? (existing.plannedTask || plannedTask) : plannedTask,
    actualTask: actualTask,
    category: modalElements.taskCategorySelect.value,
    status: modalElements.taskStatusSelect.value,
    planned: parseInt(modalElements.plannedDurationInput.value, 10) || 30,
    actual: parseInt(modalElements.actualDurationInput.value, 10) || 0,
    notes: modalElements.taskNotesInput.value.trim()
  };

  saveStateToStorage();
  closeModal();
  if (renderCallback) renderCallback();
}
