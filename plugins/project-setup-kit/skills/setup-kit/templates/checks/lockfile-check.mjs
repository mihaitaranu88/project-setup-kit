import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { REPO_ROOT, loadKitConfig } from './lib.mjs';

export function classifyInstall(root, pair) {
  const lock = join(root, pair.lock);
  const installed = join(root, pair.installed);
  if (!existsSync(lock)) return 'no-lockfile';
  if (!existsSync(installed)) return 'not-installed';
  if (pair.sameContent && readFileSync(lock, 'utf8') === readFileSync(installed, 'utf8')) return 'in-sync';
  return statSync(lock).mtimeMs > statSync(installed).mtimeMs ? 'stale' : 'in-sync';
}

export function findStaleInstalls(root, pairs) {
  return pairs
    .map(pair => ({ ...pair, status: classifyInstall(root, pair) }))
    .filter(pair => pair.status === 'stale' || pair.status === 'not-installed');
}

function main() {
  const stale = findStaleInstalls(REPO_ROOT, loadKitConfig().lockfiles ?? []);
  for (const pair of stale) {
    const problem = pair.status === 'not-installed' ? 'is not installed yet' : 'changed after your last install';
    process.stdout.write(`⚠ ${pair.lock} ${problem}. Tests may run against other dependencies than CI. Run: ${pair.fix}\n`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) main();
