import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeMonthDate, parseIsoDate, shiftMonth, shiftYear } from '../src/calendar-utils.js';

test('parseIsoDate returns valid Date for strict YYYY-MM-DD', () => {
  const parsed = parseIsoDate('2026-03-20');
  assert.ok(parsed instanceof Date);
  assert.equal(parsed.getFullYear(), 2026);
  assert.equal(parsed.getMonth(), 2);
  assert.equal(parsed.getDate(), 20);
});

test('parseIsoDate rejects impossible dates and malformed strings', () => {
  assert.equal(parseIsoDate('2026-02-30'), null);
  assert.equal(parseIsoDate('2026-2-3'), null);
  assert.equal(parseIsoDate('bad-input'), null);
  assert.equal(parseIsoDate(''), null);
});

test('shiftMonth pages backward and forward across year boundaries', () => {
  const january = new Date(2026, 0, 15);
  const prev = shiftMonth(january, -1);
  const next = shiftMonth(january, 1);

  assert.equal(prev.getFullYear(), 2025);
  assert.equal(prev.getMonth(), 11);
  assert.equal(prev.getDate(), 1);

  assert.equal(next.getFullYear(), 2026);
  assert.equal(next.getMonth(), 1);
  assert.equal(next.getDate(), 1);
});

test('shiftYear preserves month and normalizes day to first of month', () => {
  const march = new Date(2026, 2, 20);
  const prevYear = shiftYear(march, -1);
  const nextYear = shiftYear(march, 1);

  assert.equal(prevYear.getFullYear(), 2025);
  assert.equal(prevYear.getMonth(), 2);
  assert.equal(prevYear.getDate(), 1);

  assert.equal(nextYear.getFullYear(), 2027);
  assert.equal(nextYear.getMonth(), 2);
  assert.equal(nextYear.getDate(), 1);
});

test('normalizeMonthDate returns current month when date is invalid', () => {
  const invalid = new Date('not-a-date');
  const normalized = normalizeMonthDate(invalid);

  assert.equal(normalized.getDate(), 1);
  assert.ok(Number.isFinite(normalized.getFullYear()));
  assert.ok(Number.isFinite(normalized.getMonth()));
});
