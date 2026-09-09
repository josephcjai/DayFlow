/**
 * DayFlow Notification & Audio Alarms Engine
 * - Web Audio API synthesized chimes (zero external audio file dependency)
 * - HTML5 Desktop Web Notifications with window focus on click
 * - 30-Minute Schedule Slot transition, start, and wrap-up alerts
 * - Interactive in-app actionable toasts
 */
import { STATE, formatDateISO, isSlotTimePassed } from './state.js?v=2.6.3';
import { USER_SETTINGS, saveUserSettings } from './settings.js?v=2.6.3';
import { openTaskModal } from './modal.js?v=2.6.3';
import { showToast } from './utils.js?v=2.6.3';

let audioCtx = null;
let heartbeatTimer = null;
const firedAlerts = new Set(); // e.g. "lead_2026-09-09_09:00", "start_2026-09-09_09:00", "end_2026-09-09_09:00"

/**
 * Lazily initialize Web Audio Context (must be triggered by or resumed on user gesture)
 */
function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Play harmonic synthesized audio chime
 * @param {string} toneName - 'chime' | 'bell' | 'ping' | 'marimba'
 * @param {number} volumePercent - 0 to 100
 */
export function playNotificationSound(toneName = 'chime', volumePercent = 70) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const masterGain = ctx.createGain();
    const normalizedVol = Math.max(0, Math.min(1, (volumePercent / 100) * 0.4)); // prevent clipping
    masterGain.gain.setValueAtTime(normalizedVol, ctx.currentTime);
    masterGain.connect(ctx.destination);

    const now = ctx.currentTime;

    if (toneName === 'ping') {
      // Crisp subtle ping (high-pitched clean sine)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1046.50, now); // C6
      osc.frequency.exponentialRampToValueAtTime(523.25, now + 0.35); // drop to C5

      gain.gain.setValueAtTime(1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.45);

    } else if (toneName === 'bell') {
      // Resonant singing bell with warm harmonics
      const freqs = [659.25, 1318.5, 1977.75]; // E5 + harmonics
      const weights = [0.8, 0.4, 0.15];

      freqs.forEach((f, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, now);

        gain.gain.setValueAtTime(weights[i], now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.6);

        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now);
        osc.stop(now + 1.65);
      });

    } else if (toneName === 'marimba') {
      // Warm 3-note upbeat chord (G4, B4, D5)
      const chord = [392.00, 493.88, 587.33];
      chord.forEach((freq, idx) => {
        const startTime = now + idx * 0.08;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.9, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.5);

        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(startTime);
        osc.stop(startTime + 0.55);
      });

    } else {
      // Default: 'chime' — Dual-tone melodic chime (D5 -> A5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now); // D5
      gain1.gain.setValueAtTime(0.8, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc1.connect(gain1);
      gain1.connect(masterGain);
      osc1.start(now);
      osc1.stop(now + 0.65);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880.00, now + 0.14); // A5
      gain2.gain.setValueAtTime(0.9, now + 0.14);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
      osc2.connect(gain2);
      gain2.connect(masterGain);
      osc2.start(now + 0.14);
      osc2.stop(now + 1.25);
    }
  } catch (err) {
    console.warn('Audio synthesis error:', err);
  }
}

/**
 * Check browser notification permission status
 */
export function getNotificationPermissionStatus() {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission; // 'granted' | 'denied' | 'default'
}

/**
 * Request desktop notification permission from user
 */
export async function requestNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    showToast('Desktop notifications are not supported by this browser.', 'warning');
    return 'unsupported';
  }

  try {
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      USER_SETTINGS.notificationsEnabled = true;
      saveUserSettings(USER_SETTINGS);
      updateNotificationBellUI();
      showToast('🔔 Desktop notifications enabled!', 'success');
      // Play brief test sound to unlock AudioContext
      if (USER_SETTINGS.notificationSound) {
        playNotificationSound(USER_SETTINGS.notificationTone, USER_SETTINGS.notificationVolume);
      }
    } else if (perm === 'denied') {
      USER_SETTINGS.notificationsEnabled = false;
      saveUserSettings(USER_SETTINGS);
      updateNotificationBellUI();
      showToast('Notifications blocked in browser settings.', 'warning');
    }
    return perm;
  } catch (e) {
    console.error('Permission request failed:', e);
    return 'denied';
  }
}

