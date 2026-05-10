import type { SpawnSyncReturns } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { buildTasks, installSchedule } from '../src/schedule.js';

describe('buildTasks', () => {
  it('produces two weekly Friday tasks at given times', () => {
    const tasks = buildTasks({
      writeTime: '09:00',
      reminderTime: '15:00',
      cliPath: 'C:\\projects\\devjournal\\dist\\cli.js',
    });
    expect(tasks).toHaveLength(2);
    expect(tasks[0]!.name).toBe('devjournal-write');
    expect(tasks[0]!.args).toContain('/Create');
    expect(tasks[0]!.args).toContain('/F');
    expect(tasks[0]!.args).toContain('FRI');
    expect(tasks[0]!.args).toContain('09:00');
    expect(tasks[1]!.name).toBe('devjournal-check-reminder');
    expect(tasks[1]!.args).toContain('15:00');
    expect(tasks[1]!.args.join(' ')).toContain('check-reminder');
    expect(tasks[1]!.args.join(' ')).toContain('C:\\projects\\devjournal\\dist\\cli.js');
  });
});

describe('installSchedule', () => {
  it('invokes spawn once per task and returns statuses', () => {
    const calls: Array<{ cmd: string; args: string[] }> = [];
    const fakeSpawn = (cmd: string, args: string[]): SpawnSyncReturns<Buffer> => {
      calls.push({ cmd, args });
      return {
        pid: 0,
        output: [],
        stdout: Buffer.from(''),
        stderr: Buffer.from(''),
        status: 0,
        signal: null,
      };
    };

    const results = installSchedule(
      { writeTime: '09:00', reminderTime: '15:00', cliPath: 'C:\\dist\\cli.js' },
      fakeSpawn,
    );

    expect(calls).toHaveLength(2);
    expect(calls[0]!.cmd).toBe('schtasks');
    expect(results.every((r) => r.status === 0)).toBe(true);
  });
});
