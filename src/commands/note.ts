import { loadConfig } from '../config.js';
import { formatDate, isWeekend, mostRecentFriday, targetFriday } from '../dates.js';
import { appendNote, notesPath } from '../notes.js';

export function runNote(text: string): void {
  if (!text || !text.trim()) {
    console.error('Usage: devjournal note "<text>"');
    process.exit(1);
  }
  const cfg = loadConfig();
  const now = new Date();
  const friday = isWeekend(now) ? mostRecentFriday(now) : targetFriday(now);
  const file = notesPath(cfg.entriesDir, friday);
  appendNote(file, text, now);
  console.log(`Noted under ${formatDate(friday)} (${file}).`);
}
