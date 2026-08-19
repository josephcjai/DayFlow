/**
 * DayFlow Focus & Habit Analytics Calculator
 * Dynamically adapts to:
 * 1. Day Mode: Daily KPI, category breakdown, habit points, and 7-day context highlighting active day
 * 2. Week Mode: Weekly KPI, 7-category time distribution, and Mon-Sun consistency trend
 * 3. Month Mode: Monthly KPI aggregation across all weeks, monthly category breakdown, and weekly trend distribution
 */
import { getCurrentWeekData, STATE, getWeekDates, formatDateISO } from './state.js?v=2.4.10';
import { escapeHtml } from './utils.js?v=2.4.10';

const CATEGORIES = [
  { id: 'Learning', name: 'Learning (WPF/WCF/React/Angular)', color: 'var(--cat-learning)' },
  { id: 'Work', name: 'Work / Job Tasks', color: 'var(--cat-work)' },
  { id: 'Household', name: 'Household & Daily Chores', color: 'var(--cat-household)' },
  { id: 'Family', name: 'Family & Personal', color: 'var(--cat-family)' },
  { id: 'Health', name: 'Health & Meals', color: 'var(--cat-health)' },
  { id: 'Travel', name: 'Travel & Commute', color: 'var(--cat-travel)' },
  { id: 'General', name: 'General', color: 'var(--cat-general)' }
];

