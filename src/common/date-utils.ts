/**
 * Date utility functions for IST timezone handling
 * 
 * Database stores dates as plain DATE type (no timezone)
 * Application works in IST (Asia/Kolkata timezone)
 * 
 * These utilities ensure consistent date handling across the application
 */

/**
 * Get current date in IST as YYYY-MM-DD string
 */
export function getTodayIST(): string {
  const now = new Date();
  const istDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  return formatDate(istDate);
}

/**
 * Get first day of current month in IST as YYYY-MM-DD string
 */
export function getCurrentMonthStartIST(): string {
  const now = new Date();
  const istDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  return `${istDate.getFullYear()}-${String(istDate.getMonth() + 1).padStart(2, '0')}-01`;
}

/**
 * Format a Date object as YYYY-MM-DD string
 */
export function formatDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * Parse a date string (YYYY-MM-DD) to Date object in IST
 */
export function parseDateIST(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Get month start date as YYYY-MM-DD string
 */
export function getMonthStart(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-01`;
}

/**
 * Get month end date as YYYY-MM-DD string
 */
export function getMonthEnd(year: number, month: number): string {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
}

/**
 * Get date N months ago from current IST date
 */
export function getMonthsAgoIST(months: number): string {
  const now = new Date();
  const istDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const targetDate = new Date(istDate.getFullYear(), istDate.getMonth() - months, istDate.getDate());
  return formatDate(targetDate);
}

/**
 * Get date N days ago from current IST date
 */
export function getDaysAgoIST(days: number): string {
  const now = new Date();
  const istDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const targetDate = new Date(istDate.getFullYear(), istDate.getMonth(), istDate.getDate() - days);
  return formatDate(targetDate);
}

/**
 * Convert a date string from frontend (which may be in user's timezone) to IST date string
 * This ensures dates are stored consistently in the database
 */
export function normalizeToIST(dateStr: string): string {
  // If the date string already looks like YYYY-MM-DD, return as-is
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  
  // Otherwise parse and convert to IST
  const date = new Date(dateStr);
  const istDate = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  return formatDate(istDate);
}

/**
 * Get current IST Date object
 */
export function getNowIST(): Date {
  const now = new Date();
  return new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
}
