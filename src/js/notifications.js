/**
 * DayFlow Notification & Audio Alarms Engine
 * - Web Audio API synthesized chimes (zero external audio file dependency)
 * - HTML5 Desktop Web Notifications with window focus on click
 * - 30-Minute Schedule Slot transition, start, and wrap-up alerts
 * - Interactive in-app actionable toasts
 */
import { STATE, formatDateISO, isSlotTimePassed } from './state.js?v=2.9.29';
import { USER_SETTINGS, saveUserSettings, isSlotProductive } from './settings.js?v=2.9.29';
import { openTaskModal } from './modal.js?v=2.9.29';
import { showToast } from './utils.js?v=2.9.29';

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
      const frequencies = [659.25, 1318.5, 1977.75]; // E5 + harmonics
      const weights = [0.8, 0.4, 0.15];

      frequencies.forEach((f, i) => {
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
    const notification = new Notification(title, {
      body,
      icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">⏳</text></svg>',
      tag: slotKey ? `dayflow-${slotKey}` : 'dayflow-alert',
      requireInteraction: false
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
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
  const inQuietHours = isQuietHoursActive();

  if (perm === 'denied') {
    bellIcon.textContent = '🔕';
    bellBtn.title = 'Notifications Blocked (Click to see instructions)';
    bellBtn.classList.remove('bell-active');
    bellBtn.classList.add('bell-disabled');
  } else if (inQuietHours && (isEnabled || hasSound)) {
    bellIcon.textContent = '🌙';
    const day = new Date().getDay();
    const isWeekend = (day === 0 || day === 6);
    if (USER_SETTINGS.notifyMuteWeekends && isWeekend) {
      bellBtn.title = '🌙 Weekend Silence Active (Alerts muted for Saturday & Sunday)';
    } else {
      const startH = USER_SETTINGS.notifyStartHour !== undefined ? USER_SETTINGS.notifyStartHour : 8;
      const hour12 = startH % 12 === 0 ? 12 : startH % 12;
      const ampm = startH >= 12 ? 'PM' : 'AM';
      bellBtn.title = `🌙 Quiet Hours Active (Alerts muted until ${hour12}:00 ${ampm})`;
    }
    bellBtn.classList.add('bell-active');
    bellBtn.classList.remove('bell-disabled');
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
 * Check if notifications are currently suppressed (Weekend Mute, Quiet Hours, or Category Filter)
 */
export function getNotificationSuppressionState(now = new Date(), slotData = null) {
  // 1. Check Weekend Mute
  const day = now.getDay(); // 0 is Sunday, 6 is Saturday
  if (USER_SETTINGS.notifyMuteWeekends && (day === 0 || day === 6)) {
    return { suppressed: true, reason: 'weekend', soundOnly: false };
  }

  // 2. Check Productive-Only Filter
  if (USER_SETTINGS.notifyOnlyProductive && slotData && !isSlotProductive(slotData)) {
    return { suppressed: true, reason: 'non_productive', soundOnly: false };
  }

  // 3. Check Active Hours Window (Quiet Hours)
  if (USER_SETTINGS.notifyActiveWindowEnabled !== false) {
    const currentHour = now.getHours();
    const startHour = USER_SETTINGS.notifyStartHour !== undefined ? parseInt(USER_SETTINGS.notifyStartHour, 10) : 8;
    const endHour = USER_SETTINGS.notifyEndHour !== undefined ? parseInt(USER_SETTINGS.notifyEndHour, 10) : 22;

    let inActiveWindow = false;
    if (startHour <= endHour) {
      // Normal daytime range: e.g. 8 to 22 (08:00 AM to 10:00 PM)
      inActiveWindow = (currentHour >= startHour && currentHour < endHour);
    } else {
      // Overnight range: e.g. 20 to 6 (08:00 PM to 06:00 AM)
      inActiveWindow = (currentHour >= startHour || currentHour < endHour);
    }

    if (!inActiveWindow) {
      const mode = USER_SETTINGS.notifyQuietHoursMode || 'full';
      return {
        suppressed: true,
        reason: 'quiet_hours',
        soundOnly: mode === 'sound_only'
      };
    }
  }

  return { suppressed: false, reason: null, soundOnly: false };
}

/**
 * Returns true if the app is currently in quiet hours or weekend mute
 */
export function isQuietHoursActive(now = new Date()) {
  const check = getNotificationSuppressionState(now, null);
  return check.suppressed && (check.reason === 'quiet_hours' || check.reason === 'weekend');
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

  // Prune firedAlerts: retain only today's alerts to prevent unbounded memory growth
  for (const key of firedAlerts) {
    if (!key.includes(todayISO)) {
      firedAlerts.delete(key);
    }
  }

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
        // Trigger if current time is within lead-time window prior to slot start
        if (currentTimeTotalSecs >= leadTriggerSecs && currentTimeTotalSecs < slotStartSecs && !firedAlerts.has(alertKey)) {
          firedAlerts.add(alertKey);
          triggerLeadTimeAlert(slotKey, slotStartTimeKey, taskName, leadMinutes, slotData);
        }
      }

      // 2. SLOT START ALARM (at :00 or :30, resilient to background tab throttling up to 5 mins)
      if (taskName) {
        const startAlertKey = `start_${slotKey}`;
        if (currentTimeTotalSecs >= slotStartSecs && currentTimeTotalSecs < slotStartSecs + 300 && !firedAlerts.has(startAlertKey)) {
          firedAlerts.add(startAlertKey);
          triggerSlotStartAlert(slotKey, slotStartTimeKey, taskName, slotData?.category, slotData);
        }
      }

      // 3. END-OF-SLOT WRAP-UP ALERT (resilient up to 5 mins after slot ends)
      if (USER_SETTINGS.notifySlotEnd && taskName && slotData?.status !== 'Done') {
        const endAlertKey = `end_${slotKey}`;
        if (currentTimeTotalSecs >= slotEndSecs && currentTimeTotalSecs < slotEndSecs + 300 && !firedAlerts.has(endAlertKey)) {
          firedAlerts.add(endAlertKey);
          triggerSlotWrapUpAlert(slotKey, slotStartTimeKey, taskName, slotData);
        }
      }
    }
  }
}

/**
 * Trigger proactive lead-time reminder
 */
function triggerLeadTimeAlert(slotKey, timeStr, taskName, leadMins, slotData = null) {
  const suppression = getNotificationSuppressionState(new Date(), slotData);
  if (suppression.suppressed && !suppression.soundOnly) {
    return;
  }

  if (USER_SETTINGS.notificationSound && !suppression.soundOnly) {
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
function triggerSlotStartAlert(slotKey, timeStr, taskName, category = 'General', slotData = null) {
  const suppression = getNotificationSuppressionState(new Date(), slotData);
  if (suppression.suppressed && !suppression.soundOnly) {
    return;
  }

  if (USER_SETTINGS.notificationSound && !suppression.soundOnly) {
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
function triggerSlotWrapUpAlert(slotKey, timeStr, taskName, slotData = null) {
  const suppression = getNotificationSuppressionState(new Date(), slotData);
  if (suppression.suppressed && !suppression.soundOnly) {
    return;
  }

  if (USER_SETTINGS.notificationSound && !suppression.soundOnly) {
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
    updateNotificationBellUI();
    checkScheduleAlerts();
  }, 20000);

  // Re-check immediately whenever user switches back to this tab (compensates for browser tab throttling)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkScheduleAlerts();
    }
  });

  // Resume AudioContext on any user click inside window to satisfy autoplay policy
  const unlockAudio = () => {
    getAudioContext();
    document.removeEventListener('click', unlockAudio);
    document.removeEventListener('keydown', unlockAudio);
  };
  document.addEventListener('click', unlockAudio, { once: true });
  document.addEventListener('keydown', unlockAudio, { once: true });
}
