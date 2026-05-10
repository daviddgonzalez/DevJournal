# devjournal

A CLI that prompts you for a weekly Friday journal entry and emails it to your boss.

Designed to work for any intern at any company — `devjournal init` configures your boss's email address, your SMTP credentials, and the cadence.

## Features

- **Weekly Friday entry** — opens a markdown file in your editor, pre-filled with prompt ideas pulled from your recent Claude Code chat logs and any mid-week notes you captured.
- **Mid-week capture** — a `/journal` Claude skill that lets you jot down a note from any Claude Code session; the note shows up in Friday's entry.
- **Automatic email** — sends the entry to your boss over Gmail SMTP.
- **3 PM reminder** — if Friday hits and you haven't written your entry, emails you (not your boss) a nudge.
- **Windows Task Scheduler integration** — `devjournal install-schedule` wires both jobs in once; no manual cron-equivalent setup.

## Quick start

```sh
npm install
npm run build
npm link

devjournal init               # one-time wizard
devjournal install-skill      # registers the /journal Claude skill
devjournal install-schedule   # adds Windows scheduled tasks

devjournal write              # write this Friday's entry
devjournal note "fixed the SMTP TLS thing"   # mid-week scratch note
devjournal send               # send today's entry to your boss
```

## Config

- Non-secret config: `%APPDATA%\devjournal\config.json`
- SMTP credentials: `.env` inside your `entriesDir`
- Entries: `<entriesDir>\entries\YYYY-MM-DD.md` (Friday-dated)
- Mid-week notes: `<entriesDir>\notes\YYYY-MM-DD.md`

For Gmail, you need a Google [App Password](https://myaccount.google.com/apppasswords), not your regular password. Two-factor auth must be enabled on your Google account first.

## Testing

```sh
npm test
npm run lint
```
