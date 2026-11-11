import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { loadKitConfig, runGuard } from './hook-io.mjs';

const ANY_TARGET_END = `(?=\\s|$|[;&|)"'])`;
const BROAD_RM_TARGET = `(?:\\/|\\/\\*|~\\/?|\\$HOME\\/?|\\$\\{HOME\\}\\/?|\\.\\.?\\/?|\\*|\\.\\/\\*)${ANY_TARGET_END}`;

export const PACKS = {
  filesystem: {
    scan: 'unquoted',
    patterns: [
      { name: 'delete a broad path recursively', regex: new RegExp(`\\brm\\s+(?:-[a-zA-Z]+\\s+|--[a-z-]+\\s+)*?-[a-zA-Z]*[rR][a-zA-Z]*\\s+(?:-[a-zA-Z]+\\s+)*${BROAD_RM_TARGET}`) },
      { name: 'delete a broad path recursively', regex: new RegExp(`\\brm\\s+(?:-[a-zA-Z]+\\s+)*--recursive\\s+(?:-[a-zA-Z]+\\s+|--[a-z-]+\\s+)*${BROAD_RM_TARGET}`) },
      { name: 'format or overwrite a disk', regex: /\b(?:mkfs(?:\.\w+)?|dd\s+[^;&|]*\bof=\/dev\/)/ },
      { name: 'make files world-writable', regex: /\bchmod\s+(?:-[a-zA-Z]*R[a-zA-Z]*\s+)+0?777\b/ },
    ],
  },
  git: {
    scan: 'unquoted',
    patterns: [
      { name: 'throw away commits and changes (git reset --hard)', regex: /\bgit\b[^;&|]*\breset\s+(?:[^;&|]*\s)?--hard\b/ },
      { name: 'delete untracked files (git clean -f)', regex: /\bgit\b[^;&|]*\bclean\s+(?:[^;&|]*\s)?-[a-zA-Z]*f/ },
      { name: 'overwrite remote history (force push)', regex: /\bgit\b[^;&|]*\bpush\b[^;&|]*(?:\s--force(?:-with-lease)?\b|\s-[a-zA-Z]*f\b|\s\+\S+)/ },
      { name: 'delete a branch', regex: /\bgit\b[^;&|]*\bbranch\s+(?:[^;&|]*\s)?(?:-D\b|--delete\s+--force)/ },
      { name: 'discard all working changes', regex: /\bgit\b[^;&|]*\b(?:checkout\s+--\s+\.|restore\s+(?:--worktree\s+)?\.)(?=\s|$|[;&|)])/ },
      { name: 'drop stashed work', regex: /\bgit\b[^;&|]*\bstash\s+(?:drop|clear)\b/ },
      { name: 'rewrite history', regex: /\bgit\b[^;&|]*\b(?:filter-branch|filter-repo)\b/ },
    ],
  },
  hookBypass: {
    scan: 'unquoted',
    patterns: [
      { name: 'skip git hooks', regex: /\bgit\b[^;&|]*\s--no-verify\b/ },
      { name: 'skip git hooks', regex: /\bgit\b[^;&|]*\bcommit\b[^;&|]*\s-[a-zA-Z]*n[a-zA-Z]*\b/ },
      { name: 'disable husky', regex: /(?:^|[\s;&|(])HUSKY=0\b/ },
      { name: 'override hooks path', regex: /\bgit\s+(?:[^;&|]*\s)?-c\s+core\.hooksPath=/ },
      { name: 'disable lefthook', regex: /(?:^|[\s;&|(])LEFTHOOK=0\b/ },
      { name: 'skip pre-commit hooks', regex: /(?:^|[\s;&|(])SKIP=\S+\s+(?:\S+\s+)*?(?:git|pre-commit)\b/ },
    ],
  },
  database: {
    scan: 'full',
    patterns: [
      { name: 'drop a database, schema or table', regex: /\bDROP\s+(?:DATABASE|SCHEMA|TABLE)\b/i },
      { name: 'truncate a table', regex: /\bTRUNCATE\s+(?:TABLE\s+)?[\w."`[\]]+/i },
      { name: 'delete all rows', regex: /\bDELETE\s+FROM\s+[\w."`[\]]+\s*(?:;|$|["'])/i },
      { name: 'reset the database', regex: /\b(?:prisma\s+migrate\s+reset|prisma\s+db\s+push\s+[^;&|]*--force-reset|rails\s+db:(?:drop|reset|purge)|rake\s+db:(?:drop|reset)|artisan\s+(?:migrate:fresh|migrate:reset|db:wipe)|manage\.py\s+(?:flush|reset_db)|dropdb\b|knex\s+migrate:rollback\s+--all|typeorm\s+schema:drop|sequelize\s+db:drop)/ },
      { name: 'flush a cache or document store', regex: /\b(?:redis-cli\b[^;&|]*\bflush(?:all|db)\b|dropDatabase\s*\()/i },
    ],
  },
  infrastructure: {
    scan: 'unquoted',
    patterns: [
      { name: 'destroy infrastructure', regex: /\b(?:terraform|tofu)\s+(?:destroy\b|apply\s+[^;&|]*-auto-approve)/ },
      { name: 'delete Kubernetes resources', regex: /\bkubectl\s+(?:[^;&|]*\s)?delete\b/ },
      { name: 'uninstall a Helm release', regex: /\bhelm\s+(?:uninstall|delete)\b/ },
      { name: 'prune Docker data', regex: /\bdocker\s+(?:system\s+prune|volume\s+(?:rm|prune)|compose\s+down\s+[^;&|]*-v\b)/ },
      { name: 'delete cloud resources', regex: /\b(?:aws\s+s3\s+(?:rm|rb)\s+[^;&|]*--(?:recursive|force)|gcloud\s+[^;&|]*\bdelete\b|az\s+(?:group|resource)\s+delete\b)/ },
    ],
  },
  installs: {
    scan: 'unquoted',
    optIn: true,
    patterns: [
      {
        name: 'install or add a dependency',
        regex: /\b(?:(?:npm|pnpm|bun)\s+(?:i|install|add)(?:\s+--?[\w-]+(?:=\S+)?)*\s+[^\s-]|yarn\s+(?:global\s+)?add\b|(?:pip3?|uv\s+pip)\s+install\s+(?!-r\b|-e\s+\.)\S|uv\s+add\b|poetry\s+add\b|composer\s+require\b|go\s+get\s+\S|cargo\s+add\b|gem\s+install\b|brew\s+install\b|apt(?:-get)?\s+install\b|dotnet\s+add\s+package\b)/,
      },
    ],
  },
  remoteScripts: {
    scan: 'unquoted',
    patterns: [{ name: 'run a downloaded script', regex: /\b(?:curl|wget)\b[^;&]*\|\s*(?:sudo\s+)?(?:ba|z)?sh\b/ }],
  },
};

const INTERPRETER_SCRIPT = /\b(?:(?:ba|z)?sh|python3?|node|ruby|perl|php)\s+(?:-[a-zA-Z]*[ce])\s+/;

export function removeQuotedText(command) {
  return command.replace(/'[^']*'|"(?:[^"\\]|\\.)*"/g, ' __quoted__ ');
}

export function buildScanText(command, scan) {
  if (scan === 'full' || INTERPRETER_SCRIPT.test(command)) return command;
  return removeQuotedText(command);
}

export function resolveDangerPolicy(config) {
  const settings = config.dangerGuard ?? {};
  return {
    packs: settings.packs ?? Object.keys(PACKS).filter(name => !PACKS[name].optIn),
    allowPatterns: (settings.allowPatterns ?? []).map(pattern => new RegExp(pattern)),
    extraPatterns: (settings.extraPatterns ?? []).map(pattern => ({ name: 'run a command this project marked as needing approval', regex: new RegExp(pattern) })),
    mode: settings.mode ?? 'ask',
  };
}

export function findDangerousCommand(command, policy) {
  if (policy.allowPatterns.some(pattern => pattern.test(command))) return null;
  for (const packName of policy.packs) {
    const pack = PACKS[packName];
    if (!pack) continue;
    const text = buildScanText(command, pack.scan);
    const hit = pack.patterns.find(pattern => pattern.regex.test(text));
    if (hit) return { pack: packName, name: hit.name };
  }
  const extra = policy.extraPatterns.find(pattern => pattern.regex.test(command));
  return extra ? { pack: 'project', name: extra.name } : null;
}

export function checkDangerCall(call, config) {
  const policy = resolveDangerPolicy(config);
  const hit = call.commands.map(command => findDangerousCommand(command, policy)).find(Boolean);
  if (!hit) return null;
  return {
    host: call.host,
    decision: policy.mode,
    reason: `danger-guard: this command would ${hit.name} (${hit.pack}). It needs the developer's explicit approval.`,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  const config = loadKitConfig();
  await runGuard(call => checkDangerCall(call, config));
}
