import { installSkill } from '../skill.js';

export function runInstallSkill(): void {
  const result = installSkill();
  if (result.overwritten) {
    console.log(`Updated existing Claude skill: ${result.path}`);
  } else {
    console.log(`Installed Claude skill: ${result.path}`);
  }
  console.log('Open a new Claude Code session, then try: /journal worked on the chat-log scanner');
}
