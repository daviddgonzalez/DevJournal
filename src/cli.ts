#!/usr/bin/env node
import { Command } from 'commander';
import { runCheckReminder } from './commands/checkReminder.js';
import { runRemind } from './commands/remind.js';
import { runInit } from './commands/init.js';
import { runInstallSchedule } from './commands/installSchedule.js';
import { runInstallSkill } from './commands/installSkill.js';
import { runNote } from './commands/note.js';
import { runSend } from './commands/send.js';
import { runWrite, runWriteForDate } from './commands/write.js';

const program = new Command();

program
  .name('devjournal')
  .description("CLI for writing your weekly Friday journal and emailing it to your boss.")
  .version('0.1.0');

program
  .command('init')
  .description('One-time setup: configure boss email, SMTP, and entry directory.')
  .action(async () => {
    await runInit();
  });

program
  .command('write')
  .description('Open this Friday\'s journal entry in your editor, then optionally send.')
  .option('--for <date>', 'Write entry for a specific Friday (YYYY-MM-DD)')
  .option('--past', 'On weekends: target the Friday that just passed')
  .option('--next', 'On weekends: target the next upcoming Friday')
  .action(async (opts: { for?: string; past?: boolean; next?: boolean }) => {
    if (opts.for) {
      await runWriteForDate(opts.for);
      return;
    }
    const weekendChoice = opts.past ? 'past' : opts.next ? 'next' : undefined;
    await runWrite({ weekendChoice });
  });

program
  .command('note <text...>')
  .description('Append a mid-week scratch note to this Friday\'s notes file.')
  .action((text: string[]) => {
    runNote(text.join(' '));
  });

program
  .command('send [date]')
  .description('Send an existing entry to your boss. Defaults to most recent Friday.')
  .action(async (date: string | undefined) => {
    await runSend(date);
  });

program
  .command('check-reminder')
  .description('If today is Friday and this week\'s entry is not written, email yourself a reminder. Non-interactive.')
  .action(async () => {
    await runCheckReminder();
  });

program
  .command('remind')
  .description(
    "Unconditionally send this week's reminder email. Reads config from environment " +
      'variables (DEVJOURNAL_INTERN_NAME / DEVJOURNAL_INTERN_EMAIL / DEVJOURNAL_SMTP_USER / ' +
      "DEVJOURNAL_SMTP_PASS). Intended for the GitHub Actions weekly job.",
  )
  .action(async () => {
    await runRemind();
  });

program
  .command('install-schedule')
  .description('Register Windows Task Scheduler tasks for Friday write (9AM) and reminder check (3PM).')
  .option('--time-write <HH:MM>', 'Time to fire the write task', '09:00')
  .option('--time-reminder <HH:MM>', 'Time to fire the reminder check', '15:00')
  .action((opts: { timeWrite: string; timeReminder: string }) => {
    runInstallSchedule({ writeTime: opts.timeWrite, reminderTime: opts.timeReminder });
  });

program
  .command('install-skill')
  .description('Install the Claude /journal skill at ~/.claude/skills/journal/SKILL.md.')
  .action(() => {
    runInstallSkill();
  });

program.parseAsync().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`Error: ${msg}`);
  process.exit(1);
});
