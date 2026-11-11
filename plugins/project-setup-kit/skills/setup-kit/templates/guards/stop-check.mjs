import { spawnSync } from 'node:child_process';
import { existsSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadKitConfig, readStdin } from './hook-io.mjs';
import { runCommands, selectCommands } from './post-edit-check.mjs';

const MAX_REPORT_CHARS = 6000;

function gitLines(args, cwd) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.split('\n').map(line => line.trim()).filter(Boolean) : [];
}

export function listWorkingChanges(cwd) {
  const tracked = gitLines(['diff', '--name-only', 'HEAD'], cwd);
  const untracked = gitLines(['ls-files', '--others', '--exclude-standard'], cwd);
  return [...new Set([...tracked, ...untracked])].filter(path => existsSync(join(cwd, path)));
}

export function planStopCommands(changedFiles, settings, postEditRules) {
  if (changedFiles.length === 0) return [];
  const perFile = settings.runPostEditRules === false ? [] : changedFiles.flatMap(file => selectCommands(file, postEditRules));
  return [...new Set([...perFile, ...(settings.commands ?? [])])];
}

export function shouldSkip(payload) {
  return payload?.stop_hook_active === true;
}

async function main() {
  const raw = await readStdin();
  const payload = raw.trim() ? JSON.parse(raw) : {};
  if (shouldSkip(payload)) return;
  const cwd = process.env.CLAUDE_PROJECT_DIR ?? payload.cwd ?? process.cwd();
  const config = loadKitConfig();
  const settings = config.stopCheck ?? {};
  const commands = planStopCommands(listWorkingChanges(cwd), settings, config.postEdit?.rules ?? []);
  if (commands.length === 0) return;
  const failures = runCommands(commands, { cwd, timeoutSeconds: settings.timeoutSeconds ?? 300 });
  if (failures.length === 0) return;
  const report = `Checks fail on your uncommitted changes. Fix them before you finish:\n\n${failures.join('\n\n')}`;
  process.stderr.write(`${report.length > MAX_REPORT_CHARS ? `${report.slice(0, MAX_REPORT_CHARS)}\n…(truncated)` : report}\n`);
  process.exitCode = 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  await main();
}
