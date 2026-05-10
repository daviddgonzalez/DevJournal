import { loadConfig, loadSecrets } from '../config.js';
import { formatDate, isWeekend, parseDate, targetFriday } from '../dates.js';
import { entryPaths, hasBeenEdited } from '../entry.js';
import { createGmailTransport, sendReminder } from '../mailer.js';

export async function runCheckReminder(): Promise<void> {
  const cfg = loadConfig();
  const now = new Date();

  if (isWeekend(now)) {
    console.log('Weekend — skipping reminder check.');
    return;
  }

  if (now.getDay() !== 5) {
    console.log('Not Friday — skipping reminder check.');
    return;
  }

  const start = parseDate(cfg.startDate);
  if (now < start) {
    console.log(`Before configured start date ${cfg.startDate} — skipping reminder.`);
    return;
  }

  const friday = targetFriday(now);
  const { entryFile } = entryPaths(cfg.entriesDir, friday);

  if (hasBeenEdited(entryFile)) {
    console.log(`Entry already written for ${formatDate(friday)} — no reminder needed.`);
    return;
  }

  const { smtpUser, smtpPass } = loadSecrets(cfg);
  const transport = createGmailTransport({ user: smtpUser, pass: smtpPass });

  await sendReminder(transport, {
    internName: cfg.internName,
    internEmail: cfg.internEmail,
    fridayDate: formatDate(friday),
    entryFilePath: entryFile,
  });
  console.log(`Reminder sent to ${cfg.internEmail}.`);
}
