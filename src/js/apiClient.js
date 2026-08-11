/**
 * DayFlow REST API Client
 * Handles authentication & user-isolated database synchronization
 */
const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:5000/api'
  : '/api';

function getAuthHeaders() {
  const token = localStorage.getItem('dayflow_token');
  const headers = { 'Content-Type': 'application/json' };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export const ApiClient = {
  async register(email, password, displayName) {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, displayName })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed');
    return data;
  },

  async login(email, password) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    return data;
  },

  async fetchCurrentUser() {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: getAuthHeaders(),
        signal: AbortSignal.timeout(1500)
      });
      if (res.ok) {
        const data = await res.json();
        return data.user;
      }
    } catch (e) {}
    return null;
  },

  async checkHealth() {
    try {
      const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(1500) });
      return res.ok;
    } catch {
      return false;
    }
  },

  async fetchWeekSchedule(weekStart) {
    try {
      const res = await fetch(`${API_BASE}/schedule/week/${weekStart}`, {
        headers: getAuthHeaders(),
        signal: AbortSignal.timeout(2000)
      });
      if (res.ok) {
        const data = await res.json();
        return data.slots;
      }
    } catch (e) {
      console.log('Using offline storage for schedule data');
    }
    return null;
  },

  async saveSlot(weekStart, slotKey, slotData) {
    try {
      await fetch(`${API_BASE}/schedule/slot`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ weekStart, slotKey, ...slotData })
      });
    } catch (e) {
      console.log('Saved slot to offline storage');
    }
  },

  async deleteSlot(weekStart, slotKey) {
    try {
      await fetch(`${API_BASE}/schedule/slot`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        body: JSON.stringify({ weekStart, slotKey })
      });
    } catch (e) {
      console.log('Cleared slot from offline storage');
    }
  },

  async fetchHabits(weekStart) {
    try {
      const res = await fetch(`${API_BASE}/habits/week/${weekStart}`, {
        headers: getAuthHeaders(),
        signal: AbortSignal.timeout(2000)
      });
      if (res.ok) {
        const data = await res.json();
        return data.habits;
      }
    } catch (e) {
      console.log('Using offline storage for habit logs');
    }
    return null;
  },

  async logHabit(weekStart, name, pts, notes) {
    try {
      await fetch(`${API_BASE}/habits/log`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ weekStart, name, pts, notes })
      });
    } catch (e) {
      console.log('Logged habit offline');
    }
  },

  async deleteHabit(id) {
    try {
      await fetch(`${API_BASE}/habits/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
    } catch (e) {
      console.log('Deleted habit offline');
    }
  },

  async fetchTodosAndNotes(weekStart) {
    try {
      const res = await fetch(`${API_BASE}/todos/week/${weekStart}`, {
        headers: getAuthHeaders(),
        signal: AbortSignal.timeout(2000)
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.log('Using offline storage for todos/notes');
    }
    return null;
  },

  async addTodo(weekStart, text) {
    try {
      const res = await fetch(`${API_BASE}/todos/todo`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ weekStart, text })
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.log('Saved todo offline');
    }
    return null;
  },

  async toggleTodo(id, completed) {
    try {
      await fetch(`${API_BASE}/todos/${id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ completed })
      });
    } catch (e) {
      console.log('Toggled todo offline');
    }
  },

  async deleteTodo(id) {
    try {
      await fetch(`${API_BASE}/todos/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
    } catch (e) {
      console.log('Deleted todo offline');
    }
  },

  async saveNotes(weekStart, notes) {
    try {
      await fetch(`${API_BASE}/todos/notes`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ weekStart, notes })
      });
    } catch (e) {
      console.log('Saved notes offline');
    }
  }
};
