import { mkdtemp, mkdir, writeFile, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { scanRecentPrompts } from '../src/chatlog.js';

let workDir: string;

beforeEach(async () => {
  workDir = await mkdtemp(join(tmpdir(), 'devjournal-chatlog-'));
});

afterEach(async () => {
  // best-effort cleanup; vitest sandboxes temp use
});

async function writeJsonl(dir: string, name: string, lines: string[], mtime?: Date): Promise<string> {
  const projDir = join(dir, name);
  await mkdir(projDir, { recursive: true });
  const file = join(projDir, 'session.jsonl');
  await writeFile(file, lines.join('\n'), 'utf8');
  if (mtime) await utimes(file, mtime, mtime);
  return file;
}

describe('scanRecentPrompts', () => {
  it('returns empty array when claudeDir does not exist', async () => {
    const result = await scanRecentPrompts({
      since: new Date('2026-05-08'),
      claudeDir: join(workDir, 'nonexistent'),
    });
    expect(result).toEqual([]);
  });

  it('extracts user prompts within window', async () => {
    const now = new Date('2026-05-15T10:00:00Z');
    const recent = new Date('2026-05-14T10:00:00Z');
    await writeJsonl(workDir, 'proj1', [
      JSON.stringify({ timestamp: recent.toISOString(), message: { role: 'user', content: 'hello world' } }),
      JSON.stringify({ timestamp: recent.toISOString(), message: { role: 'assistant', content: 'assistant reply ignored' } }),
    ], now);

    const result = await scanRecentPrompts({
      since: new Date('2026-05-08'),
      claudeDir: workDir,
    });
    expect(result).toContain('hello world');
    expect(result).not.toContain('assistant reply ignored');
  });

  it('skips malformed JSON lines silently', async () => {
    const now = new Date('2026-05-15T10:00:00Z');
    await writeJsonl(workDir, 'proj1', [
      '{not valid json',
      JSON.stringify({ timestamp: now.toISOString(), message: { role: 'user', content: 'good prompt' } }),
      '',
    ], now);

    const result = await scanRecentPrompts({
      since: new Date('2026-05-08'),
      claudeDir: workDir,
    });
    expect(result).toEqual(['good prompt']);
  });

  it('filters out messages older than since', async () => {
    const now = new Date('2026-05-15T10:00:00Z');
    const old = new Date('2026-04-01T10:00:00Z');
    await writeJsonl(workDir, 'proj1', [
      JSON.stringify({ timestamp: old.toISOString(), message: { role: 'user', content: 'too old' } }),
      JSON.stringify({ timestamp: now.toISOString(), message: { role: 'user', content: 'in window' } }),
    ], now);

    const result = await scanRecentPrompts({
      since: new Date('2026-05-08'),
      claudeDir: workDir,
    });
    expect(result).toEqual(['in window']);
  });

  it('skips command and system tagged prompts', async () => {
    const now = new Date('2026-05-15T10:00:00Z');
    await writeJsonl(workDir, 'proj1', [
      JSON.stringify({ timestamp: now.toISOString(), message: { role: 'user', content: '<command-message>hidden</command-message>' } }),
      JSON.stringify({ timestamp: now.toISOString(), message: { role: 'user', content: '<system-reminder>nope</system-reminder>' } }),
      JSON.stringify({ timestamp: now.toISOString(), message: { role: 'user', content: 'real prompt' } }),
    ], now);

    const result = await scanRecentPrompts({
      since: new Date('2026-05-08'),
      claudeDir: workDir,
    });
    expect(result).toEqual(['real prompt']);
  });

  it('dedupes identical prompts', async () => {
    const now = new Date('2026-05-15T10:00:00Z');
    await writeJsonl(workDir, 'proj1', [
      JSON.stringify({ timestamp: now.toISOString(), message: { role: 'user', content: 'same thing' } }),
      JSON.stringify({ timestamp: now.toISOString(), message: { role: 'user', content: 'same thing' } }),
      JSON.stringify({ timestamp: now.toISOString(), message: { role: 'user', content: 'different' } }),
    ], now);

    const result = await scanRecentPrompts({
      since: new Date('2026-05-08'),
      claudeDir: workDir,
    });
    expect(result).toEqual(['same thing', 'different']);
  });

  it('handles content as array of {text} parts', async () => {
    const now = new Date('2026-05-15T10:00:00Z');
    await writeJsonl(workDir, 'proj1', [
      JSON.stringify({
        timestamp: now.toISOString(),
        message: { role: 'user', content: [{ type: 'text', text: 'array form' }] },
      }),
    ], now);

    const result = await scanRecentPrompts({
      since: new Date('2026-05-08'),
      claudeDir: workDir,
    });
    expect(result).toEqual(['array form']);
  });

  it('caps results at maxBullets', async () => {
    const now = new Date('2026-05-15T10:00:00Z');
    const lines = Array.from({ length: 20 }, (_, i) =>
      JSON.stringify({ timestamp: now.toISOString(), message: { role: 'user', content: `prompt ${i}` } }),
    );
    await writeJsonl(workDir, 'proj1', lines, now);

    const result = await scanRecentPrompts({
      since: new Date('2026-05-08'),
      claudeDir: workDir,
      maxBullets: 5,
    });
    expect(result).toHaveLength(5);
  });

  it('truncates only first line up to 140 chars', async () => {
    const now = new Date('2026-05-15T10:00:00Z');
    const long = 'a'.repeat(200);
    await writeJsonl(workDir, 'proj1', [
      JSON.stringify({ timestamp: now.toISOString(), message: { role: 'user', content: `${long}\nsecond line` } }),
    ], now);

    const result = await scanRecentPrompts({
      since: new Date('2026-05-08'),
      claudeDir: workDir,
    });
    // First line is 200 chars, exceeds MAX_PROMPT_LENGTH (400)? No, 200 < 400.
    // Returned bullet is firstLine.slice(0,140).
    expect(result[0]!.length).toBe(140);
  });
});
