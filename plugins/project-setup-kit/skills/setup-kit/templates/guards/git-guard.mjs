import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { loadKitConfig, runGuard } from './hook-io.mjs';

export const DEFAULT_DENIED_GIT_COMMANDS = ['commit', 'push', 'merge', 'rebase', 'reset'];

const GH_MUTATION =
  /(?:^|[\s;&|()])(?:[^\s;&|()]*[/\\])?gh(?:\.exe)?\s+(?:[^;&|()]*?\s+)?(?:pr\s+(?:[^;&|()]*?\s+)?merge(?=\s|[;&|()]|$)|api\s+[^;&|()]*(?:pulls\/[^/\s]+\/merge|\/merges|\/protection|\/rulesets|mergePullRequest|BranchProtection|RepositoryRuleset))/i;

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeCommand(command) {
  return command
    .replace(/["']/g, '')
    .replace(/\\\r?\n/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function buildGitMutationPattern(deniedCommands) {
  const alternatives = deniedCommands.map(escapeRegex).join('|');
  return new RegExp(
    `(?:^|[\\s;&|()\`])(?:[^\\s;&|()]*[/\\\\])?git(?:\\.exe)?\\s+(?:-[^\\s;&|()]+(?:\\s+[^-\\s;&|()][^\\s;&|()]*)?\\s+)*(?:${alternatives})(?=\\s|[;&|()]|$)`,
    'i',
  );
}

export function resolveGitGuardPolicy(config) {
  const policy = config.gitGuard ?? {};
  return {
    deniedCommands: policy.deny ?? DEFAULT_DENIED_GIT_COMMANDS,
    denyGhMutations: policy.denyGhMutations ?? true,
    allowedExactCommands: policy.allowExact ?? [],
  };
}

export function findDeniedCommand(command, policy) {
  const normalized = normalizeCommand(command);
  if (policy.allowedExactCommands.includes(normalized)) return null;
  if (policy.deniedCommands.length > 0 && buildGitMutationPattern(policy.deniedCommands).test(normalized)) {
    return 'git';
  }
  if (policy.denyGhMutations && GH_MUTATION.test(normalized)) return 'gh';
  return null;
}

export function checkGitCall(call, config) {
  const policy = resolveGitGuardPolicy(config);
  const denied = call.commands.map(command => findDeniedCommand(command, policy)).find(Boolean);
  if (!denied) return null;
  const listed = policy.deniedCommands.join(', ');
  return {
    host: call.host,
    reason:
      denied === 'git'
        ? `git-guard: this project does not let agents run git ${listed}. Show the command to the developer instead.`
        : 'git-guard: merging PRs and changing branch protection are done by the developer, not the agent.',
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  const config = loadKitConfig();
  await runGuard(call => checkGitCall(call, config));
}
