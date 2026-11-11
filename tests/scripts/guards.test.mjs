import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { checkEnvCall, findBlockedEnvFile, parseAllowlist } from '../../plugins/project-setup-kit/skills/setup-kit/templates/guards/env-guard.mjs';
import { checkGitCall, findDeniedCommand, resolveGitGuardPolicy } from '../../plugins/project-setup-kit/skills/setup-kit/templates/guards/git-guard.mjs';
import { formatDeny, normalizeToolCall } from '../../plugins/project-setup-kit/skills/setup-kit/templates/guards/hook-io.mjs';

const GUARDS_DIR = fileURLToPath(new URL('../../plugins/project-setup-kit/skills/setup-kit/templates/guards/', import.meta.url));
const defaultPolicy = resolveGitGuardPolicy({});

function runHook(script, payload) {
  const result = spawnSync(process.execPath, [`${GUARDS_DIR}${script}`], { input: payload, encoding: 'utf8' });
  return result.stdout.trim() ? JSON.parse(result.stdout) : null;
}

describe('hook-io', () => {
  it('should read a Claude Code payload when tool_input is present', () => {
    const call = normalizeToolCall(JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'ls' } }));
    assert.equal(call.host, 'claude');
    assert.deepEqual(call.commands, ['ls']);
  });

  it('should read a Copilot payload when toolArgs is a JSON string', () => {
    const call = normalizeToolCall(JSON.stringify({ toolName: 'bash', toolArgs: JSON.stringify({ command: 'git status' }) }));
    assert.equal(call.host, 'copilot');
    assert.deepEqual(call.commands, ['git status']);
  });

  it('should read a Cursor payload when only hook_event_name and fields are present', () => {
    const call = normalizeToolCall(JSON.stringify({ hook_event_name: 'beforeReadFile', file_path: '/repo/.env' }));
    assert.equal(call.host, 'cursor');
    assert.deepEqual(call.paths, ['/repo/.env']);
  });

  it('should answer in the Claude format when the host is claude', () => {
    assert.equal(formatDeny('claude', 'no').hookSpecificOutput.permissionDecision, 'deny');
  });

  it('should answer in the Copilot format when the host is copilot', () => {
    assert.deepEqual(formatDeny('copilot', 'no'), { permissionDecision: 'deny', permissionDecisionReason: 'no' });
  });
});

describe('git-guard', () => {
  const denied = [
    'git commit -m "x"',
    'git push',
    'git push --force origin main',
    'npm test && git commit -am wip',
    'git -C ../other reset --hard',
    'git -c user.name=bot rebase main',
    '/usr/bin/git merge feature',
    'gh pr merge 12 --squash',
    'gh api repos/o/r/branches/main/protection -X DELETE',
  ];
  const allowed = ['git status', 'git log --grep commit', 'git diff main...HEAD', 'git show HEAD:package.json', 'gh pr view 12'];

  for (const command of denied) {
    it(`should deny when the command is: ${command}`, () => {
      assert.notEqual(findDeniedCommand(command, defaultPolicy), null);
    });
  }

  for (const command of allowed) {
    it(`should allow when the command is: ${command}`, () => {
      assert.equal(findDeniedCommand(command, defaultPolicy), null);
    });
  }

  it('should deny conservatively when a denied git command is quoted inside another command', () => {
    assert.equal(findDeniedCommand('echo "git push later"', defaultPolicy), 'git');
  });

  it('should allow an exact command when it is on allowExact', () => {
    const policy = resolveGitGuardPolicy({ gitGuard: { allowExact: ['npm run safe-push'] } });
    assert.equal(findDeniedCommand('npm run safe-push', policy), null);
  });

  it('should only deny the configured subcommands when deny is customized', () => {
    const policy = resolveGitGuardPolicy({ gitGuard: { deny: ['push'] } });
    assert.equal(findDeniedCommand('git commit -m x', policy), null);
    assert.equal(findDeniedCommand('git push', policy), 'git');
  });

  it('should return a reason that names the denied commands when it blocks', () => {
    const decision = checkGitCall({ host: 'claude', commands: ['git push'] }, {});
    assert.match(decision.reason, /commit, push, merge, rebase, reset/);
  });

  it('should print a Claude deny decision when run as a hook on git push', () => {
    const output = runHook('git-guard.mjs', JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'git push' } }));
    assert.equal(output.hookSpecificOutput.permissionDecision, 'deny');
  });

  it('should print nothing when run as a hook on a safe command', () => {
    assert.equal(runHook('git-guard.mjs', JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'git status' } })), null);
  });

  it('should deny when the payload cannot be parsed', () => {
    const output = runHook('git-guard.mjs', 'not json "tool_input"');
    assert.equal(output.hookSpecificOutput.permissionDecision, 'deny');
  });
});

describe('env-guard', () => {
  const allowlist = parseAllowlist('# comment\n.env.example\n');

  it('should block when a command reads .env', () => {
    assert.equal(findBlockedEnvFile('cat .env', allowlist), '.env');
  });

  it('should block when a path points to .env.local', () => {
    assert.equal(findBlockedEnvFile('/repo/app/.env.local', allowlist), '.env.local');
  });

  it('should allow when the file is on the allowlist', () => {
    assert.equal(findBlockedEnvFile('cat .env.example', allowlist), null);
  });

  it('should ignore process.env references when they appear in a command', () => {
    assert.equal(findBlockedEnvFile('node -e "console.log(process.env.HOME)"', allowlist), null);
  });

  it('should not inspect file content when the agent writes a file mentioning .env', () => {
    const call = { host: 'claude', commands: [], paths: ['README.md'], allText: 'Copy .env.example to .env' };
    assert.equal(checkEnvCall(call, allowlist), null);
  });

  it('should print a Copilot deny decision when run as a hook on cat .env', () => {
    const output = runHook('env-guard.mjs', JSON.stringify({ toolName: 'bash', toolArgs: { command: 'cat .env' } }));
    assert.equal(output.permissionDecision, 'deny');
  });
});
