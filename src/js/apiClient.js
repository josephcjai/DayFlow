/**
 * DayFlow REST API Client
 * Handles authentication & user-isolated database synchronization
 */
const API_BASE = (typeof window !== 'undefined' && window.__DAYFLOW_API_URL__)
  ? window.__DAYFLOW_API_URL__
  : ((typeof window !== 'undefined' && window.location.protocol === 'http:' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && window.location.port === '8080')
    ? 'http://localhost:5000/api'
    : '/api');

function getAuthHeaders() {
  const token = localStorage.getItem('dayflow_token');
  const headers = { 'Content-Type': 'application/json' };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export function isDemoMode() {
  try {
    return (typeof localStorage !== 'undefined' && localStorage.getItem('dayflow_token') === 'demo-token')
      || (typeof window !== 'undefined' && (window.location.search.includes('demo=true') || window.location.hash.includes('demo')));
  } catch (e) {
    return false;
  }
}

function checkUnauthorized(res) {
  if (res && res.status === 401) {
    if (isDemoMode()) {
      return true; // Ignore 401 in demo mode, never trigger session expiry
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('dayflow:session-expired'));
    }
    return true;
  }
  return false;
}

// Serialized promise queue per weekStart to guarantee strict FIFO delivery of note updates
const notesSaveChains = new Map();

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

  async getAuthConfig() {
    try {
      const res = await fetch(`${API_BASE}/auth/config`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('Could not fetch auth config:', e);
    }
    return { googleClientId: '' };
  },

  async googleLogin(credential) {
    const res = await fetch(`${API_BASE}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Google authentication failed');
    return data;
  },

  async fetchCurrentUser() {
    if (isDemoMode()) {
      return { id: 1, email: 'demo@dayflow.app', displayName: 'Demo User' };
    }
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: getAuthHeaders(),
        signal: AbortSignal.timeout(1500)
      });
      if (checkUnauthorized(res)) return null;
      if (res.ok) {
        const data = await res.json();
        return data.user;
      }
    } catch (e) {}
    return null;
  },

  async changePassword(currentPassword, newPassword) {
    if (isDemoMode()) return { success: true };
    const res = await fetch(`${API_BASE}/auth/change-password`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ currentPassword, newPassword })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to change password');
    return data;
  },

  async forgotPassword(email) {
    const res = await fetch(`${API_BASE}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to request password reset');
    return data;
  },

  async resetPassword(email, token, newPassword) {
    const res = await fetch(`${API_BASE}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, token, newPassword })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to reset password');
    return data;
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
    if (isDemoMode()) return null;
    try {
      const res = await fetch(`${API_BASE}/schedule/week/${weekStart}`, {
        headers: getAuthHeaders(),
        signal: AbortSignal.timeout(2000)
      });
      if (checkUnauthorized(res)) return null;
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
    if (isDemoMode()) return true;
    try {
      const res = await fetch(`${API_BASE}/schedule/slot`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ weekStart, slotKey, ...slotData })
      });
      if (checkUnauthorized(res)) return false;
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        console.error('❌ Server error saving schedule slot:', res.status, errData.error);
        return false;
      }
      return true;
    } catch (e) {
      console.warn('Network error saving slot to server, saved locally:', e);
      return false;
    }
  },

  async deleteSlot(weekStart, slotKey) {
    if (isDemoMode()) return true;
    try {
      const res = await fetch(`${API_BASE}/schedule/slot`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        body: JSON.stringify({ weekStart, slotKey })
      });
      if (checkUnauthorized(res)) return false;
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        console.error('❌ Server error deleting schedule slot:', res.status, errData.error);
        return false;
      }
      return true;
    } catch (e) {
      console.warn('Network error deleting slot on server, cleared locally:', e);
      return false;
    }
  },

  async fetchHabits(weekStart) {
    if (isDemoMode()) return null;
    try {
      const res = await fetch(`${API_BASE}/habits/week/${weekStart}`, {
        headers: getAuthHeaders(),
        signal: AbortSignal.timeout(2000)
      });
      if (checkUnauthorized(res)) return null;
      if (res.ok) {
        const data = await res.json();
        return data.habits;
      }
    } catch (e) {
      console.log('Using offline storage for habit logs');
    }
    return null;
  },

  async logHabit(weekStart, name, pts, notes, logTime) {
    if (isDemoMode()) return true;
    try {
      const res = await fetch(`${API_BASE}/habits/log`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ weekStart, name, pts, notes, logTime })
      });
      if (checkUnauthorized(res)) return false;
      return res.ok;
    } catch (e) {
      console.log('Logged habit offline');
      return false;
    }
  },

  async deleteHabit(id) {
    if (isDemoMode()) return true;
    try {
      const res = await fetch(`${API_BASE}/habits/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (checkUnauthorized(res)) return false;
      return res.ok;
    } catch (e) {
      console.log('Deleted habit offline');
      return false;
    }
  },

  async fetchTodosAndNotes(weekStart) {
    if (isDemoMode()) return null;
    try {
      const res = await fetch(`${API_BASE}/todos/week/${weekStart}`, {
        headers: getAuthHeaders(),
        signal: AbortSignal.timeout(2000)
      });
      if (checkUnauthorized(res)) return null;
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.log('Using offline storage for todos/notes');
    }
    return null;
  },

  async addTodo(weekStart, text, priority = 'Medium', category = 'General', dueDate = null) {
    if (isDemoMode()) return { id: 'demo_' + Date.now(), text, priority, category, dueDate, completed: false };
    try {
      const res = await fetch(`${API_BASE}/todos/todo`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ weekStart, text, priority, category, dueDate })
      });
      if (checkUnauthorized(res)) return null;
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.log('Saved todo offline');
    }
    return null;
  },

  async toggleTodo(id, completed) {
    if (isDemoMode()) return true;
    try {
      const res = await fetch(`${API_BASE}/todos/${id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ completed })
      });
      if (checkUnauthorized(res)) return false;
      return res.ok;
    } catch (e) {
      console.log('Toggled todo offline');
      return false;
    }
  },

  async updateTodo(id, updates) {
    if (isDemoMode()) return true;
    try {
      const res = await fetch(`${API_BASE}/todos/${id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify(updates)
      });
      if (checkUnauthorized(res)) return false;
      return res.ok;
    } catch (e) {
      console.warn('Updated todo offline:', e);
      return false;
    }
  },

  async deleteTodo(id) {
    if (isDemoMode()) return true;
    try {
      const res = await fetch(`${API_BASE}/todos/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (checkUnauthorized(res)) return false;
      return res.ok;
    } catch (e) {
      console.log('Deleted todo offline');
      return false;
    }
  },

  async saveNotes(weekStart, notes, noteSheets = null) {
    if (isDemoMode()) return true;
    const key = weekStart || 'default';
    const prev = notesSaveChains.get(key) || Promise.resolve();
    const current = prev.catch(() => {}).then(async () => {
      try {
        const res = await fetch(`${API_BASE}/todos/notes`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ weekStart, notes, noteSheets })
        });
        if (checkUnauthorized(res)) return false;
        return res.ok;
      } catch (e) {
        console.log('Saved notes offline');
        return false;
      }
    });

    notesSaveChains.set(key, current);
    try {
      return await current;
    } finally {
      if (notesSaveChains.get(key) === current) {
        notesSaveChains.delete(key);
      }
    }
  }
};
