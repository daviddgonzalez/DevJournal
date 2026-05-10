import { spawnSync, type SpawnSyncReturns } from 'node:child_process';

export interface ScheduleOptions {
  writeTime: string;
  reminderTime: string;
  cliPath: string;
}

export interface ScheduledTask {
  name: string;
  time: string;
  command: string;
  args: string[];
}

export function buildTasks(opts: ScheduleOptions): ScheduledTask[] {
  const wtPath = 'C:\\Windows\\System32\\wt.exe';
  return [
    {
      name: 'devjournal-write',
      time: opts.writeTime,
      command: 'schtasks',
      args: [
        '/Create',
        '/F',
        '/TN',
        'devjournal-write',
        '/SC',
        'WEEKLY',
        '/D',
        'FRI',
        '/ST',
        opts.writeTime,
        '/TR',
        `"${wtPath}" cmd /k devjournal write`,
      ],
    },
    {
      name: 'devjournal-check-reminder',
      time: opts.reminderTime,
      command: 'schtasks',
      args: [
        '/Create',
        '/F',
        '/TN',
        'devjournal-check-reminder',
        '/SC',
        'WEEKLY',
        '/D',
        'FRI',
        '/ST',
        opts.reminderTime,
        '/TR',
        `node "${opts.cliPath}" check-reminder`,
      ],
    },
  ];
}

export type Spawn = (cmd: string, args: string[]) => SpawnSyncReturns<Buffer>;

const defaultSpawn: Spawn = (cmd, args) => spawnSync(cmd, args, { stdio: 'inherit' });

export interface InstallResult {
  task: ScheduledTask;
  status: number | null;
}

export function installSchedule(opts: ScheduleOptions, spawnImpl: Spawn = defaultSpawn): InstallResult[] {
  const tasks = buildTasks(opts);
  const results: InstallResult[] = [];
  for (const task of tasks) {
    console.log(`> ${task.command} ${task.args.join(' ')}`);
    const r = spawnImpl(task.command, task.args);
    results.push({ task, status: r.status });
  }
  return results;
}
