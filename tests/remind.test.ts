import { describe, expect, it } from 'vitest';
import { buildReminder, readRemindEnv, type RemindInputs } from '../src/commands/remind.js';

const FULL_ENV = {
  DEVJOURNAL_INTERN_NAME: 'David Gonzalez',
  DEVJOURNAL_INTERN_EMAIL: 'david@example.com',
  DEVJOURNAL_SMTP_USER: 'david@example.com',
  DEVJOURNAL_SMTP_PASS: 'app-password-16ch',
} as NodeJS.ProcessEnv;

describe('readRemindEnv', () => {
  it('returns all four inputs when every var is present', () => {
    expect(readRemindEnv(FULL_ENV)).toEqual({
      internName: 'David Gonzalez',
      internEmail: 'david@example.com',
      smtpUser: 'david@example.com',
      smtpPass: 'app-password-16ch',
    });
  });

  it('throws naming the missing variable', () => {
    const partial = { ...FULL_ENV };
    delete partial.DEVJOURNAL_SMTP_PASS;
    expect(() => readRemindEnv(partial)).toThrow('DEVJOURNAL_SMTP_PASS');
  });
});

describe('buildReminder', () => {
  const inputs: RemindInputs = {
    internName: 'David Gonzalez',
    internEmail: 'david@example.com',
    smtpUser: 'david@example.com',
    smtpPass: 'app-password-16ch',
  };

  it('uses this Friday when run on a Friday and omits entryFilePath', () => {
    const friday = new Date(2026, 4, 15); // 2026-05-15 is a Friday
    const email = buildReminder(inputs, friday);
    expect(email.fridayDate).toBe('2026-05-15');
    expect(email.entryFilePath).toBeUndefined();
    expect(email.internEmail).toBe('david@example.com');
    expect(email.internName).toBe('David Gonzalez');
  });

  it('resolves to the most recent Friday when run on a weekend', () => {
    const saturday = new Date(2026, 4, 16); // the day after the 15th
    expect(buildReminder(inputs, saturday).fridayDate).toBe('2026-05-15');
  });
});
