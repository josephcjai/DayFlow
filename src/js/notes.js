/**
 * DayFlow Notes & Todo Checklist Controller
 */
import { getCurrentWeekData, saveStateToStorage } from './state.js';
import { ApiClient } from './apiClient.js';
import { escapeHtml } from './utils.js';

export function renderNotes(todoList, weeklyNotesTextarea) {
  const weekData = getCurrentWeekData();
  todoList.innerHTML = '';

  (weekData.todos || []).forEach(item => {
    const li = document.createElement('li');
    li.className = `todo-item ${item.completed ? 'completed' : ''}`;
    li.innerHTML = `
      <label>
        <input type="checkbox" ${item.completed ? 'checked' : ''} data-id="${item.id}">
        <span>${escapeHtml(item.text)}</span>
      </label>
      <button class="delete-todo-btn" data-id="${item.id}">✕</button>
    `;
    todoList.appendChild(li);
  });

  weeklyNotesTextarea.value = weekData.notes || '';

  // Event Listeners for checkboxes and deletes
  todoList.querySelectorAll('input[type="checkbox"]').forEach(chk => {
    chk.addEventListener('change', async () => {
      const id = chk.dataset.id;
      const numId = parseInt(id, 10);
      const todo = (weekData.todos || []).find(t => String(t.id) === String(id) || t.id === numId);
      if (todo) {
        todo.completed = chk.checked;
        saveStateToStorage();
        renderNotes(todoList, weeklyNotesTextarea);
        await ApiClient.toggleTodo(todo.id, chk.checked);
      }
    });
  });

  todoList.querySelectorAll('.delete-todo-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const numId = parseInt(id, 10);
      weekData.todos = (weekData.todos || []).filter(t => String(t.id) !== String(id) && t.id !== numId);
      saveStateToStorage();
      renderNotes(todoList, weeklyNotesTextarea);
      await ApiClient.deleteTodo(id);
    });
  });
}
