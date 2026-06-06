# Design: Cloud Friday reminder via GitHub Actions

**Date:** 2026-06-05
**Author:** David Gonzalez (with Claude Code)
**Status:** Approved — ready for implementation planning

## Problem

The existing reminder (`devjournal check-reminder`) runs as a **Windows Task Scheduler**
job on the intern's laptop every Friday at 3 PM. On a laptop this is unreliable: the
machine may be asleep, off, on battery (`No Start On Batteries` is the schtasks default),
or off Wi-Fi at reminder time, and when the job does fail it exits non-zero with the error
discarded — Windows records only `Last Result: 1`, so failures are invisible.

In practice the reminder has fired for exactly one eligible week (2026-05-29, the only
Friday with no entry written) and that run failed silently. The send path itself is sound
— SMTP auth and `sendReminder` were verified working under Windows node — so the fault is
the *delivery vehicle* (a laptop-local scheduler), not the email code.

The reminder needs to run somewhere always-on and notify the device the intern actually
has on them (their phone), independent of the laptop's state.

## Goals

- A weekly reminder email reaches the intern **without any dependency on their laptop**
  being on, awake, plugged in, or online.
- The intern's **phone** surfaces it (via the Gmail app's own push notification).
- **Failures are visible** — a broken run must surface loudly, not silently.
- Reuse the already-verified `mailer.ts` send path; introduce nothing new to trust on the
  email side.

## Non-goals (deferred)

- **Conditional / "smart" reminders** (only nudge if the intern hasn't already emailed
  their boss this week). This requires the scheduler to read Gmail from the cloud and is
  explicitly deferred to a future change. v1 is **unconditional**.
- Replacing the local `devjournal-write` task (the Friday 9 AM editor pop-up). That is a
  local convenience, not a reliability concern, and stays as-is.
- Push via the Claude mobile app. Investigated and ruled out: Claude's mobile push rides
  on Remote Control, which requires the local machine online — incompatible with an
  unattended cloud job. (See "Alternatives considered".)

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Trigger condition | **Unconditional** — email every Friday | Max reliability, zero dependency on inbox/filesystem/connector auth. "Smart" is all new silent-failure modes; defer it. |
| Notification channel | **Email** (Gmail app push on phone) | Reuses the proven SMTP path; zero new infrastructure or apps. |
| Scheduler | **GitHub Actions scheduled workflow** | Deterministic (fixed script, not an LLM), free, no plan dependency, reuses `mailer.ts`, and gives free failure visibility. A real CI learning/portfolio artifact. |
| Config source in CI | **Environment variables** (not `config.json`) | `config.json` lives on the laptop and is not in the repo or CI. CI's source of truth is env vars / Secrets. |
| Reminder time | `cron: '0 19 * * 5'` = **Fri 19:00 UTC ≈ 3 PM EDT** | Actions cron is UTC and best-effort; ±1 hr DST drift is acceptable for a weekly nudge. |

## Architecture

```
GitHub cron (Fri 19:00 UTC)
        │
        ▼
GitHub Actions runner (cloud)
  checkout → setup-node → npm ci → npm run build → `node dist/cli.js remind`
        │  reads DEVJOURNAL_* env vars (from repo Secrets)
        ▼
  remind.ts → createGmailTransport() → sendReminder()  [existing, verified]
        │  Gmail SMTP (smtp.gmail.com:465)
        ▼
  intern's inbox  →  phone's Gmail app push notification 📱
```

## Components

### 1. `src/commands/remind.ts` (new)
`runRemind(): Promise<void>` — the CI-native, unconditional send.

- Reads from environment, throwing a clear error if any required value is missing:
  - `DEVJOURNAL_INTERN_NAME` — greeting name (e.g. "David Gonzalez")
  - `DEVJOURNAL_INTERN_EMAIL` — recipient
  - `DEVJOURNAL_SMTP_USER` — Gmail auth user (sender)
  - `DEVJOURNAL_SMTP_PASS` — Gmail app password
- Computes this week's Friday via existing `dates.targetFriday(new Date())` + `formatDate`.
- Calls `createGmailTransport({ user, pass })` then `sendReminder(transport, {...})` with
  **no** `entryFilePath` (cloud has no local path — see component 3).
- Does **not** call `loadConfig()` and applies **no** Friday/start-date/`hasBeenEdited`
  guards — the cron owns "it's Friday", and v1 is unconditional by design.
- Throws on any failure so the process exits non-zero.

### 2. `src/cli.ts` (modify)
Register a `remind` subcommand:
> "Unconditionally send this week's reminder email. Reads config from environment
> variables (DEVJOURNAL_INTERN_NAME / DEVJOURNAL_INTERN_EMAIL / DEVJOURNAL_SMTP_USER /
> DEVJOURNAL_SMTP_PASS). Intended for the GitHub Actions weekly job."

