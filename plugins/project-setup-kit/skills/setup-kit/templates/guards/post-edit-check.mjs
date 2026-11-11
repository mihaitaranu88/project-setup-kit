import { spawnSync } from 'node:child_process';
import { existsSync, realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadKitConfig, normalizeToolCall, quoteForShell, readStdin, resolveCwd } from './hook-io.mjs';

const MAX_REPORT_CHARS = 4000;

export function selectCommands(filePath, rules) {
  return rules
    .filter(rule => new RegExp(rule.match).test(filePath))
    .flatMap(rule => rule.commands)
    .map(command => command.replaceAll('{file}', quoteForShell(filePath)));
}

export function runCommands(commands, { cwd, timeoutSeconds }) {
  const failures = [];
  for (const command of commands) {
    const result = spawnSync(command, {
      cwd,
      shell: true,
      encoding: 'utf8',
      timeout: timeoutSeconds * 1000,
    });
    if (result.error?.code === 'ETIMEDOUT') {
      failures.push(`${command}\n(timed out after ${timeoutSeconds}s)`);
    } else if (result.status !== 0) {
      failures.push(`${command}\n${`${result.stdout ?? ''}${result.stderr ?? ''}`.trim()}`);
    }
  }
  return failures;
}

export function formatFailures(filePath, failures) {
  const report = `post-edit-check found problems after editing ${filePath}. Fix them before continuing:\n\n${failures.join('\n\n')}`;
  return report.length > MAX_REPORT_CHARS ? `${report.slice(0, MAX_REPORT_CHARS)}\n…(truncated)` : report;
}

async function main() {
  const call = normalizeToolCall(await readStdin());
  const cwd = resolveCwd(call);
  const absolutePath = call.paths.map(path => (isAbsolute(path) ? path : resolve(cwd, path))).find(existsSync);
  if (!absolutePath) return;
  const postEdit = loadKitConfig().postEdit ?? {};
  const filePath = relative(cwd, absolutePath);
  const commands = selectCommands(filePath, postEdit.rules ?? []);
  if (commands.length === 0) return;
  const failures = runCommands(commands, { cwd, timeoutSeconds: postEdit.timeoutSeconds ?? 60 });
  if (failures.length === 0) return;
  process.stderr.write(`${formatFailures(filePath, failures)}\n`);
  process.exitCode = 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  await main();
}