export function renderAnalytics(
  statPlannedHours,
  statActualHours,
  statScore,
  statHabitPoints,
  categoryBarsContainer,
  habitTotalActionsCount,
  habitBreakdownContainer,
  habitDailyTrendContainer,
  analyticsSubtitle,
  analyticsTrendHeading,
  analyticsTrendSubtitle
) {
  const viewMode = STATE.scheduleViewMode || 'week';
  const selDate = STATE.selectedDate || new Date();
  const selDateISO = formatDateISO(selDate);
  const weekData = getCurrentWeekData();

  let targetSlots = {};
  let targetHabits = [];
  let periodText = '';
  let trendHeadingText = '';
  let trendSubtitleText = '';

  // -------------------------------------------------------------
  // 1. FILTER DATA BY ACTIVE VIEW MODE (Day / Week / Month)
  // -------------------------------------------------------------
  if (viewMode === 'day') {
    const dayFull = selDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
    periodText = `Daily report for ${dayFull}. Showing focus time and habit execution for this day.`;
    trendHeadingText = `7-Day Consistency Context (Focus: ${selDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })})`;
    trendSubtitleText = `Showing daily points with ${selDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} highlighted`;

    // Filter slots for selected day only
    Object.entries(weekData.slots || {}).forEach(([k, s]) => {
      if (k.startsWith(selDateISO)) {
        targetSlots[k] = s;
      }
    });

    // Filter habits for selected day only
    (weekData.habits || []).forEach(h => {
      const logDate = (h.time && h.time.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(h.time))
        ? h.time.slice(0, 10)
        : '';
      if (logDate === selDateISO) {
        targetHabits.push(h);
      }
    });
  } else if (viewMode === 'month') {
    const y = selDate.getFullYear();
    const m = selDate.getMonth();
    const monthPrefix = `${y}-${String(m + 1).padStart(2, '0')}`;
    const monthName = selDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    periodText = `Monthly report for ${monthName}. Showing aggregated focus time and habit execution across the month.`;
    trendHeadingText = `Weekly Habit Distribution in ${monthName}`;
    trendSubtitleText = `Weekly points and actions breakdown across ${monthName}`;

    // Aggregate slots and habits across all weeks in STATE.scheduleData matching this month
    Object.values(STATE.scheduleData || {}).forEach(wData => {
      Object.entries(wData.slots || {}).forEach(([k, s]) => {
        if (k.startsWith(monthPrefix)) {
          targetSlots[k] = s;
        }
      });
      (wData.habits || []).forEach(h => {
        const logDate = (h.time && h.time.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(h.time))
          ? h.time.slice(0, 10)
          : '';
        if (logDate.startsWith(monthPrefix)) {
          targetHabits.push(h);
        }
      });
    });
  } else {
    // Week Mode (Default)
    const dates = getWeekDates(STATE.currentWeekStart);
    const monStr = new Date(dates[0] + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const sunStr = new Date(dates[6] + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    periodText = `Weekly report for Mon, ${monStr} – Sun, ${sunStr}. Showing planned vs. actual execution for this week.`;
    trendHeadingText = `7-Day Habit Activity & Consistency Trend`;
    trendSubtitleText = `Daily points distribution across Monday – Sunday`;

    targetSlots = weekData.slots || {};
    targetHabits = weekData.habits || [];
  }

  // Update dynamic subtitles
  if (analyticsSubtitle) analyticsSubtitle.textContent = periodText;
  if (analyticsTrendHeading) analyticsTrendHeading.textContent = trendHeadingText;
  if (analyticsTrendSubtitle) analyticsTrendSubtitle.textContent = trendSubtitleText;

  // -------------------------------------------------------------
  // 2. SCHEDULE TIME AGGREGATION & CATEGORY BREAKDOWN
  // -------------------------------------------------------------
  const categoryTotals = {};
  CATEGORIES.forEach(c => {
    categoryTotals[c.id] = { plannedMins: 0, actualMins: 0, color: c.color, name: c.name };
  });

  let grandPlannedMins = 0;
  let grandActualMins = 0;

  Object.values(targetSlots).forEach(slot => {
    const cat = slot.category || 'General';
    if (!categoryTotals[cat]) {
      categoryTotals[cat] = { plannedMins: 0, actualMins: 0, color: 'var(--cat-general)', name: cat };
    }
    categoryTotals[cat].plannedMins += (slot.planned || 30);
    categoryTotals[cat].actualMins += (slot.actual || 0);

    grandPlannedMins += (slot.planned || 30);
    grandActualMins += (slot.actual || 0);
  });

  const plannedHrs = (grandPlannedMins / 60).toFixed(1);
  const actualHrs = (grandActualMins / 60).toFixed(1);
  const score = grandPlannedMins > 0 ? Math.min(100, Math.round((grandActualMins / grandPlannedMins) * 100)) : 0;

  if (statPlannedHours) statPlannedHours.textContent = `${plannedHrs} hrs`;
  if (statActualHours) statActualHours.textContent = `${actualHrs} hrs`;
  if (statScore) statScore.textContent = `${score}%`;

  if (categoryBarsContainer) {
    categoryBarsContainer.innerHTML = '';
    Object.keys(categoryTotals).forEach(catId => {
      const data = categoryTotals[catId];
      if (data.plannedMins === 0 && data.actualMins === 0) return;

      const pVal = (data.plannedMins / 60).toFixed(1);
      const aVal = (data.actualMins / 60).toFixed(1);
      const pct = data.plannedMins > 0 ? Math.min(100, Math.round((data.actualMins / data.plannedMins) * 100)) : 0;

      const item = document.createElement('div');
      item.className = 'cat-bar-item';
      item.innerHTML = `
        <div class="cat-bar-header">
          <span><strong style="color: ${data.color}">■</strong> ${data.name}</span>
          <span>Planned: ${pVal}h | <strong>Actual: ${aVal}h</strong> (${pct}%)</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill" style="width: ${pct}%; background-color: ${data.color}"></div>
        </div>
      `;
      categoryBarsContainer.appendChild(item);
    });

    if (categoryBarsContainer.children.length === 0) {
      const emptyLabel = viewMode === 'day' ? 'No scheduled slots recorded for this day.' : (viewMode === 'month' ? 'No scheduled slots recorded for this month.' : 'No scheduled slots found for analytics computation.');
      categoryBarsContainer.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: 1rem;">${emptyLabel}</p>`;
    }
  }

  // -------------------------------------------------------------
  // 3. HABIT POINTS & DISCIPLINE METRICS
  // -------------------------------------------------------------
  let totalHabitPoints = 0;
  const habitStats = {};

  targetHabits.forEach(h => {
    const pts = h.pts || 0;
    totalHabitPoints += pts;

    const name = h.name || 'Habit Action';
    if (!habitStats[name]) {
      habitStats[name] = { count: 0, totalPts: 0 };
    }
    habitStats[name].count += 1;
    habitStats[name].totalPts += pts;
  });

  if (statHabitPoints) {
    statHabitPoints.textContent = `+${totalHabitPoints} pts`;
  }

  if (habitTotalActionsCount) {
    habitTotalActionsCount.textContent = `${targetHabits.length} actions logged`;
  }

  // -------------------------------------------------------------
  // 4. HABIT FREQUENCY & POINTS CONTRIBUTION BREAKDOWN
  // -------------------------------------------------------------
  if (habitBreakdownContainer) {
    habitBreakdownContainer.innerHTML = '';
    const habitEntries = Object.entries(habitStats).sort((a, b) => b[1].totalPts - a[1].totalPts);

    if (habitEntries.length === 0) {
      const emptyHabitLabel = viewMode === 'day' ? 'No habits logged on this date.' : (viewMode === 'month' ? 'No habits logged for this month.' : 'No habit logs recorded for this week yet.');
      habitBreakdownContainer.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: 1rem;">${emptyHabitLabel}</p>`;
    } else {
      habitEntries.forEach(([name, data]) => {
        const pct = totalHabitPoints > 0 ? Math.min(100, Math.round((data.totalPts / totalHabitPoints) * 100)) : 0;

        const item = document.createElement('div');
        item.className = 'habit-bar-item';
        item.innerHTML = `
          <div class="habit-bar-header">
            <span><strong>⭐ ${escapeHtml(name)}</strong></span>
            <div class="habit-bar-meta">
              <span class="habit-count-pill">${data.count}x logged</span>
              <span class="habit-pts-pill">+${data.totalPts} pts (${pct}%)</span>
            </div>
          </div>
          <div class="progress-track">
            <div class="progress-fill" style="width: ${pct}%; background: linear-gradient(90deg, var(--accent-primary), var(--accent-secondary));"></div>
          </div>
        `;
        habitBreakdownContainer.appendChild(item);
      });
    }
  }

  // -------------------------------------------------------------
  // 5. TREND & CONSISTENCY MATRIX (Day / Week / Month)
  // -------------------------------------------------------------
  if (habitDailyTrendContainer) {
    habitDailyTrendContainer.innerHTML = '';

    if (viewMode === 'month') {
      // Month mode: 4-5 weekly distribution blocks
      const y = selDate.getFullYear();
      const m = selDate.getMonth();
      const lastDay = new Date(y, m + 1, 0).getDate();
      const monthHabits = targetHabits;

      const weeklyBlocks = [
        { label: 'Week 1', dateRange: `Days 1–7`, startDay: 1, endDay: 7, pts: 0, count: 0 },
        { label: 'Week 2', dateRange: `Days 8–14`, startDay: 8, endDay: 14, pts: 0, count: 0 },
        { label: 'Week 3', dateRange: `Days 15–21`, startDay: 15, endDay: 21, pts: 0, count: 0 },
        { label: 'Week 4', dateRange: `Days 22–28`, startDay: 22, endDay: 28, pts: 0, count: 0 }
      ];

      if (lastDay > 28) {
        weeklyBlocks.push({ label: 'Week 5', dateRange: `Days 29–${lastDay}`, startDay: 29, endDay: lastDay, pts: 0, count: 0 });
      }

      monthHabits.forEach(h => {
        if (h.time && h.time.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(h.time)) {
          const dayNum = parseInt(h.time.slice(8, 10), 10);
          weeklyBlocks.forEach(b => {
            if (dayNum >= b.startDay && dayNum <= b.endDay) {
              b.pts += (h.pts || 0);
              b.count += 1;
            }
          });
        }
      });

      const maxWeekPts = Math.max(30, ...weeklyBlocks.map(b => b.pts));

      weeklyBlocks.forEach(b => {
        const barHeightPct = Math.min(100, Math.round((b.pts / maxWeekPts) * 100));
        const hasHabits = b.pts > 0;

        const dayCard = document.createElement('div');
        dayCard.className = `daily-trend-day ${hasHabits ? 'has-habits' : ''}`;
        dayCard.innerHTML = `
          <span class="trend-day-name">${b.label}</span>
          <span class="trend-day-date">${b.dateRange}</span>
          <div class="trend-bar-wrapper" title="${b.pts} pts (${b.count} actions)">
            <div class="trend-bar-fill" style="height: ${barHeightPct}%;"></div>
          </div>
          <span class="trend-day-pts">${b.pts > 0 ? `+${b.pts}p` : '0p'}</span>
          <span class="trend-day-count">${b.count > 0 ? `${b.count} acts` : '—'}</span>
        `;
        habitDailyTrendContainer.appendChild(dayCard);
      });

    } else {
      // Day and Week mode: 7 days of the active week
      const weekDates = getWeekDates(STATE.currentWeekStart);
      const dayNames = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
      const todayStr = formatDateISO(new Date());
      const allWeekHabits = weekData.habits || [];

      // Calculate points per day across the active week
      const dailyPoints = weekDates.map(dateStr => {
        let pts = 0;
        let count = 0;
        allWeekHabits.forEach(h => {
          let logDateStr = '';
          if (h.time && h.time.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(h.time)) {
            logDateStr = h.time.slice(0, 10);
          } else {
            logDateStr = weekDates[0];
          }

          if (logDateStr === dateStr) {
            pts += (h.pts || 0);
            count += 1;
          }
        });
        return { dateStr, pts, count };
      });

      const maxDayPts = Math.max(30, ...dailyPoints.map(d => d.pts));

      dailyPoints.forEach((d, idx) => {
        const dayName = dayNames[idx];
        const dObj = new Date(d.dateStr + 'T00:00:00');
        const dateDisplay = dObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const isToday = (d.dateStr === todayStr);
        const isSelected = (viewMode === 'day' && d.dateStr === selDateISO);
        const hasHabits = d.pts > 0;
        const barHeightPct = Math.min(100, Math.round((d.pts / maxDayPts) * 100));

        const dayCard = document.createElement('div');
        dayCard.className = `daily-trend-day ${hasHabits ? 'has-habits' : ''} ${isToday ? 'is-today' : ''} ${isSelected ? 'is-selected-day' : ''}`;
        dayCard.innerHTML = `
          <span class="trend-day-name">${dayName} ${isSelected ? '🎯' : (isToday ? '📍' : '')}</span>
          <span class="trend-day-date">${dateDisplay}</span>
          <div class="trend-bar-wrapper" title="${d.pts} pts earned (${d.count} actions)">
            <div class="trend-bar-fill" style="height: ${barHeightPct}%;"></div>
          </div>
          <span class="trend-day-pts">${d.pts > 0 ? `+${d.pts}p` : '0p'}</span>
          <span class="trend-day-count">${d.count > 0 ? `${d.count} acts` : '—'}</span>
        `;
        habitDailyTrendContainer.appendChild(dayCard);
      });
    }
  }
}