It calls `runRemind()`. The existing top-level `.catch()` already prints the error and
exits 1.

### 3. `src/mailer.ts` (modify)
Make `ReminderEmail.entryFilePath` optional. When absent, omit the "Open it: <path>" line
and keep the actionable instruction ("run `devjournal write`, then `devjournal send`").
Existing callers that pass a path are unaffected.

### 4. `.github/workflows/reminder.yml` (new)
- Triggers: `schedule: - cron: '0 19 * * 5'` **and** `workflow_dispatch:` (manual
  smoke-test button).
- Single job on `ubuntu-latest`:
  `actions/checkout` → `actions/setup-node` (Node 20, `cache: npm`) → `npm ci` →
  `npm run build` → `node dist/cli.js remind`.
- `env:` for the `remind` step:
  - `DEVJOURNAL_SMTP_PASS: ${{ secrets.DEVJOURNAL_SMTP_PASS }}`
  - `DEVJOURNAL_SMTP_USER: ${{ secrets.DEVJOURNAL_SMTP_USER }}`
  - `DEVJOURNAL_INTERN_EMAIL: ${{ secrets.DEVJOURNAL_INTERN_EMAIL }}`
  - `DEVJOURNAL_INTERN_NAME: 'David Gonzalez'` (not sensitive; plain literal)

### 5. `tests/remind.test.ts` (new)
Vitest, following `tests/mailer.test.ts` patterns:
- Throws when any required env var is missing (one case per var, or a representative set).
- On success, calls `sendReminder` once with the computed Friday date and the env-supplied
  name/email (inject a fake transport / spy; no real SMTP).
- `entryFilePath` is omitted in the reminder payload.

## Data flow

1. GitHub cron fires Friday ~19:00 UTC.
2. Runner builds the project and runs `devjournal remind`.
3. `remind` reads env, computes the Friday date, sends via Gmail SMTP.
4. Email lands in the intern's inbox; the phone's Gmail app push-notifies.
5. The intern writes/sends their journal (existing `devjournal write` / `send` flow).

## Error handling

- Missing env var or SMTP failure → `remind` throws → process exits non-zero → **the
  Actions run shows red and GitHub emails the repo owner** about the failed workflow.
  This converts the original silent `Last Result: 1` into automatic, loud notification.
- `workflow_dispatch` lets us reproduce and watch a run on demand without waiting for
  Friday.

## Testing strategy

- **Unit (TDD):** `tests/remind.test.ts` as above; run `npm test` + `npm run lint`
  (`--max-warnings=0`) + `npm run typecheck`.
- **Integration smoke test:** after Secrets are set, trigger the workflow via
  `workflow_dispatch` and confirm the email arrives on the phone and the run is green.

## Rollout

- **Claude writes** (code): components 1–5.
- **David does** (account/config — guided, not done-for):
  1. Add repo Secrets `DEVJOURNAL_SMTP_PASS`, `DEVJOURNAL_SMTP_USER`,
     `DEVJOURNAL_INTERN_EMAIL` in GitHub → Settings → Secrets and variables → Actions.
  2. Merge, then `workflow_dispatch` to smoke-test.
  3. Delete the superseded Windows `devjournal-check-reminder` scheduled task
     (`schtasks /Delete /TN devjournal-check-reminder /F`). Keep `devjournal-write`.
- Optional follow-up: stop installing the `check-reminder` task in
  `schedule.ts` / `installSchedule.ts` so fresh installs don't recreate the dead job.
  Tracked separately to keep this change focused.

## Alternatives considered

- **Claude Code routine (cloud agent).** The agentic path originally proposed. Rejected
  for v1: needs a Pro/Max+ plan (possible blocker), is a research-preview feature, has
  daily run caps, and is an LLM doing a fixed clerical task (non-determinism with no
  upside for an unconditional send). It becomes the natural home **if/when** we add the
  conditional "smart" version, since that has a real decision to make.
- **Claude mobile-app native push.** Ruled out — tied to Remote Control, which needs the
  laptop online; incompatible with unattended cloud execution.
- **Dedicated push app (ntfy.sh / Telegram).** Viable and "feels" more like an alert, but
  adds a new dependency; email reuses proven infrastructure and was the intern's choice.

## Future work

- **Smart/conditional reminder (option B):** check whether a journal email to the boss
  went out this week and skip the nudge if so. Likely implemented as a Claude routine with
  a pre-authorized Gmail connector, or by extending the Actions job with Gmail API access.
- **Backport** the GitHub Actions reminder pattern into `ts-monorepo-template` if it
  proves useful (a Phase 8 Tier 3 contribution shape).
```

