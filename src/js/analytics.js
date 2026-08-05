/**
 * DayFlow Focus Analytics Calculator
 */
import { getCurrentWeekData } from './state.js';

const CATEGORIES = [
  { id: 'Learning', name: 'Learning (WPF/WCF/React/Angular)', color: 'var(--cat-learning)' },
  { id: 'Work', name: 'Work / Job Tasks', color: 'var(--cat-work)' },
  { id: 'Household', name: 'Household & Daily Chores', color: 'var(--cat-household)' },
  { id: 'Family', name: 'Family & Personal', color: 'var(--cat-family)' },
  { id: 'Health', name: 'Health & Meals', color: 'var(--cat-health)' },
  { id: 'Travel', name: 'Travel & Commute', color: 'var(--cat-travel)' },
  { id: 'General', name: 'General', color: 'var(--cat-general)' }
];

export function renderAnalytics(statPlannedHours, statActualHours, statScore, categoryBarsContainer) {
  const weekData = getCurrentWeekData();
  const categoryTotals = {};

  CATEGORIES.forEach(c => {
    categoryTotals[c.id] = { plannedMins: 0, actualMins: 0, color: c.color, name: c.name };
  });

  let grandPlannedMins = 0;
  let grandActualMins = 0;

  Object.values(weekData.slots).forEach(slot => {
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

  statPlannedHours.textContent = `${plannedHrs} hrs`;
  statActualHours.textContent = `${actualHrs} hrs`;
  statScore.textContent = `${score}%`;

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
    categoryBarsContainer.innerHTML = `<p style="color: var(--text-muted); text-align: center;">No scheduled slots found for analytics computation.</p>`;
  }
}
