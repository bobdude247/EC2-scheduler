export function isValidDate(value) {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

export function parseIsoDate(isoDate) {
  if (typeof isoDate !== 'string') {
    return null;
  }

  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  const parsed = new Date(year, month - 1, day);
  if (!isValidDate(parsed)) {
    return null;
  }

  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) {
    return null;
  }

  return parsed;
}

export function normalizeMonthDate(date) {
  const safeDate = isValidDate(date) ? date : new Date();
  return new Date(safeDate.getFullYear(), safeDate.getMonth(), 1);
}

export function shiftMonth(date, amount) {
  const base = normalizeMonthDate(date);
  return new Date(base.getFullYear(), base.getMonth() + amount, 1);
}

export function shiftYear(date, amount) {
  const base = normalizeMonthDate(date);
  return new Date(base.getFullYear() + amount, base.getMonth(), 1);
}
