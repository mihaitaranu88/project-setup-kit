import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));
export const KIT_DIR = resolve(SCRIPTS_DIR, '..');
export const REPO_ROOT = resolve(KIT_DIR, '..');
export const KIT_CONFIG_PATH = join(KIT_DIR, 'config.json');

export function loadKitConfig(path = KIT_CONFIG_PATH) {
  if (!existsSync(path)) return {};
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function git(args, options = {}) {
  return execFileSync('git', args, {
    cwd: options.cwd ?? REPO_ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 256 * 1024 * 1024,
  });
}

export function quoteForShell(value, platform = process.platform) {
  if (platform === 'win32') return `"${value.replace(/"/g, '""')}"`;
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export function isCi() {
  return process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
}

export function readArg(name, fallback = null) {
  const prefix = `--${name}=`;
  const inline = process.argv.find(arg => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0 && process.argv[index + 1] && !process.argv[index + 1].startsWith('--')) {
    return process.argv[index + 1];
  }
  return fallback;
}

export function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

export function resolveBaseRef(config) {
  const explicit = readArg('base') ?? process.env.AI_KIT_BASE_REF;
  if (explicit) return explicit;
  if (process.env.GITHUB_BASE_REF) return `origin/${process.env.GITHUB_BASE_REF}`;
  return config.baseBranch ? `origin/${config.baseBranch}` : 'origin/main';
}

const HUNK_HEADER = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/;

export function parseChangedLines(diffText) {
  const changed = new Map();
  let currentFile = null;
  let nextLine = null;
  for (const line of diffText.split('\n')) {
    if (line.startsWith('diff --git ')) {
      currentFile = null;
      nextLine = null;
    } else if (line.startsWith('+++ ')) {
      const path = line.slice(4).trim();
      currentFile = path === '/dev/null' ? null : path.replace(/^b\//, '');
      if (currentFile && !changed.has(currentFile)) changed.set(currentFile, new Set());
    } else if (HUNK_HEADER.test(line)) {
      nextLine = Number(line.match(HUNK_HEADER)[1]);
    } else if (currentFile && nextLine !== null) {
      if (line.startsWith('+')) {
        changed.get(currentFile).add(nextLine);
        nextLine += 1;
      } else if (!line.startsWith('-') && !line.startsWith('\\')) {
        nextLine += 1;
      }
    }
  }
  return changed;
}

export function resolveDiffScope(config) {
  if (hasFlag('staged')) return { kind: 'staged', label: 'staged changes' };
  if (hasFlag('working')) return { kind: 'working', label: 'uncommitted changes' };
  const baseRef = resolveBaseRef(config);
  return { kind: 'branch', baseRef, label: baseRef };
}

function normalizeScope(scope) {
  return typeof scope === 'string' ? { kind: 'branch', baseRef: scope, label: scope } : scope;
}

function diffRangeArgs(scope) {
  if (scope.kind === 'staged') return ['--cached'];
  if (scope.kind === 'working') return ['HEAD'];
  return [`${scope.baseRef}...HEAD`];
}

function splitLines(output) {
  return output
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
}

export function listUntrackedFiles() {
  return splitLines(git(['ls-files', '--others', '--exclude-standard']));
}

export function readChangedLines(scope) {
  const normalized = normalizeScope(scope);
  const changed = parseChangedLines(git(['diff', '--unified=0', '--no-color', '--no-ext-diff', ...diffRangeArgs(normalized)]));
  if (normalized.kind !== 'working') return changed;
  for (const file of listUntrackedFiles()) {
    const absolute = join(REPO_ROOT, file);
    if (!existsSync(absolute)) continue;
    const lineCount = readFileSync(absolute, 'utf8').split('\n').length;
    changed.set(file, new Set(Array.from({ length: lineCount }, (_, index) => index + 1)));
  }
  return changed;
}

export function listChangedFiles(scope, filter = 'ACMR') {
  const normalized = normalizeScope(scope);
  const tracked = splitLines(git(['diff', '--name-only', `--diff-filter=${filter}`, ...diffRangeArgs(normalized)]));
  if (normalized.kind !== 'working' || !filter.includes('A')) return tracked;
  return [...new Set([...tracked, ...listUntrackedFiles()])];
}

export function annotate(level, message) {
  if (process.env.GITHUB_ACTIONS === 'true') {
    process.stdout.write(`::${level}::${message.replace(/\r?\n/g, '%0A')}\n`);
  } else {
    const marker = { error: '✖', warning: '⚠', notice: '✔' }[level] ?? '•';
    process.stdout.write(`${marker} ${message}\n`);
  }
}
