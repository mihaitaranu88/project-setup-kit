import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolveCwd, runGuard } from './hook-io.mjs';

const ENV_FILE_TOKEN = /(?<![A-Za-z0-9_.-])\.env(?:\.[A-Za-z0-9._-]+)?(?![A-Za-z0-9_-])/gi;
const ENV_FILE_NAME = /^\.env(?:\..+)?$/i;
const GIT_OPTIONS = '(?:-\\S+(?:\\s+[^-\\s]\\S*)?\\s+)*';
const BROAD_GIT_ADD = new RegExp(
  `\\bgit\\s+${GIT_OPTIONS}add\\s+(?:[^;&|]*\\s)?(?:-A|--all|-u|\\.|:\\/|\\*)(?=\\s|$|[;&|)])|\\bgit\\s+${GIT_OPTIONS}commit\\s+(?:[^;&|]*\\s)?-[a-zA-Z]*a`,
);

export const ALLOWLIST_PATH = join(dirname(fileURLToPath(import.meta.url)), 'env-guard-allowlist.txt');

export function parseAllowlist(text) {
  return new Set(
    text
      .replace(/^﻿/, '')
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'))
      .map(line => line.toLowerCase()),
  );
}

export function loadAllowlist(path = ALLOWLIST_PATH) {
  if (!existsSync(path)) return new Set();
  return parseAllowlist(readFileSync(path, 'utf8'));
}

export function findBlockedEnvFile(text, allowlist) {
  const tokens = [...new Set((text.match(ENV_FILE_TOKEN) ?? []).map(token => token.toLowerCase().replace(/\.$/, '')))];
  return tokens.find(token => !allowlist.has(token)) ?? null;
}

export function isBroadGitAdd(command) {
  return BROAD_GIT_ADD.test(command.replace(/["']/g, ''));
}

export function findUnignoredEnvFiles(cwd, allowlist, isIgnored = defaultIsIgnored) {
  if (!existsSync(cwd)) return [];
  return readdirSync(cwd)
    .filter(name => ENV_FILE_NAME.test(name) && !allowlist.has(name.toLowerCase()))
    .filter(name => !isIgnored(cwd, name));
}

function defaultIsIgnored(cwd, name) {
  return spawnSync('git', ['check-ignore', '-q', name], { cwd }).status === 0;
}

export function checkEnvCall(call, allowlist, isIgnored = defaultIsIgnored) {
  const blocked = findBlockedEnvFile([...call.commands, ...call.paths].join('\n'), allowlist);
  if (blocked) {
    return {
      host: call.host,
      reason: `env-guard: agents may not access ${blocked}. Real env files hold secrets. Use an example file listed in .ai-kit/hooks/env-guard-allowlist.txt, or ask the developer for the variable names.`,
    };
  }
  if (!call.commands.some(isBroadGitAdd)) return null;
  const exposed = findUnignoredEnvFiles(resolveCwd(call), allowlist, isIgnored);
  if (exposed.length === 0) return null;
  return {
    host: call.host,
    reason: `env-guard: ${exposed.join(', ')} is not git-ignored, so this command would stage secrets. Add it to .gitignore first, or stage files by name.`,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  const allowlist = loadAllowlist();
  await runGuard(call => checkEnvCall(call, allowlist));
}
