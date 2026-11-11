import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, readdirSync, realpathSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { git, loadKitConfig } from './lib.mjs';

const USAGE = `Usage:
  node .ai-kit/scripts/worktree.mjs new <branch> [base]   create a sibling worktree, copy ignored env files, install dependencies
  node .ai-kit/scripts/worktree.mjs remove <branch>       remove it if it has no uncommitted changes`;

export function worktreePath(repoRoot, branch) {
  return join(dirname(repoRoot), `${basename(repoRoot)}-${branch.replace(/[\\/]/g, '-')}`);
}

export function listIgnoredEnvFiles(repoRoot) {
  return readdirSync(repoRoot)
    .filter(name => /^\.env(\..+)?$/i.test(name))
    .filter(name => spawnSync('git', ['check-ignore', '-q', name], { cwd: repoRoot }).status === 0);
}

function branchExists(branch) {
  return spawnSync('git', ['show-ref', '--verify', '--quiet', `refs/heads/${branch}`]).status === 0;
}

function createWorktree(repoRoot, branch, base, installCommand) {
  const target = worktreePath(repoRoot, branch);
  if (existsSync(target)) throw new Error(`${target} already exists`);
  spawnSync('git', ['fetch', 'origin', base], { stdio: 'inherit' });
  const startPoint = spawnSync('git', ['rev-parse', '--verify', '--quiet', `origin/${base}`]).status === 0 ? `origin/${base}` : base;
  const args = branchExists(branch) ? ['worktree', 'add', target, branch] : ['worktree', 'add', '--no-track', '-b', branch, target, startPoint];
  execFileSync('git', args, { stdio: 'inherit' });
  for (const name of listIgnoredEnvFiles(repoRoot)) copyFileSync(join(repoRoot, name), join(target, name));
  if (installCommand) {
    const result = spawnSync(installCommand, { cwd: target, shell: true, stdio: 'inherit' });
    if (result.status !== 0) throw new Error(`install failed in ${target}: ${installCommand}`);
  }
  return target;
}

function removeWorktree(repoRoot, branch) {
  const target = worktreePath(repoRoot, branch);
  if (!existsSync(target)) throw new Error(`${target} does not exist`);
  const dirty = execFileSync('git', ['-C', target, 'status', '--porcelain'], { encoding: 'utf8' }).trim();
  if (dirty) throw new Error(`${target} has uncommitted changes. Commit or discard them first.`);
  execFileSync('git', ['worktree', 'remove', target], { stdio: 'inherit' });
  return target;
}

function main() {
  const [command, branch, base] = process.argv.slice(2);
  if (!branch || !['new', 'remove'].includes(command)) {
    process.stderr.write(`${USAGE}\n`);
    process.exitCode = 2;
    return;
  }
  const repoRoot = git(['rev-parse', '--show-toplevel']).trim();
  const settings = loadKitConfig().worktree ?? {};
  try {
    const target =
      command === 'new'
        ? createWorktree(repoRoot, branch, base ?? settings.baseBranch ?? loadKitConfig().baseBranch ?? 'main', settings.install)
        : removeWorktree(repoRoot, branch);
    process.stdout.write(`${command === 'new' ? 'Worktree ready' : 'Removed'}: ${target}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) main();