/**
 * Dispatches a native browser notification if granted & enabled
 */
export function dispatchDesktopNotification(title, body, slotKey = null) {
  if (getNotificationPermissionStatus() !== 'granted' || !USER_SETTINGS.notificationsEnabled) {
    return;
  }

  try {
    const notif = new Notification(title, {
      body,
      icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">⏳</text></svg>',
      tag: slotKey ? `dayflow-${slotKey}` : 'dayflow-alert',
      requireInteraction: false
    });

    notif.onclick = () => {
      window.focus();
      notif.close();
      if (slotKey) {
        focusSlotInGrid(slotKey);
      }
    };
  } catch (e) {
    console.warn('Could not dispatch native notification:', e);
  }
}

/**
 * Find and focus a slot cell in the grid
 */
function focusSlotInGrid(slotKey) {
  const td = document.querySelector(`.slot-cell[data-slot-key="${slotKey}"]`);
  if (td) {
    td.scrollIntoView({ behavior: 'smooth', block: 'center' });
    td.classList.add('selected-slot');
    const dayName = td.dataset.dayName || '';
    const timeLabel = td.dataset.timeLabel || '';
    const parts = slotKey.split('_');
    const weekKey = STATE.currentWeekStart ? formatDateISO(STATE.currentWeekStart) : parts[0];
    const slotData = STATE.scheduleData[weekKey]?.slots?.[slotKey];
    openTaskModal(slotKey, dayName, timeLabel, slotData);
  }
}

/**
 * Update the header notification bell icon and state
 */
export function updateNotificationBellUI() {
  const bellIcon = document.getElementById('notificationBellIcon');
  const bellBtn = document.getElementById('notificationBellBtn');
  if (!bellIcon || !bellBtn) return;

  const perm = getNotificationPermissionStatus();
  const isEnabled = USER_SETTINGS.notificationsEnabled && perm === 'granted';
  const hasSound = USER_SETTINGS.notificationSound;

  if (perm === 'denied') {
    bellIcon.textContent = '🔕';
    bellBtn.title = 'Notifications Blocked (Click to see instructions)';
    bellBtn.classList.remove('bell-active');
    bellBtn.classList.add('bell-disabled');
  } else if (isEnabled) {
    bellIcon.textContent = hasSound ? '🔔' : '🔕';
    bellBtn.title = hasSound ? 'Notifications & Sound Active (Click to mute/unmute)' : 'Sound Muted (Click to enable)';
    bellBtn.classList.add('bell-active');
    bellBtn.classList.remove('bell-disabled');
  } else {
    bellIcon.textContent = '🔔';
    bellBtn.title = 'Click to Enable Notifications & Alarms';
    bellBtn.classList.remove('bell-active', 'bell-disabled');
  }
}

/**
 * Check schedule against current clock and trigger appropriate alerts
 */
