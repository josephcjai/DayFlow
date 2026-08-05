/**
 * DayFlow Notes & Todo Checklist Controller
 */
import { getCurrentWeekData, saveStateToStorage } from './state.js';

export function renderNotes(todoList, weeklyNotesTextarea) {
  const weekData = getCurrentWeekData();
  todoList.innerHTML = '';

  (weekData.todos || []).forEach(item => {
    const li = document.createElement('li');
    li.className = `todo-item ${item.completed ? 'completed' : ''}`;
    li.innerHTML = `
      <label style="display:flex; align-items:center; gap: 0.5rem; cursor:pointer;">
        <input type="checkbox" ${item.completed ? 'checked' : ''} data-id="${item.id}">
        <span>${escapeHtml(item.text)}</span>
      </label>
      <button class="btn btn-sm btn-outline delete-todo-btn" data-id="${item.id}">✕</button>
    `;
    todoList.appendChild(li);
  });

  todoList.querySelectorAll('input[type="checkbox"]').forEach(chk => {
    chk.addEventListener('change', () => {
      const id = parseInt(chk.dataset.id, 10);
      const todo = weekData.todos.find(t => t.id === id);
      if (todo) {
        todo.completed = chk.checked;
        saveStateToStorage();
        renderNotes(todoList, weeklyNotesTextarea);
      }
    });
  });

  todoList.querySelectorAll('.delete-todo-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.id, 10);
      weekData.todos = weekData.todos.filter(t => t.id !== id);
      saveStateToStorage();
      renderNotes(todoList, weeklyNotesTextarea);
    });
  });

  weeklyNotesTextarea.value = weekData.notes || '';
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
