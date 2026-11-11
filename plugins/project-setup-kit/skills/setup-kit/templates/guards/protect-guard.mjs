import { realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadKitConfig, resolveCwd, runGuard } from './hook-io.mjs';

export const DEFAULT_PROTECTED_PATHS = [
  '.ai-kit/**',
  '.ai-kit.json',
  '.claude/settings.json',
  '.claude/settings.local.json',
  '.github/hooks/**',
  '.github/workflows/**',
  '.github/CODEOWNERS',
  '.cursor/hooks.json',
  '.git/hooks/**',
  '.git/config',
  '.husky/**',
  'lefthook.yml',
  '.pre-commit-config.yaml',
  '**/package-lock.json',
  '**/pnpm-lock.yaml',
  '**/yarn.lock',
  '**/composer.lock',
  '**/poetry.lock',
  '**/uv.lock',
  '**/go.sum',
  '**/Cargo.lock',
];

const EDIT_TOOLS = /^(Edit|Write|MultiEdit|NotebookEdit|create|edit|write|apply_patch|beforeFileEdit|afterFileEdit)$/i;
const SHELL_WRITE = /(?:>>?|\btee\b|\bsed\s+-i|\bperl\s+-[a-z]*i|\brm\b|\bmv\b|\bcp\b|\btruncate\b|\bchmod\b|\bln\b|\bgit\s+(?:checkout|restore)\b)/;

export function globToRegex(glob) {
  const pattern = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*\//g, '\u0000')
    .replace(/\*\*/g, '\u0001')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')
    .replace(/\u0000/g, '(?:.*/)?')
    .replace(/\u0001/g, '.*');
  return new RegExp(`^${pattern}$`);
}

export function toRepoPath(path, cwd) {
  const absolute = isAbsolute(path) ? path : resolve(cwd, path);
  return relative(cwd, absolute).split('\\').join('/');
}

export const DEFAULT_UNPROTECTED_PATHS = ['.ai-kit/pending/**'];
export const DEFAULT_ASK_COMMANDS = ['\\bkit\\.mjs\\s+pending\\s+apply\\b'];

export function findProtectedPath(paths, globs, exceptGlobs = []) {
  const matchers = globs.map(globToRegex);
  const exceptions = exceptGlobs.map(globToRegex);
  return (
    paths.find(path => matchers.some(matcher => matcher.test(path)) && !exceptions.some(matcher => matcher.test(path))) ?? null
  );
}

export function findProtectedPathInCommand(command, globs, exceptGlobs = []) {
  if (!SHELL_WRITE.test(command)) return null;
  const tokens = command.split(/[\s;&|()<>"'=]+/).filter(Boolean).map(token => token.replace(/^\.\//, ''));
  return findProtectedPath(tokens, globs, exceptGlobs);
}

export function checkProtectCall(call, config) {
  const settings = config.protectFiles ?? {};
  const globs = settings.paths ?? DEFAULT_PROTECTED_PATHS;
  const exceptGlobs = settings.except ?? DEFAULT_UNPROTECTED_PATHS;
  const cwd = resolveCwd(call);
  const editedPath = EDIT_TOOLS.test(call.toolName)
    ? findProtectedPath(call.paths.map(path => toRepoPath(path, cwd)), globs, exceptGlobs)
    : null;
  const askCommands = (settings.askCommands ?? DEFAULT_ASK_COMMANDS).map(pattern => new RegExp(pattern));
  const askedCommand = call.commands.find(command => askCommands.some(pattern => pattern.test(command)));
  if (askedCommand) {
    return {
      host: call.host,
      decision: settings.mode ?? 'ask',
      reason: `protect-guard: "${askedCommand}" writes protected files (hook settings, git hooks). The developer must approve it.`,
    };
  }
  const commandPath = editedPath ?? call.commands.map(command => findProtectedPathInCommand(command, globs, exceptGlobs)).find(Boolean);
  if (!commandPath) return null;
  return {
    host: call.host,
    decision: settings.mode ?? 'ask',
    reason: `protect-guard: ${commandPath} is protected (agent guards, CI, git hooks or lockfiles). Changing it needs the developer's explicit approval.`,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  const config = loadKitConfig();
  await runGuard(call => checkProtectCall(call, config));
}
