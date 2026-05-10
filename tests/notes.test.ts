import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { appendNote, notesPath, readNotes } from '../src/notes.js';

let workDir: string;

beforeEach(async () => {
  workDir = await mkdtemp(join(tmpdir(), 'devjournal-notes-'));
});

describe('notesPath', () => {
  it('builds <rootDir>/notes/<friday>.md', () => {
    const p = notesPath('/root', new Date(2026, 4, 15));
    expect(p.endsWith(join('notes', '2026-05-15.md'))).toBe(true);
  });
});

describe('appendNote', () => {
  it('creates file with timestamped bullet', () => {
    const file = join(workDir, 'notes', '2026-05-15.md');
    appendNote(file, 'fixed SMTP TLS', new Date(2026, 4, 13, 10, 14));
    const content = readNotes(file);
    expect(content).toBe('- 2026-05-13 10:14 — fixed SMTP TLS\n');
  });

  it('appends multiple bullets', () => {
    const file = join(workDir, 'notes', '2026-05-15.md');
    appendNote(file, 'first', new Date(2026, 4, 13, 10, 0));
    appendNote(file, 'second', new Date(2026, 4, 14, 14, 30));
    const lines = readNotes(file).trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('first');
    expect(lines[1]).toContain('second');
  });

  it('collapses whitespace in note text', () => {
    const file = join(workDir, 'notes', '2026-05-15.md');
    appendNote(file, 'has\nnewlines\tand   spaces', new Date(2026, 4, 13, 10, 0));
    expect(readNotes(file)).toContain('has newlines and spaces');
  });
});

describe('readNotes', () => {
  it('returns empty string when file missing', () => {
    expect(readNotes(join(workDir, 'missing.md'))).toBe('');
  });
});