export function checkScheduleAlerts() {
  if (!USER_SETTINGS.notificationsEnabled && !USER_SETTINGS.notificationSound) {
    return;
  }

  const now = new Date();
  const todayISO = formatDateISO(now);
  const currentHours = now.getHours();
  const currentMins = now.getMinutes();
  const currentSecs = now.getSeconds();
  const currentTimeTotalSecs = currentHours * 3600 + currentMins * 60 + currentSecs;

  // Retrieve today's slots from state
  const allWeeks = Object.values(STATE.scheduleData || {});
  const todaySlots = {};

  allWeeks.forEach(w => {
    Object.entries(w.slots || {}).forEach(([k, s]) => {
      if (k.startsWith(todayISO)) {
        todaySlots[k] = s;
      }
    });
  });

  const leadMinutes = USER_SETTINGS.notifyLeadMinutes !== undefined ? USER_SETTINGS.notifyLeadMinutes : 2;
  const leadSeconds = leadMinutes * 60;

  // Iterate over 24-hour 30-min slots
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      const slotStartTimeKey = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      const slotKey = `${todayISO}_${slotStartTimeKey}`;
      const slotStartSecs = h * 3600 + m * 60;
      const slotEndSecs = slotStartSecs + 30 * 60;

      const slotData = todaySlots[slotKey];
      const taskName = slotData?.plannedTask || slotData?.actualTask || '';

      // 1. LEAD TIME ALERT (e.g. 2 minutes before slot begins)
      if (leadMinutes > 0 && taskName) {
        const leadTriggerSecs = slotStartSecs - leadSeconds;
        const alertKey = `lead_${slotKey}`;
        // Trigger within a 25-second window around the lead time
        if (currentTimeTotalSecs >= leadTriggerSecs && currentTimeTotalSecs < slotStartSecs && !firedAlerts.has(alertKey)) {
          firedAlerts.add(alertKey);
          triggerLeadTimeAlert(slotKey, slotStartTimeKey, taskName, leadMinutes);
        }
      }

      // 2. SLOT START ALARM (at :00 or :30)
      if (taskName) {
        const startAlertKey = `start_${slotKey}`;
        // Trigger if current time is within first 45 seconds of the slot start
        if (currentTimeTotalSecs >= slotStartSecs && currentTimeTotalSecs < slotStartSecs + 45 && !firedAlerts.has(startAlertKey)) {
          firedAlerts.add(startAlertKey);
          triggerSlotStartAlert(slotKey, slotStartTimeKey, taskName, slotData?.category);
        }
      }

      // 3. END-OF-SLOT WRAP-UP ALERT (prompts user to mark Done or log actual)
      if (USER_SETTINGS.notifySlotEnd && taskName && slotData?.status !== 'Done') {
        const endAlertKey = `end_${slotKey}`;
        // Trigger within 45 seconds after the slot finishes
        if (currentTimeTotalSecs >= slotEndSecs && currentTimeTotalSecs < slotEndSecs + 45 && !firedAlerts.has(endAlertKey)) {
          firedAlerts.add(endAlertKey);
          triggerSlotWrapUpAlert(slotKey, slotStartTimeKey, taskName);
        }
      }
    }
  }
}

/**
 * Trigger proactive lead-time reminder
 */
function triggerLeadTimeAlert(slotKey, timeStr, taskName, leadMins) {
  if (USER_SETTINGS.notificationSound) {
    playNotificationSound(USER_SETTINGS.notificationTone, USER_SETTINGS.notificationVolume);
  }

  const title = `⏳ Starting in ${leadMins}m: ${taskName}`;
  const body = `Scheduled for ${timeStr}. Time to wrap up and prepare for your next block!`;

  dispatchDesktopNotification(title, body, slotKey);
  showToast(`⏳ Starting in ${leadMins}m: "${taskName}" (${timeStr})`, 'info', 5000);
}

/**
 * Trigger block start alarm
 */
function triggerSlotStartAlert(slotKey, timeStr, taskName, category = 'General') {
  if (USER_SETTINGS.notificationSound) {
    playNotificationSound(USER_SETTINGS.notificationTone, USER_SETTINGS.notificationVolume);
  }

  const title = `🚀 Block Started: ${taskName}`;
  const body = `Current 30-min block (${timeStr}) [${category}]. Stay focused!`;

  dispatchDesktopNotification(title, body, slotKey);
  showToast(`🚀 Now Starting: "${taskName}" (${timeStr})`, 'success', 5000);
}

/**
 * Trigger slot wrap-up reminder
 */
function triggerSlotWrapUpAlert(slotKey, timeStr, taskName) {
  if (USER_SETTINGS.notificationSound) {
    playNotificationSound(USER_SETTINGS.notificationTone, Math.max(30, (USER_SETTINGS.notificationVolume || 70) * 0.8));
  }

  const title = `✅ Wrap-up: ${taskName}`;
  const body = `30-minute block finished. Mark as Done or record actual time executed!`;

  dispatchDesktopNotification(title, body, slotKey);
  showToast(`✅ Wrap-up Block: Did you complete "${taskName}"?`, 'info', 6000);
}

/**
 * Start the notification heartbeat engine
 */
export function initNotificationEngine() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
  }

  // Update header bell state
  updateNotificationBellUI();

  // Run immediately, then every 20 seconds
  checkScheduleAlerts();
  heartbeatTimer = setInterval(() => {
    checkScheduleAlerts();
  }, 20000);

  // Resume AudioContext on any user click inside window to satisfy autoplay policy
  const unlockAudio = () => {
    getAudioContext();
    document.removeEventListener('click', unlockAudio);
    document.removeEventListener('keydown', unlockAudio);
  };
  document.addEventListener('click', unlockAudio, { once: true });
  document.addEventListener('keydown', unlockAudio, { once: true });
}
