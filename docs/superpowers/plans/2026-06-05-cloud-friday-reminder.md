# Cloud Friday Reminder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the weekly journal reminder off the intern's laptop to a GitHub Actions scheduled workflow that unconditionally emails them every Friday, reusing the verified `mailer.ts` send path.

**Architecture:** A new `devjournal remind` CLI command reads its config from environment variables (not the laptop's `config.json`, which CI can't see), computes this week's Friday, and sends the existing reminder email. A GitHub Actions workflow runs it on a Friday cron. The reminder email body is made path-agnostic since the cloud has no local file path.

**Tech Stack:** TypeScript (ESM), Commander, Nodemailer, Vitest, GitHub Actions.

Spec: `docs/superpowers/specs/2026-06-05-cloud-friday-reminder-design.md`

---

### Task 1: Make `entryFilePath` optional in `sendReminder`

**Goal:** The reminder email works with or without a local file path; when absent (cloud runs), it omits the "Open it: <path>" line but keeps the actionable instructions.

**Files:**
- Modify: `src/mailer.ts` (the `ReminderEmail` interface and `sendReminder` body)
- Test: `tests/mailer.test.ts`

**Acceptance Criteria:**
- [ ] `ReminderEmail.entryFilePath` is optional (`?`)
- [ ] With a path: body still contains "Open it: <path>" (existing test stays green)
- [ ] Without a path: body contains no "Open it:" line, still contains "devjournal write" and the intern name
- [ ] `npm test`, `npm run lint`, `npm run typecheck` all pass

**Verify:** `npx vitest run tests/mailer.test.ts` → all tests pass

**Steps:**

- [ ] **Step 1: Write the failing test** — append to `tests/mailer.test.ts` inside the `describe('sendReminder', ...)` block (after the existing `it`):

```typescript
  it('omits the "Open it" path line when entryFilePath is not provided', async () => {
    const transport = jsonTransport();
    const captured: CapturedMail[] = [];
    const original = transport.sendMail.bind(transport);
    transport.sendMail = async (opts) => {
      const r = (await original(opts)) as unknown as CapturedMail;
      captured.push({ envelope: r.envelope, message: r.message });
      return r;
    };

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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/mailer.test.ts`
Expected: TypeScript/compile error or failure — passing a `ReminderEmail` without `entryFilePath` is not allowed yet (the field is required).

- [ ] **Step 3: Make the change in `src/mailer.ts`** — make the field optional and build the body conditionally. Replace the `entryFilePath: string;` line in `ReminderEmail`:

```typescript
export interface ReminderEmail {
  internName: string;
  internEmail: string;
  fridayDate: string;
  entryFilePath?: string;
}
```

Then replace the `const text = [ ... ].join('\n');` block in `sendReminder` with:

```typescript
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/mailer.test.ts`
Expected: PASS (both the existing path test and the new no-path test).

- [ ] **Step 5: Lint + typecheck**

Run: `npm run lint && npm run typecheck`
Expected: no errors, no warnings.

- [ ] **Step 6: Commit**

```bash
git add src/mailer.ts tests/mailer.test.ts
git commit -m "feat(mailer): make reminder entryFilePath optional for cloud runs"
```

---

### Task 2: Add the `devjournal remind` command

**Goal:** A non-interactive, unconditional reminder sender that reads config from environment variables and reuses the existing transport + `sendReminder`. Built for the GitHub Actions job.

**Files:**
- Create: `src/commands/remind.ts`
- Modify: `src/cli.ts` (import + register the `remind` subcommand)
- Test: `tests/remind.test.ts`

**Acceptance Criteria:**
- [ ] `readRemindEnv` returns all four inputs when present; throws an error naming the first missing variable
- [ ] `buildReminder` computes this week's Friday via `mostRecentFriday` and omits `entryFilePath`
- [ ] `runRemind` wires env → build → `createGmailTransport` → `sendReminder`
- [ ] `devjournal remind` is registered in the CLI
- [ ] `npm test`, `npm run lint`, `npm run typecheck` all pass

**Verify:** `npx vitest run tests/remind.test.ts` → all tests pass

**Steps:**

- [ ] **Step 1: Write the failing test** — create `tests/remind.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/remind.test.ts`
Expected: FAIL — cannot resolve `../src/commands/remind.js` (module does not exist yet).

- [ ] **Step 3: Create `src/commands/remind.ts`**

```typescript
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
```

