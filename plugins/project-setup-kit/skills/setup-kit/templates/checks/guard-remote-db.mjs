import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { REPO_ROOT, isCi, loadKitConfig, readArg } from './lib.mjs';

export const EXIT_BLOCKED = 3;
export const EXIT_MISCONFIGURED = 4;

export function parseEnvText(text) {
  const values = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.replace(/^export\s+/, '').match(/^([A-Za-z_][A-Za-z0-9_.-]*)\s*=\s*(.*)$/);
    if (!match) continue;
    values[match[1]] = match[2].replace(/\s+#.*$/, '').replace(/^(['"])(.*)\1$/, '$2');
  }
  return values;
}

export function extractHost(value) {
  if (!value) return null;
  if (value.includes('://')) {
    try {
      return new URL(value).hostname.replace(/^\[|\]$/g, '') || null;
    } catch {
      return null;
    }
  }
  const serverPart = value.split(/[;,]/)[0].replace(/^(?:tcp:|Server=|Data Source=)/i, '');
  return serverPart.split(/[\\:]/)[0].trim() || null;
}

export function classifyHost(host, localHosts) {
  const lower = host.toLowerCase();
  if (localHosts.map(entry => entry.toLowerCase()).includes(lower)) return 'local';
  if (lower.endsWith('.localhost') || lower.endsWith('.local')) return 'local';
  return 'remote';
}

export function findDatabaseHosts(env, hostVariables) {
  return hostVariables
    .map(name => ({ name, host: extractHost(env[name]) }))
    .filter(entry => entry.host);
}

export function decide({ hosts, localHosts, ci, overrideSet }) {
  if (ci) return { code: 0, message: 'CI run: remote database guard skipped.' };
  if (hosts.length === 0) {
    return { code: EXIT_MISCONFIGURED, message: 'No database host found in the configured env variables, so the target cannot be verified.' };
  }
  const remote = hosts.filter(entry => classifyHost(entry.host, localHosts) === 'remote');
  if (remote.length === 0) return { code: 0, message: `Local database (${hosts.map(entry => entry.host).join(', ')}).` };
  if (overrideSet) {
    return { code: 0, message: `Override set: running against ${remote.map(entry => entry.host).join(', ')}. This is logged in your shell history.` };
  }
  return {
    code: EXIT_BLOCKED,
    message: `Blocked: ${remote.map(entry => `${entry.name}=${entry.host}`).join(', ')} is not a local database.`,
  };
}

function loadEnv(envFiles) {
  const fromFiles = envFiles
    .map(file => join(REPO_ROOT, file))
    .filter(existsSync)
    .reduce((merged, file) => ({ ...merged, ...parseEnvText(readFileSync(file, 'utf8')) }), {});
  return { ...fromFiles, ...process.env };
}

function main() {
  const settings = loadKitConfig().dbGuard ?? {};
  const action = readArg('action', 'this database command');
  const overrideVariable = settings.overrideVariable ?? 'ALLOW_REMOTE_DB';
  const env = loadEnv(settings.envFiles ?? ['.env']);
  const outcome = decide({
    hosts: findDatabaseHosts(env, settings.hostVariables ?? ['DB_HOST', 'DATABASE_URL']),
    localHosts: settings.localHosts ?? ['localhost', '127.0.0.1', '::1'],
    ci: isCi(),
    overrideSet: ['1', 'true', 'yes'].includes(String(process.env[overrideVariable] ?? '').toLowerCase()),
  });
  if (outcome.code === 0) {
    process.stdout.write(`✔ ${outcome.message}\n`);
    return;
  }
  process.stderr.write(
    [
      `✖ ${action} stopped by the remote database guard.`,
      outcome.message,
      'Shared databases are changed by the deploy pipeline. Point your env at a local database to run this.',
      `If you really mean it: ${overrideVariable}=1 <command>`,
      '',
    ].join('\n'),
  );
  process.exitCode = outcome.code;
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) main();
