import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export function skillDir(): string {
  return join(homedir(), '.claude', 'skills', 'journal');
}

export function skillFilePath(): string {
  return join(skillDir(), 'SKILL.md');
}

export function skillContent(): string {
  return `---
name: journal
description: Capture a mid-week note for this Friday's devjournal entry. Use whenever the user says "/journal <text>" or asks to jot something down for their weekly journal.
---

# /journal — capture a mid-week note

When the user invokes this skill:

1. Determine the note text:
   - If the user passed text along with \`/journal\`, use it verbatim.
   - If not, ask: "What would you like to record for this week's journal?" and wait for their answer.

2. Append the note by running this command via Bash:

\`\`\`
devjournal note "<the note text, with double-quotes escaped>"
\`\`\`

3. Confirm to the user: "Saved to this Friday's journal notes."

## Notes

- The \`devjournal\` CLI must be installed on the user's PATH (\`npm link\` in the devjournal repo).
- The note will appear under "Mid-week notes" when the user runs \`devjournal write\` on Friday.
- If \`devjournal note\` exits non-zero, surface the stderr to the user — they probably haven't run \`devjournal init\` yet.
`;
}

export interface InstallSkillResult {
  path: string;
  overwritten: boolean;
}

export function installSkill(): InstallSkillResult {
  const dir = skillDir();
  const file = skillFilePath();
  const overwritten = existsSync(file);
  mkdirSync(dir, { recursive: true });
  writeFileSync(file, skillContent(), 'utf8');
  return { path: file, overwritten };
}
