#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const PLUGIN_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

export function compareVersions(left, right) {
  const parse = value => String(value ?? '0').split(/[.-]/).slice(0, 3).map(part => Number.parseInt(part, 10) || 0);
  const [a, b] = [parse(left), parse(right)];
  for (let index = 0; index < 3; index += 1) {
    if ((a[index] ?? 0) !== (b[index] ?? 0)) return (a[index] ?? 0) - (b[index] ?? 0);
  }
  return 0;
}

function countFiles(dir) {
  if (!existsSync(dir)) return 0;
  return readdirSync(dir).reduce((total, name) => {
    const path = join(dir, name);
    return total + (statSync(path).isDirectory() ? countFiles(path) : 1);
  }, 0);
}

export function buildNotice(projectDir, pluginVersion) {
  const state = readJson(join(projectDir, '.ai-kit.json'));
  if (!state || state.settings?.sessionNotice === false) return null;
  const lines = [];
  if (state.kitVersion && compareVersions(pluginVersion, state.kitVersion) > 0) {
    lines.push(`project-setup-kit ${pluginVersion} is installed; this project was set up with ${state.kitVersion}. Run /setup-kit update to see what changed (nothing is applied without your consent).`);
  }
  const pending = countFiles(join(projectDir, '.ai-kit', 'pending'));
  if (pending > 0) {
    lines.push(`${pending} kit file${pending === 1 ? '' : 's'} wait in .ai-kit/pending for your review. Run /setup-kit status to see them.`);
  }
  return lines.length > 0 ? lines.join('\n') : null;
}

function main() {
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const pluginVersion = readJson(join(PLUGIN_ROOT, '.claude-plugin', 'plugin.json'))?.version;
  const notice = pluginVersion ? buildNotice(projectDir, pluginVersion) : null;
  if (notice) process.stdout.write(`${JSON.stringify({ systemMessage: notice })}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  try {
    main();
  } catch {
    process.exitCode = 0;
  }
}