Note: `mostRecentFriday` is used (not `targetFriday`) because it is total — it never throws on a weekend, so a manual `workflow_dispatch` on any day still resolves a sensible Friday. On a Friday (the cron day) it returns that day.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/remind.test.ts`
Expected: PASS (all four tests).

- [ ] **Step 5: Register the command in `src/cli.ts`** — add the import alongside the other command imports:

```typescript
import { runRemind } from './commands/remind.js';
```

Then add this command block (place it right after the existing `check-reminder` command block, before `test-email`):

```typescript
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
```

- [ ] **Step 6: Full test suite + lint + typecheck**

Run: `npm test && npm run lint && npm run typecheck`
Expected: all green, zero warnings.

- [ ] **Step 7: Commit**

```bash
git add src/commands/remind.ts src/cli.ts tests/remind.test.ts
git commit -m "feat(cli): add unconditional 'remind' command for CI"
```

---

### Task 3: Add the GitHub Actions reminder workflow

**Goal:** A scheduled workflow that runs `devjournal remind` every Friday, with a manual trigger for smoke-testing.

**Files:**
- Create: `.github/workflows/reminder.yml`

**Acceptance Criteria:**
- [ ] Triggers on `schedule` (Friday cron) and `workflow_dispatch`
- [ ] Job builds the project and runs `node dist/cli.js remind`
- [ ] SMTP/email values come from `secrets.*`; the intern name is a literal env value
- [ ] YAML is valid (parses without error)

**Verify:** `node -e "const yaml=require('node:fs').readFileSync('.github/workflows/reminder.yml','utf8'); if(!yaml.includes('cron')||!yaml.includes('workflow_dispatch')) throw new Error('missing triggers'); console.log('workflow looks well-formed')"` → prints "workflow looks well-formed"

**Steps:**

- [ ] **Step 1: Create `.github/workflows/reminder.yml`**

```yaml
name: Weekly journal reminder

on:
  schedule:
    # Fridays at 19:00 UTC (~3 PM US Eastern, EDT). Actions cron is UTC and best-effort.
    - cron: '0 19 * * 5'
  workflow_dispatch: {} # manual button for smoke-testing

jobs:
  remind:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: npm
      - run: npm ci
      - run: npm run build
      - name: Send reminder
        run: node dist/cli.js remind
        env:
          DEVJOURNAL_INTERN_NAME: 'David Gonzalez'
          DEVJOURNAL_INTERN_EMAIL: ${{ secrets.DEVJOURNAL_INTERN_EMAIL }}
          DEVJOURNAL_SMTP_USER: ${{ secrets.DEVJOURNAL_SMTP_USER }}
          DEVJOURNAL_SMTP_PASS: ${{ secrets.DEVJOURNAL_SMTP_PASS }}
```

- [ ] **Step 2: Validate the file is well-formed**

Run: `node -e "const yaml=require('node:fs').readFileSync('.github/workflows/reminder.yml','utf8'); if(!yaml.includes('cron')||!yaml.includes('workflow_dispatch')) throw new Error('missing triggers'); console.log('workflow looks well-formed')"`
Expected: prints "workflow looks well-formed".

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/reminder.yml
git commit -m "ci: add weekly Friday reminder workflow"
```

---

### Task 4: Roll out (manual — intern-driven, guided)

**Goal:** Wire up the live secrets, prove the end-to-end path with a manual run, and retire the superseded laptop task.

**Files:** none (GitHub UI + local machine actions)

**Acceptance Criteria:**
- [ ] Repo Secrets `DEVJOURNAL_SMTP_PASS`, `DEVJOURNAL_SMTP_USER`, `DEVJOURNAL_INTERN_EMAIL` exist (GitHub → Settings → Secrets and variables → Actions)
- [ ] A manual `workflow_dispatch` run completes green AND a reminder email arrives on the phone
- [ ] The Windows `devjournal-check-reminder` scheduled task is deleted; `devjournal-write` is kept

**Verify:** Actions run shows green ✅ and the phone's Gmail app shows the reminder notification.

**Steps:**

- [ ] **Step 1: After the PR merges to `master`,** add the three repo Secrets in GitHub (the SMTP password is the 16-char Gmail App Password from the local `.env`; user and intern email are both `ddgonzalez.cs@gmail.com`).
- [ ] **Step 2: Smoke-test** — GitHub → Actions → "Weekly journal reminder" → "Run workflow". Confirm the run is green and the email/phone notification arrives.
- [ ] **Step 3: Retire the laptop task** (from WSL):

```bash
/mnt/c/Windows/System32/schtasks.exe /Delete /TN devjournal-check-reminder /F
```

Keep `devjournal-write` (the Friday 9 AM local editor pop-up) untouched.

---

## Out of scope (future work)

- Stop installing the `check-reminder` task in `schedule.ts` / `installSchedule.ts` so fresh installs don't recreate the dead local job (tracked separately to keep this change focused).
- The "smart"/conditional reminder (only nudge if no journal email went to the boss this week) — a future change, likely a Claude routine with a Gmail connector.
