import { confirm, input, password } from '@inquirer/prompts';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { configPath, defaultEntriesDir, saveConfig, writeEnvFile, type Config } from '../config.js';
import { formatDate, targetFriday } from '../dates.js';
import { installSkill } from '../skill.js';

export async function runInit(): Promise<void> {
  console.log('Welcome to devjournal. This wizard sets up your weekly journal CLI.\n');

  if (existsSync(configPath())) {
    const overwrite = await confirm({
      message: `Config already exists at ${configPath()}. Overwrite?`,
      default: false,
    });
    if (!overwrite) {
      console.log('Aborted. Existing config left in place.');
      return;
    }
  }

  const internName = await input({ message: 'Your name?', validate: nonEmpty });
  const internEmail = await input({ message: 'Your email (for reminders)?', validate: looksLikeEmail });
  const bossEmail = await input({ message: "Your boss's email (where weekly journals will go)?", validate: looksLikeEmail });
  const smtpUser = await input({
    message: 'Gmail address to send FROM (usually same as your email)?',
    default: internEmail,
    validate: looksLikeEmail,
  });

  console.log('\nFor SMTP password, use a Google App Password (NOT your regular password).');
  console.log('Generate one at: https://myaccount.google.com/apppasswords\n');
  const smtpPass = await password({
    message: 'Google App Password (16 chars, spaces optional):',
    mask: '*',
    validate: (value: string) => {
      const stripped = value.replace(/\s+/g, '');
      if (stripped.length !== 16) {
        return `Expected 16 characters, got ${stripped.length}. App Passwords are exactly 16 chars after removing spaces.`;
      }
      if (!/^[a-zA-Z0-9]+$/.test(stripped)) {
        return 'App Password should be letters/digits only. Did you paste a file path or other text by mistake?';
      }
      return true;
    },
  });

  const intervalDays = Number(
    await input({
      message: 'Days between entries (default 7)?',
      default: '7',
      validate: (v) => /^\d+$/.test(v) && Number(v) > 0 || 'Enter a positive integer',
    }),
  );

  const defaultEntries = defaultEntriesDir();
  const entriesDir = await input({
    message: `Where should entries and notes live?`,
    default: defaultEntries,
  });

  const startDate = await input({
    message: 'First Friday for entries (YYYY-MM-DD)?',
    default: formatDate(nextFriday(new Date())),
    validate: (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) || 'Use YYYY-MM-DD',
  });

  const cfg: Config = {
    internName,
    bossEmail,
    internEmail,
    intervalDays,
    startDate,
    entriesDir,
    smtpUser,
  };

  saveConfig(cfg);
  writeEnvFile(cfg, smtpPass.replace(/\s+/g, ''));
  console.log(`\nConfig saved: ${configPath()}`);
  console.log(`SMTP creds saved: ${join(entriesDir, '.env')}`);

  const installSkillNow = await confirm({
    message: 'Install the /journal Claude skill now (lets you capture mid-week notes from Claude Code)?',
    default: true,
  });
  if (installSkillNow) {
    const result = installSkill();
    console.log(`Claude skill installed: ${result.path}${result.overwritten ? ' (overwritten)' : ''}`);
  }

  console.log('\nNext: run `devjournal install-schedule` to wire up Windows Task Scheduler.');
  console.log('Or: run `devjournal write` to write your first entry now.');
  void homedir;
}

function nonEmpty(v: string): true | string {
  return v.trim().length > 0 || 'Required';
}

function looksLikeEmail(v: string): true | string {
  return /.+@.+\..+/.test(v) || 'Looks like an invalid email address';
}

function nextFriday(now: Date): Date {
  const day = now.getDay();
  if (day === 5) return targetFriday(now);
  if (day === 6 || day === 0) return targetFriday(now, 'next');
  return targetFriday(now);
}
