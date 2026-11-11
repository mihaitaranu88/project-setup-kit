import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { git, loadKitConfig, readArg } from './lib.mjs';

export function evaluateBranchName(branch, settings) {
  if (!branch) return { ok: true, message: 'Detached HEAD: branch name not checked.' };
  if ((settings.exempt ?? []).some(pattern => new RegExp(pattern).test(branch))) {
    return { ok: true, message: `Branch ${branch} is exempt.` };
  }
  if (new RegExp(settings.pattern).test(branch)) return { ok: true, message: `Branch name OK: ${branch}` };
  const examples = (settings.examples ?? []).map(example => `  ✓ ${example}`).join('\n');
  return {
    ok: false,
    message: [
      `Branch name "${branch}" does not match the project convention.`,
      `Pattern: ${settings.pattern}`,
      examples ? `Examples:\n${examples}` : '',
      'Rename it with: git branch -m <new-name>',
    ]
      .filter(Boolean)
      .join('\n'),
  };
}

function currentBranch() {
  try {
    return git(['symbolic-ref', '--short', 'HEAD']).trim();
  } catch {
    return '';
  }
}

function main() {
  const settings = loadKitConfig().branch;
  if (!settings?.pattern) return;
  const outcome = evaluateBranchName(readArg('branch') ?? currentBranch(), settings);
  process.stdout.write(`${outcome.ok ? '✔' : '✖'} ${outcome.message}\n`);
  if (!outcome.ok) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) main();
