import { spawnSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { REPO_ROOT, hasFlag, loadKitConfig, readArg } from './lib.mjs';

export function selectSteps(settings, only, fast = false) {
  const all = settings.steps ?? [];
  const steps = fast ? all.filter(step => step.fast === true) : all;
  if (fast && steps.length === 0) return all;
  if (!only) return steps;
  const wanted = new Set(only.split(',').map(name => name.trim()));
  const unknown = [...wanted].filter(name => !steps.some(step => step.name === name));
  if (unknown.length > 0) throw new Error(`unknown verify step: ${unknown.join(', ')} (known: ${steps.map(step => step.name).join(', ')})`);
  return steps.filter(step => wanted.has(step.name));
}

export function runSteps(steps, { root = REPO_ROOT, bail = false, run = defaultRun, log = line => process.stdout.write(`${line}\n`) } = {}) {
  const results = [];
  for (const step of steps) {
    const started = Date.now();
    log(`▶ ${step.name}: ${step.run}${step.cwd ? ` (in ${step.cwd})` : ''}`);
    const status = run(step.run, join(root, step.cwd ?? '.'));
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    results.push({ name: step.name, ok: status === 0, seconds });
    if (status !== 0 && bail) break;
  }
  const failed = results.filter(result => !result.ok);
  log('');
  for (const result of results) log(`${result.ok ? '✔' : '✖'} ${result.name} (${result.seconds}s)`);
  const skipped = steps.length - results.length;
  if (skipped > 0) log(`… ${skipped} step(s) not run after the first failure (--bail)`);
  log(failed.length === 0 ? 'verify: all steps passed.' : `verify: ${failed.length} step(s) failed: ${failed.map(result => result.name).join(', ')}. Fix them before saying the task is done.`);
  return { ok: failed.length === 0 && skipped === 0, results };
}

function defaultRun(command, cwd) {
  return spawnSync(command, { cwd, shell: true, stdio: 'inherit' }).status ?? 1;
}

function main() {
  const settings = loadKitConfig().verify ?? {};
  const steps = selectSteps(settings, readArg('only'), hasFlag('fast'));
  if (hasFlag('list')) {
    for (const step of steps) process.stdout.write(`${step.name}: ${step.run}${step.cwd ? ` (in ${step.cwd})` : ''}\n`);
    return;
  }
  if (steps.length === 0) {
    process.stderr.write('verify: no steps in .ai-kit/config.json (section "verify").\n');
    process.exitCode = 1;
    return;
  }
  const { ok } = runSteps(steps, { bail: hasFlag('bail') || settings.bail === true });
  if (!ok) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) main();
