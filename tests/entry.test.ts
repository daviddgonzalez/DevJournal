import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildTemplate,
  entryPaths,
  hasBeenEdited,
  SENTINEL,
  stripScaffolding,
  writeTemplateIfMissing,
} from '../src/entry.js';

let workDir: string;

beforeEach(async () => {
  workDir = await mkdtemp(join(tmpdir(), 'devjournal-entry-'));
});

describe('entryPaths', () => {
  it('builds <rootDir>/entries/<friday>.md', () => {
    const friday = new Date(2026, 4, 15);
    const paths = entryPaths('/tmp/foo', friday);
    expect(paths.entryFile.endsWith(join('entries', '2026-05-15.md'))).toBe(true);
  });
});

describe('buildTemplate', () => {
  it('includes intern name, Friday date, and three sentinels', () => {
    const out = buildTemplate({
      internName: 'David',
      friday: new Date(2026, 4, 15),
      chatPrompts: [],
      midWeekNotes: '',
    });
    expect(out).toContain("David's Weekly Journal");
    expect(out).toContain('2026-05-15');
    expect(out.split(SENTINEL).length - 1).toBe(3);
  });

  it('renders chat prompts as bullets', () => {
    const out = buildTemplate({
      internName: 'David',
      friday: new Date(2026, 4, 15),
      chatPrompts: ['fix the smtp thing', 'review chatlog scanner'],
      midWeekNotes: '',
    });
    expect(out).toContain('- fix the smtp thing');
    expect(out).toContain('- review chatlog scanner');
  });

  it('shows fallback when no prompts and no notes', () => {
    const out = buildTemplate({
      internName: 'David',
      friday: new Date(2026, 4, 15),
      chatPrompts: [],
      midWeekNotes: '',
    });
    expect(out).toContain('no recent Claude chats found');
    expect(out).toContain('no mid-week notes');
  });
});

describe('writeTemplateIfMissing', () => {
  it('writes when file does not exist', () => {
    const file = join(workDir, 'entries', '2026-05-15.md');
    const wrote = writeTemplateIfMissing(file, 'hello');
    expect(wrote).toBe(true);
  });

  it('does not overwrite when present', async () => {
    const file = join(workDir, '2026-05-15.md');
    await writeFile(file, 'existing', 'utf8');
    const wrote = writeTemplateIfMissing(file, 'new content');
    expect(wrote).toBe(false);
  });
});

describe('hasBeenEdited', () => {
  it('false when file missing', () => {
    expect(hasBeenEdited(join(workDir, 'nope.md'))).toBe(false);
  });

  it('false when sentinel still present', async () => {
    const file = join(workDir, 'a.md');
    await writeFile(file, `hello\n${SENTINEL}\nworld`, 'utf8');
    expect(hasBeenEdited(file)).toBe(false);
  });

  it('true when no sentinels remain', async () => {
    const file = join(workDir, 'b.md');
    await writeFile(file, 'all real content here', 'utf8');
    expect(hasBeenEdited(file)).toBe(true);
  });
});

describe('stripScaffolding', () => {
  it('removes everything from the scaffolding separator onward', () => {
    const content = [
      '# Header',
      '',
      'real content',
      '',
      '---',
      '### Mid-week notes',
      'scaffolding to strip',
    ].join('\n');
    const stripped = stripScaffolding(content);
    expect(stripped).toContain('real content');
    expect(stripped).not.toContain('Mid-week notes');
    expect(stripped).not.toContain('---');
  });

  it('returns content unchanged when no separator', () => {
    const stripped = stripScaffolding('just text\nno separator');
    expect(stripped).toContain('just text');
  });
});
