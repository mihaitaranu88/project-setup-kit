import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { loadKitConfig, runGuard } from './hook-io.mjs';
import { checkPackages, describeResult, findInstalledPackages, resolveDependencyPolicy } from './package-registry.mjs';

export async function checkDepsCall(call, config, options = {}) {
  const packages = call.commands.flatMap(command => findInstalledPackages(command));
  if (packages.length === 0) return null;
  const policy = resolveDependencyPolicy(config);
  const results = await checkPackages(packages, policy, options);
  const flagged = results.filter(result => result.level === 'block' || result.level === 'warn');
  if (flagged.length === 0) return null;
  return {
    host: call.host,
    decision: policy.mode === 'deny' ? 'deny' : 'ask',
    reason: `deps-guard: ${flagged.map(describeResult).join('; ')}. Check the exact name on the registry before installing; AI agents sometimes invent package names that attackers then register.`,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  const config = loadKitConfig();
  await runGuard(call => checkDepsCall(call, config));
}
