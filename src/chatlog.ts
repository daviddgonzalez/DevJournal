import { readdir, readFile, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

export interface ScanOptions {
  since: Date;
  claudeDir?: string;
  maxBullets?: number;
}

const DEFAULT_MAX_BULLETS = 15;
const MAX_PROMPT_LENGTH = 400;
const BULLET_TRUNCATE = 140;

export async function scanRecentPrompts(opts: ScanOptions): Promise<string[]> {
  const claudeDir = opts.claudeDir ?? join(homedir(), '.claude', 'projects');
  const maxBullets = opts.maxBullets ?? DEFAULT_MAX_BULLETS;
  const sinceMs = opts.since.getTime();

  const files = await findJsonlFiles(claudeDir);
  const prompts = new Set<string>();

  for (const file of files) {
    let s;
    try {
      s = await stat(file);
    } catch {
      continue;
    }
    if (s.mtimeMs < sinceMs) continue;

    let raw: string;
    try {
      raw = await readFile(file, 'utf8');
    } catch {
      continue;
    }

    for (const line of raw.split('\n')) {
      const bullet = extractPrompt(line, sinceMs);
      if (bullet) prompts.add(bullet);
      if (prompts.size >= maxBullets) return [...prompts];
    }
  }

  return [...prompts].slice(0, maxBullets);
}

async function findJsonlFiles(root: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }

  const results: string[] = [];
  for (const entry of entries) {
    const full = join(root, entry.name);
    if (entry.isDirectory()) {
      const inner = await readdir(full, { withFileTypes: true }).catch(() => []);
      for (const f of inner) {
        if (f.isFile() && f.name.endsWith('.jsonl')) {
          results.push(join(full, f.name));
        }
      }
    } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
      results.push(full);
    }
  }
  return results;
}

function extractPrompt(line: string, sinceMs: number): string | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(trimmed);
  } catch {
    return null;
  }

  const ts = typeof obj.timestamp === 'string' ? Date.parse(obj.timestamp) : Number.NaN;
  if (!Number.isNaN(ts) && ts < sinceMs) return null;

  const message = obj.message as { role?: string; content?: unknown } | undefined;
  if (!message || message.role !== 'user') return null;

  const text = readMessageText(message.content);
  if (!text) return null;
  if (text.length > MAX_PROMPT_LENGTH) return null;
  if (text.startsWith('<command-') || text.startsWith('<local-command-')) return null;
  if (text.startsWith('<system-')) return null;

  const firstLine = text.split('\n')[0]!.trim();
  if (!firstLine) return null;
  return firstLine.slice(0, BULLET_TRUNCATE);
}

function readMessageText(content: unknown): string | null {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    for (const part of content) {
      if (part && typeof part === 'object' && 'text' in part) {
        const t = (part as { text?: unknown }).text;
        if (typeof t === 'string') return t;
      }
    }
  }
  return null;
}
