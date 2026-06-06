import nodemailer, { type Transporter } from 'nodemailer';

export interface SmtpAuth {
  user: string;
  pass: string;
}

export interface EntryEmail {
  internName: string;
  internEmail: string;
  bossEmail: string;
  fridayDate: string;
  body: string;
}

export interface ReminderEmail {
  internName: string;
  internEmail: string;
  fridayDate: string;
  entryFilePath?: string;
}

export type AnyTransporter = Transporter<unknown> | Transporter;

export function createGmailTransport(auth: SmtpAuth): AnyTransporter {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth,
  });
}

export async function sendEntry(transport: AnyTransporter, email: EntryEmail): Promise<void> {
  const subject = `${email.internName}'s Weekly Journal — Week of ${email.fridayDate}`;
  await transport.sendMail({
    from: `"${email.internName}" <${email.internEmail}>`,
    to: email.bossEmail,
    subject,
    text: email.body,
  });
}

export async function sendReminder(transport: AnyTransporter, email: ReminderEmail): Promise<void> {
  const subject = `Reminder: write this week's journal (${email.fridayDate})`;
  const lines = [
    `Hey ${email.internName},`,
    '',
    `It's Friday and your journal entry for ${email.fridayDate} isn't done yet.`,
    '',
  ];
  if (email.entryFilePath) {
    lines.push(`Open it: ${email.entryFilePath}`, '');
  }
  lines.push('Write it: devjournal write', 'Send it:  devjournal send', '', '— devjournal');
  const text = lines.join('\n');
  await transport.sendMail({
    from: `"devjournal" <${email.internEmail}>`,
    to: email.internEmail,
    subject,
    text,
  });
}
