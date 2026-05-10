import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { formatDate } from './dates.js';

export function notesPath(rootDir: string, friday: Date): string {
  return join(rootDir, 'notes', `${formatDate(friday)}.md`);
}

export function appendNote(file: string, text: string, now: Date = new Date()): void {
  mkdirSync(dirname(file), { recursive: true });
  const stamp = formatTimestamp(now);
  const cleaned = text.replace(/\s+/g, ' ').trim();
  const line = `- ${stamp} — ${cleaned}\n`;
  appendFileSync(file, line, 'utf8');
}

export function readNotes(file: string): string {
  if (!existsSync(file)) return '';
  return readFileSync(file, 'utf8');
}

function formatTimestamp(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}
