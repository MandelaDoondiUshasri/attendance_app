/**
 * Enterprise Date Utility
 * Formats dates consistently as DD/MM/YYYY across the web application.
 */

/**
 * Format a date string, timestamp, or Date object into DD/MM/YYYY format.
 *
 * @param {string|Date|number|null|undefined} dateInput - The date to format
 * @param {Object} [options] - Optional formatting options
 * @param {boolean} [options.weekday] - Include full weekday name (e.g. "Wednesday, 28/10/2026")
 * @param {boolean} [options.shortWeekday] - Include short weekday name (e.g. "Wed, 28/10/2026")
 * @param {string} [options.fallback='-'] - Fallback string if date is null/undefined/invalid
 * @returns {string} Formatted date in DD/MM/YYYY or fallback
 */
export const formatDate = (dateInput, options = {}) => {
  const { weekday = false, shortWeekday = false, fallback = '-' } = options;

  if (!dateInput) return fallback;

  // Handle date ranges if passed as a single string (e.g. "2026-10-05 to 2026-10-07" or "2026-10-05 → 2026-10-07")
  if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim();

    if (trimmed.includes(' to ')) {
      const [start, end] = trimmed.split(' to ');
      return `${formatDate(start, options)} to ${formatDate(end, options)}`;
    }
    if (trimmed.includes(' → ')) {
      const [start, end] = trimmed.split(' → ');
      return `${formatDate(start, options)} → ${formatDate(end, options)}`;
    }
    if (trimmed.includes(' - ') && !/^\d{4}-\d{2}-\d{2}/.test(trimmed.slice(10))) {
      const [start, end] = trimmed.split(' - ');
      return `${formatDate(start, options)} - ${formatDate(end, options)}`;
    }

    // Direct match for ISO format YYYY-MM-DD to avoid timezone shifting bugs
    const isoDateMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoDateMatch) {
      const [, year, month, day] = isoDateMatch;
      const formatted = `${day}/${month}/${year}`;
      if (weekday || shortWeekday) {
        const dObj = new Date(Number(year), Number(month) - 1, Number(day));
        const wk = dObj.toLocaleDateString('en-US', { weekday: shortWeekday ? 'short' : 'long' });
        return `${wk}, ${formatted}`;
      }
      return formatted;
    }

    // Already in DD/MM/YYYY format
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
      return trimmed;
    }
  }

  // Handle Date objects or other valid timestamp strings/numbers
  try {
    const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (isNaN(d.getTime())) {
      return typeof dateInput === 'string' ? dateInput : fallback;
    }

    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const formatted = `${day}/${month}/${year}`;

    if (weekday || shortWeekday) {
      const wk = d.toLocaleDateString('en-US', { weekday: shortWeekday ? 'short' : 'long' });
      return `${wk}, ${formatted}`;
    }

    return formatted;
  } catch {
    return fallback;
  }
};

/**
 * Format a start and end date as a range in DD/MM/YYYY.
 *
 * @param {string|Date} startDate
 * @param {string|Date} endDate
 * @param {string} [separator=' to ']
 * @returns {string} Formatted range, e.g. "05/10/2026 to 07/10/2026" or "05/10/2026" if equal
 */
export const formatDateRange = (startDate, endDate, separator = ' to ') => {
  if (!startDate && !endDate) return '-';
  if (!endDate || startDate === endDate) return formatDate(startDate);
  if (!startDate) return formatDate(endDate);
  return `${formatDate(startDate)}${separator}${formatDate(endDate)}`;
};

/**
 * Format a date and time string in DD/MM/YYYY, HH:MM AM/PM format.
 *
 * @param {string|Date|number} dateInput
 * @param {Object} [options]
 * @param {boolean} [options.includeSeconds=false]
 * @param {string} [options.fallback='-']
 * @returns {string} e.g. "28/10/2026, 10:45 AM"
 */
export const formatDateTime = (dateInput, options = {}) => {
  const { includeSeconds = false, fallback = '-' } = options;
  if (!dateInput) return fallback;

  try {
    const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (isNaN(d.getTime())) return typeof dateInput === 'string' ? dateInput : fallback;

    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const datePart = `${day}/${month}/${year}`;

    const timeOptions = {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    };
    if (includeSeconds) timeOptions.second = '2-digit';

    const timePart = d.toLocaleTimeString([], timeOptions);
    return `${datePart}, ${timePart}`;
  } catch {
    return fallback;
  }
};

export default formatDate;
