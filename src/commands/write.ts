import { confirm, select } from '@inquirer/prompts';
import { readFileSync } from 'node:fs';
import { loadConfig } from '../config.js';
import { scanRecentPrompts } from '../chatlog.js';
import { formatDate, isWeekend, parseDate, targetFriday, type WeekendChoice } from '../dates.js';
import {
  buildTemplate,
  entryPaths,
  hasBeenEdited,
  openInEditor,
  stripScaffolding,
  writeTemplateIfMissing,
} from '../entry.js';
import { notesPath, readNotes } from '../notes.js';
import { sendEntryNow } from './send.js';

export interface WriteOptions {
  weekendChoice?: WeekendChoice;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export async function runWrite(opts: WriteOptions = {}): Promise<void> {
  const cfg = loadConfig();
  const now = new Date();

  let weekendChoice = opts.weekendChoice;
  if (isWeekend(now) && !weekendChoice) {
    weekendChoice = await select<WeekendChoice>({
      message: 'It is the weekend. Which Friday should this entry be dated?',
      choices: [
        { name: 'This past Friday (catching up on the week that just ended)', value: 'past' },
        { name: 'Next Friday (starting next week early)', value: 'next' },
      ],
    });
  }

  const friday = targetFriday(now, weekendChoice);
  const { entryFile } = entryPaths(cfg.entriesDir, friday);
  const notes = readNotes(notesPath(cfg.entriesDir, friday));

  const since = new Date(now.getTime() - 7 * MS_PER_DAY);
  const chatPrompts = await scanRecentPrompts({ since });

  const template = buildTemplate({
    internName: cfg.internName,
    friday,
    chatPrompts,
    midWeekNotes: notes,
  });

  const created = writeTemplateIfMissing(entryFile, template);
  if (created) console.log(`Created: ${entryFile}`);
  else console.log(`Opening existing entry: ${entryFile}`);

  await openInEditor(entryFile);

  if (!hasBeenEdited(entryFile)) {
    console.log('No edits detected (sentinel still present). Not sending.');
    return;
  }

  const send = await confirm({ message: 'Send entry to your boss now?', default: false });
  if (!send) {
    console.log('Saved but not sent. You can send later with `devjournal send`.');
    return;
  }

  await sendEntryNow(cfg, formatDate(friday));
}

export async function runWriteForDate(dateStr: string): Promise<void> {
  const cfg = loadConfig();
  const friday = parseDate(dateStr);
  const { entryFile } = entryPaths(cfg.entriesDir, friday);

  const since = new Date(friday.getTime() - 7 * MS_PER_DAY);
  const chatPrompts = await scanRecentPrompts({ since });
  const notes = readNotes(notesPath(cfg.entriesDir, friday));

  const template = buildTemplate({
    internName: cfg.internName,
    friday,
    chatPrompts,
    midWeekNotes: notes,
  });

  const created = writeTemplateIfMissing(entryFile, template);
  console.log(created ? `Created: ${entryFile}` : `Opening existing entry: ${entryFile}`);
  await openInEditor(entryFile);

  if (!hasBeenEdited(entryFile)) return;
  const send = await confirm({ message: 'Send entry to your boss now?', default: false });
  if (send) await sendEntryNow(cfg, dateStr);
}

export function previewEmailBody(entryFile: string): string {
  const content = readFileSync(entryFile, 'utf8');
  return stripScaffolding(content);
}
