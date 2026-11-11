import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { REPO_ROOT, annotate, git, hasFlag, isCi, loadKitConfig, resolveBaseRef } from './lib.mjs';
import { parseFindings } from './lint-ratchet.mjs';

export function parseBudget(text) {
  const value = String(text).trim();
  if (!/^\d+$/.test(value)) throw new Error(`warning budget must be a whole number, found "${value}"`);
  return Number(value);
}

export function evaluateBudget({ count, budget, baseBudget }) {
  if (baseBudget !== null && budget > baseBudget) {
    return { ok: false, message: `The warning budget was raised from ${baseBudget} to ${budget}. It may only go down.` };
  }
  if (count > budget) {
    return { ok: false, message: `${count} warnings, budget is ${budget}. Fix the new warnings instead of raising the budget.` };
  }
  if (count < budget) {
    return { ok: true, message: `${count} warnings, budget is ${budget}. Lower the budget to ${count} with --update.` };
  }
  return { ok: true, message: `${count} warnings, budget is ${budget}.` };
}

function readBaseBudget(file, baseRef) {
  try {
    return parseBudget(git(['show', `${baseRef}:${file}`]));
  } catch {
    return null;
  }
}

function main() {
  const config = loadKitConfig();
  const settings = config.warningBudget;
  if (!settings) throw new Error('No warningBudget in .ai-kit/config.json');
  const budgetPath = join(REPO_ROOT, settings.file);
  const result = spawnSync(settings.command, { cwd: REPO_ROOT, shell: true, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  if (result.error) throw result.error;
  const count = parseFindings(`${result.stdout ?? ''}\n${result.stderr ?? ''}`).length;
  if (!existsSync(budgetPath) && isCi()) {
    annotate('error', `${settings.file} is missing. Create it locally with: node .ai-kit/scripts/warning-budget.mjs --update`);
    process.exitCode = 1;
    return;
  }
  if (hasFlag('update') || !existsSync(budgetPath)) {
    writeFileSync(budgetPath, `${count}\n`);
    process.stdout.write(`Warning budget set to ${count}.\n`);
    return;
  }
  const outcome = evaluateBudget({
    count,
    budget: parseBudget(readFileSync(budgetPath, 'utf8')),
    baseBudget: hasFlag('against-base') ? readBaseBudget(settings.file, resolveBaseRef(config)) : null,
  });
  annotate(outcome.ok ? 'notice' : 'error', outcome.message);
  if (!outcome.ok) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) main();
