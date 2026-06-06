import { formatDate, mostRecentFriday } from '../dates.js';
import { createGmailTransport, sendReminder, type ReminderEmail } from '../mailer.js';

export interface RemindInputs {
  internName: string;
  internEmail: string;
  smtpUser: string;
  smtpPass: string;
}

function requireEnv(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key];
  if (!value) {
    throw new Error(
      `Missing required environment variable ${key}. ` +
        `Set it as a GitHub Actions secret before running 'devjournal remind'.`,
    );
  }
  return value;
}

export function readRemindEnv(env: NodeJS.ProcessEnv = process.env): RemindInputs {
  return {
    internName: requireEnv(env, 'DEVJOURNAL_INTERN_NAME'),
    internEmail: requireEnv(env, 'DEVJOURNAL_INTERN_EMAIL'),
    smtpUser: requireEnv(env, 'DEVJOURNAL_SMTP_USER'),
    smtpPass: requireEnv(env, 'DEVJOURNAL_SMTP_PASS'),
  };
}

export function buildReminder(inputs: RemindInputs, now: Date): ReminderEmail {
  return {
    internName: inputs.internName,
    internEmail: inputs.internEmail,
    fridayDate: formatDate(mostRecentFriday(now)),
  };
}

export async function runRemind(now: Date = new Date()): Promise<void> {
  const inputs = readRemindEnv();
  const email = buildReminder(inputs, now);
  const transport = createGmailTransport({ user: inputs.smtpUser, pass: inputs.smtpPass });
  await sendReminder(transport, email);
  console.log(`Reminder sent to ${email.internEmail} for ${email.fridayDate}.`);
}
