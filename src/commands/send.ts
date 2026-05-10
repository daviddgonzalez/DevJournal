import { readFileSync } from 'node:fs';
import { loadConfig, loadSecrets, type Config } from '../config.js';
import { formatDate, isWeekend, mostRecentFriday, parseDate, targetFriday } from '../dates.js';
import { entryPaths, stripScaffolding } from '../entry.js';
import { createGmailTransport, sendEntry } from '../mailer.js';

export async function runSend(dateArg?: string): Promise<void> {
  const cfg = loadConfig();
  const fridayStr = dateArg ?? defaultFridayString();
  await sendEntryNow(cfg, fridayStr);
}

export async function sendEntryNow(cfg: Config, fridayDate: string): Promise<void> {
  const friday = parseDate(fridayDate);
  const { entryFile } = entryPaths(cfg.entriesDir, friday);
  const content = readFileSync(entryFile, 'utf8');
  const body = stripScaffolding(content);

  const { smtpUser, smtpPass } = loadSecrets(cfg);
  const transport = createGmailTransport({ user: smtpUser, pass: smtpPass });

  await sendEntry(transport, {
    internName: cfg.internName,
    internEmail: cfg.internEmail,
    bossEmail: cfg.bossEmail,
    fridayDate,
    body,
  });
  console.log(`Sent ${entryFile} to ${cfg.bossEmail}.`);
}

function defaultFridayString(): string {
  const now = new Date();
  const friday = isWeekend(now) ? mostRecentFriday(now) : targetFriday(now);
  return formatDate(friday);
}
