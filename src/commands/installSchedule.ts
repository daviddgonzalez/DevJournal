import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { installSchedule } from '../schedule.js';

export interface InstallScheduleOptions {
  writeTime?: string;
  reminderTime?: string;
  cliPath?: string;
}

export function runInstallSchedule(opts: InstallScheduleOptions = {}): void {
  const cliPath = opts.cliPath ?? resolveCliPath();
  if (!existsSync(cliPath)) {
    console.error(`CLI entry not found at ${cliPath}. Did you run 'npm run build'?`);
    process.exit(1);
  }

  console.log('Installing Windows scheduled tasks (run as your user — admin not required for /SC WEEKLY).');
  console.log('NOTE: schtasks uses the host\'s local time. If your machine is not on Eastern Time, override --time-write / --time-reminder.\n');

  const results = installSchedule({
    writeTime: opts.writeTime ?? '09:00',
    reminderTime: opts.reminderTime ?? '15:00',
    cliPath,
  });

  for (const r of results) {
    if (r.status === 0) console.log(`OK: ${r.task.name} @ ${r.task.time}`);
    else console.error(`FAILED (exit ${r.status}): ${r.task.name}`);
  }

  console.log('\nVerify with: schtasks /Query /TN devjournal-write');
  console.log('Right-click the task in Task Scheduler GUI and pick "Run" to smoke-test now.');
}

function resolveCliPath(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, '..', 'cli.js');
}
