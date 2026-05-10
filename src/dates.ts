export type WeekendChoice = 'past' | 'next';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function formatDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) throw new Error(`Invalid YYYY-MM-DD date: ${s}`);
  return new Date(y, m - 1, d);
}

export function isWeekend(now: Date): boolean {
  const day = now.getDay();
  return day === 0 || day === 6;
}

export function targetFriday(now: Date, weekendChoice?: WeekendChoice): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();

  if (day >= 1 && day <= 5) {
    const delta = 5 - day;
    d.setDate(d.getDate() + delta);
    return d;
  }

  if (!weekendChoice) {
    throw new Error('Weekend choice required: pass "past" or "next" when today is Saturday or Sunday.');
  }

  if (weekendChoice === 'past') {
    const delta = day === 6 ? -1 : -2;
    d.setDate(d.getDate() + delta);
    return d;
  }

  const delta = day === 6 ? 6 : 5;
  d.setDate(d.getDate() + delta);
  return d;
}

export function mostRecentFriday(now: Date): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const delta = day >= 5 ? day - 5 : day + 2;
  d.setDate(d.getDate() - delta);
  return d;
}

export function daysAgo(d: Date, now: Date): number {
  return Math.floor((now.getTime() - d.getTime()) / MS_PER_DAY);
}
