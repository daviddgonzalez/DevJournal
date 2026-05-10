import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import envPaths from 'env-paths';
import { z } from 'zod';
import { config as loadDotenv } from 'dotenv';

export const ConfigSchema = z.object({
  internName: z.string().min(1),
  bossEmail: z.string().email(),
  internEmail: z.string().email(),
  intervalDays: z.number().int().positive().default(7),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  entriesDir: z.string().min(1),
  smtpUser: z.string().email(),
});

export type Config = z.infer<typeof ConfigSchema>;

const paths = envPaths('devjournal', { suffix: '' });

export function configPath(): string {
  return join(paths.config, 'config.json');
}

export function defaultEntriesDir(): string {
  return join(homedir(), 'devjournal-entries');
}

export function loadConfig(): Config {
  const path = configPath();
  if (!existsSync(path)) {
    throw new Error(`No config found at ${path}. Run 'devjournal init' first.`);
  }
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  return ConfigSchema.parse(raw);
}

export function saveConfig(cfg: Config): void {
  const path = configPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(cfg, null, 2), 'utf8');
}

export function configExists(): boolean {
  return existsSync(configPath());
}

export function envFilePath(cfg: Config): string {
  return join(cfg.entriesDir, '.env');
}

export interface Secrets {
  smtpUser: string;
  smtpPass: string;
}

export function loadSecrets(cfg: Config): Secrets {
  const envFile = envFilePath(cfg);
  if (existsSync(envFile)) {
    loadDotenv({ path: envFile, override: true });
  }
  const smtpUser = process.env.DEVJOURNAL_SMTP_USER ?? cfg.smtpUser;
  const smtpPass = process.env.DEVJOURNAL_SMTP_PASS;
  if (!smtpPass) {
    throw new Error(
      `SMTP password not found. Expected DEVJOURNAL_SMTP_PASS in ${envFile}.`,
    );
  }
  return { smtpUser, smtpPass };
}

export function writeEnvFile(cfg: Config, smtpPass: string): void {
  const envFile = envFilePath(cfg);
  mkdirSync(dirname(envFile), { recursive: true });
  const content = `DEVJOURNAL_SMTP_USER=${cfg.smtpUser}\nDEVJOURNAL_SMTP_PASS=${smtpPass}\n`;
  writeFileSync(envFile, content, { encoding: 'utf8', mode: 0o600 });
}
