import { describe, expect, it } from 'vitest';
import { formatDate, mostRecentFriday, parseDate, targetFriday } from '../src/dates.js';

describe('formatDate', () => {
  it('formats as YYYY-MM-DD with zero padding', () => {
    expect(formatDate(new Date(2026, 4, 15))).toBe('2026-05-15');
    expect(formatDate(new Date(2026, 0, 2))).toBe('2026-01-02');
  });
});

describe('parseDate', () => {
  it('round-trips with formatDate', () => {
    const s = '2026-05-15';
    expect(formatDate(parseDate(s))).toBe(s);
  });

  it('throws on invalid input', () => {
    expect(() => parseDate('not-a-date')).toThrow();
  });
});

describe('targetFriday on weekdays', () => {
  const cases: Array<[string, string, string]> = [
    ['Mon 2026-05-11', '2026-05-11', '2026-05-15'],
    ['Tue 2026-05-12', '2026-05-12', '2026-05-15'],
    ['Wed 2026-05-13', '2026-05-13', '2026-05-15'],
    ['Thu 2026-05-14', '2026-05-14', '2026-05-15'],
    ['Fri 2026-05-15', '2026-05-15', '2026-05-15'],
  ];

  for (const [label, now, expected] of cases) {
    it(`${label} -> ${expected}`, () => {
      expect(formatDate(targetFriday(parseDate(now)))).toBe(expected);
    });
  }
});

describe('targetFriday on weekends', () => {
  it('Saturday + past -> previous Friday', () => {
    expect(formatDate(targetFriday(parseDate('2026-05-16'), 'past'))).toBe('2026-05-15');
  });

  it('Sunday + past -> previous Friday', () => {
    expect(formatDate(targetFriday(parseDate('2026-05-17'), 'past'))).toBe('2026-05-15');
  });

  it('Saturday + next -> upcoming Friday', () => {
    expect(formatDate(targetFriday(parseDate('2026-05-16'), 'next'))).toBe('2026-05-22');
  });

  it('Sunday + next -> upcoming Friday', () => {
    expect(formatDate(targetFriday(parseDate('2026-05-17'), 'next'))).toBe('2026-05-22');
  });

  it('throws without weekendChoice on Saturday', () => {
    expect(() => targetFriday(parseDate('2026-05-16'))).toThrow();
  });

  it('throws without weekendChoice on Sunday', () => {
    expect(() => targetFriday(parseDate('2026-05-17'))).toThrow();
  });
});

describe('targetFriday across DST boundary', () => {
  it('US spring-forward (2026-03-08 Sunday) -> next Friday', () => {
    expect(formatDate(targetFriday(parseDate('2026-03-08'), 'next'))).toBe('2026-03-13');
  });

  it('US fall-back (2026-11-01 Sunday) -> next Friday', () => {
    expect(formatDate(targetFriday(parseDate('2026-11-01'), 'next'))).toBe('2026-11-06');
  });
});

describe('mostRecentFriday', () => {
  it('returns same day on Friday', () => {
    expect(formatDate(mostRecentFriday(parseDate('2026-05-15')))).toBe('2026-05-15');
  });

  it('Saturday -> previous day', () => {
    expect(formatDate(mostRecentFriday(parseDate('2026-05-16')))).toBe('2026-05-15');
  });

  it('Monday -> previous Friday', () => {
    expect(formatDate(mostRecentFriday(parseDate('2026-05-18')))).toBe('2026-05-15');
  });

  it('Thursday -> previous Friday', () => {
    expect(formatDate(mostRecentFriday(parseDate('2026-05-14')))).toBe('2026-05-08');
  });
});
