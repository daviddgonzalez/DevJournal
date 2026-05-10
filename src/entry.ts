import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { formatDate } from './dates.js';

export const SENTINEL = '<!-- devjournal:unedited -->';
const SCAFFOLD_HEADER = '---';

export interface EntryPaths {
  entriesDir: string;
  entryFile: string;
}

export function entryPaths(rootDir: string, friday: Date): EntryPaths {
  const entriesDir = join(rootDir, 'entries');
  const entryFile = join(entriesDir, `${formatDate(friday)}.md`);
  return { entriesDir, entryFile };
}

export interface TemplateInput {
  internName: string;
  friday: Date;
  chatPrompts: string[];
  midWeekNotes: string;
}

export function buildTemplate(input: TemplateInput): string {
  const dateLabel = formatDate(input.friday);
  const promptBullets =
    input.chatPrompts.length > 0
      ? input.chatPrompts.map((p) => `- ${p}`).join('\n')
      : '_(no recent Claude chats found)_';
  const notesSection =
    input.midWeekNotes.trim().length > 0
      ? input.midWeekNotes.trim()
      : '_(no mid-week notes — capture them next week with `/journal` in Claude Code)_';

  return [
    `# ${input.internName}'s Weekly Journal — Friday, ${dateLabel}`,
    '',
    '## What I shipped this week',
    SENTINEL,
    '',
    '## What got stuck',
    SENTINEL,
    '',
    "## What I don't yet understand",
    SENTINEL,
    '',
    SCAFFOLD_HEADER,
    '### Mid-week notes (from /journal)',
    notesSection,
    '',
    "### Prompt ideas from this week's Claude chats",
    promptBullets,
    '',
  ].join('\n');
}

export function writeTemplateIfMissing(entryFile: string, content: string): boolean {
  if (existsSync(entryFile)) return false;
  mkdirSync(join(entryFile, '..'), { recursive: true });
  writeFileSync(entryFile, content, 'utf8');
  return true;
}

export function hasBeenEdited(entryFile: string): boolean {
  if (!existsSync(entryFile)) return false;
  const content = readFileSync(entryFile, 'utf8');
  return !content.includes(SENTINEL);
}

export function stripScaffolding(content: string): string {
  const lines = content.split('\n');
  const scaffoldIdx = lines.indexOf(SCAFFOLD_HEADER);
  const trimmed = scaffoldIdx === -1 ? lines : lines.slice(0, scaffoldIdx);
  return trimmed.join('\n').replace(/\n+$/, '\n');
}

export function openInEditor(entryFile: string): Promise<void> {
  const editor = process.env.EDITOR || (process.platform === 'win32' ? 'notepad' : 'vi');
  return new Promise((resolve, reject) => {
    const child = spawn(editor, [entryFile], { stdio: 'inherit', shell: true });
    child.on('exit', (code) => {
      if (code === 0 || code === null) resolve();
      else reject(new Error(`Editor exited with code ${code}`));
    });
    child.on('error', reject);
  });
}
