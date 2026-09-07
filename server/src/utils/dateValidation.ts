/**
 * Date Sanity Validation Utility
 * Enforces valid calendar dates between 1800-01-01 and 2200-12-31
 */

export const MIN_SUPPORTED_YEAR = 1800;
export const MAX_SUPPORTED_YEAR = 2200;

export function isValidDateRange(dateStr: string | undefined | null): boolean {
  if (!dateStr || typeof dateStr !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;

  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  if (isNaN(year) || year < MIN_SUPPORTED_YEAR || year > MAX_SUPPORTED_YEAR) {
    return false;
  }

  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  const d = new Date(Date.UTC(year, month - 1, day));
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day
  );
}
