import nodemailer from 'nodemailer';
import { describe, expect, it } from 'vitest';
import { sendEntry, sendReminder } from '../src/mailer.js';

function jsonTransport() {
  return nodemailer.createTransport({ jsonTransport: true });
}

interface CapturedMail {
  envelope: { from: string; to: string[] };
  message: string;
}

function captureTransport() {
  const transport = jsonTransport();
  const captured: CapturedMail[] = [];
  const original = transport.sendMail.bind(transport);
  transport.sendMail = async (opts) => {
    const r = (await original(opts)) as unknown as CapturedMail;
    captured.push({ envelope: r.envelope, message: r.message });
    return r;
  };
  return { transport, captured };
}

describe('sendEntry', () => {
  it('subject includes intern name and date', async () => {
    const { transport, captured } = captureTransport();

    await sendEntry(transport, {
      internName: 'David',
      internEmail: 'david@example.com',
      bossEmail: 'boss@example.com',
      fridayDate: '2026-05-15',
      body: 'shipped a lot',
    });

    expect(captured).toHaveLength(1);
    const parsed = JSON.parse(captured[0]!.message);
    expect(parsed.subject).toBe("David's Weekly Journal — Week of 2026-05-15");
    expect(parsed.to[0].address).toBe('boss@example.com');
    expect(parsed.from.address).toBe('david@example.com');
    expect(parsed.text).toBe('shipped a lot');
  });
});

describe('sendReminder', () => {
  it('sends to intern only with reminder subject and entry path in body', async () => {
    const { transport, captured } = captureTransport();

    await sendReminder(transport, {
      internName: 'David',
      internEmail: 'david@example.com',
      fridayDate: '2026-05-15',
      entryFilePath: 'C:\\entries\\2026-05-15.md',
    });

    expect(captured).toHaveLength(1);
    const parsed = JSON.parse(captured[0]!.message);
    expect(parsed.subject).toContain('Reminder');
    expect(parsed.subject).toContain('2026-05-15');
    expect(parsed.to[0].address).toBe('david@example.com');
    expect(parsed.text).toContain('C:\\entries\\2026-05-15.md');
    expect(parsed.text).toContain('David');
  });

  it('omits the "Open it" path line when entryFilePath is not provided', async () => {
    const { transport, captured } = captureTransport();

    await sendReminder(transport, {
      internName: 'David',
      internEmail: 'david@example.com',
      fridayDate: '2026-05-15',
    });

    expect(captured).toHaveLength(1);
    const parsed = JSON.parse(captured[0]!.message);
    expect(parsed.text).not.toContain('Open it:');
    expect(parsed.text).toContain('devjournal write');
    expect(parsed.text).toContain('David');
    expect(parsed.to[0].address).toBe('david@example.com');
  });
});
