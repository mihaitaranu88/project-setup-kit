import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const TEMPLATES = '../../plugins/project-setup-kit/skills/setup-kit/templates';
const { parseChangedLines } = await import(`${TEMPLATES}/checks/lib.mjs`);
const { parseFindings, keepChangedLineFindings, buildCommand } = await import(`${TEMPLATES}/checks/lint-ratchet.mjs`);
const { evaluateBudget, parseBudget } = await import(`${TEMPLATES}/checks/warning-budget.mjs`);
const { evaluateBranchName } = await import(`${TEMPLATES}/checks/branch-name.mjs`);
const { evaluateCommitMessage } = await import(`${TEMPLATES}/checks/commit-msg.mjs`);
const { classifyHost, decide, extractHost, findDatabaseHosts, parseEnvText, EXIT_BLOCKED, EXIT_MISCONFIGURED } = await import(`${TEMPLATES}/checks/guard-remote-db.mjs`);
const { checkOrder, checkRegistration, checkReversible, compareVersions, isIgnoredMigration, isMigrationFile, readVersion } = await import(`${TEMPLATES}/checks/migration-check.mjs`);
const { measurePrefix } = await import(`${TEMPLATES}/checks/prefix-budget.mjs`);
const { evaluateAgentDocs } = await import(`${TEMPLATES}/checks/agent-docs-consistency.mjs`);
const kitConfig = (await import(`${TEMPLATES}/checks/config.json`, { with: { type: 'json' } })).default;

const DIFF = [
  'diff --git a/src/a.ts b/src/a.ts',
  '--- a/src/a.ts',
  '+++ b/src/a.ts',
  '@@ -10,0 +11,2 @@',
  '+const a = 1;',
  '+const b = 2;',
  '@@ -20 +22 @@',
  '-old',
  '+new',
].join('\n');

function makeRepo(files) {
  const root = mkdtempSync(join(tmpdir(), 'ai-kit-test-'));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

describe('changed lines', () => {
  it('should collect added line numbers when the diff has zero-context hunks', () => {
    assert.deepEqual([...parseChangedLines(DIFF).get('src/a.ts')], [11, 12, 22]);
  });
});

describe('lint ratchet', () => {
  it('should parse path:line findings when the linter prints unix format', () => {
    const findings = parseFindings('/repo/src/a.ts:11:5: Unexpected any. [Error/@typescript-eslint/no-explicit-any]\n\n3 problems');
    assert.deepEqual(findings, [{ file: '/repo/src/a.ts', line: 11, message: 'Unexpected any. [Error/@typescript-eslint/no-explicit-any]' }]);
  });

  it('should parse ruff concise output when the path is relative', () => {
    assert.equal(parseFindings('src/app.py:4:1: ANN401 Dynamically typed expressions').at(0).line, 4);
  });

  it('should keep only findings on changed lines when old lines also have findings', () => {
    const findings = [
      { file: '/repo/src/a.ts', line: 11, message: 'new' },
      { file: '/repo/src/a.ts', line: 3, message: 'old' },
      { file: 'src/a.ts', line: 22, message: 'relative' },
    ];
    const kept = keepChangedLineFindings(findings, parseChangedLines(DIFF), '/repo');
    assert.deepEqual(kept.map(finding => finding.message), ['new', 'relative']);
  });

  it('should quote every file when building the command', () => {
    assert.equal(buildCommand('eslint {files}', ["a b.ts", "it's.ts"]), `eslint 'a b.ts' 'it'\\''s.ts'`);
  });
});

describe('warning budget', () => {
  it('should fail when warnings exceed the budget', () => {
    assert.equal(evaluateBudget({ count: 11, budget: 10, baseBudget: null }).ok, false);
  });

  it('should fail when the budget was raised against the base branch', () => {
    assert.match(evaluateBudget({ count: 5, budget: 12, baseBudget: 10 }).message, /raised from 10 to 12/);
  });

  it('should pass and suggest lowering when there are fewer warnings than the budget', () => {
    const outcome = evaluateBudget({ count: 7, budget: 10, baseBudget: 10 });
    assert.equal(outcome.ok, true);
    assert.match(outcome.message, /Lower the budget to 7/);
  });

  it('should reject a budget when the file is not a whole number', () => {
    assert.throws(() => parseBudget('ten'), /whole number/);
  });
});

describe('branch name', () => {
  it('should accept a branch when it matches the default pattern', () => {
    assert.equal(evaluateBranchName('feat/PROJ-12-add-export', kitConfig.branch).ok, true);
  });

  it('should reject a branch when the description has uppercase letters', () => {
    assert.equal(evaluateBranchName('fix/PROJ-12-Fix-Bug', kitConfig.branch).ok, false);
  });

  it('should skip a branch when it is exempt', () => {
    assert.equal(evaluateBranchName('release/1.2', kitConfig.branch).ok, true);
  });

  it('should print the examples when a branch is rejected', () => {
    assert.match(evaluateBranchName('my-branch', kitConfig.branch).message, /feat\/PROJ-123-add-export/);
  });
});

describe('commit message', () => {
  it('should accept a subject when it follows Conventional Commits with a task key', () => {
    assert.equal(evaluateCommitMessage('feat(PROJ-1): add export\n\nbody', kitConfig.commit).ok, true);
  });

  it('should reject a subject when it has no type', () => {
    assert.equal(evaluateCommitMessage('added stuff', kitConfig.commit).ok, false);
  });

  it('should accept git-generated subjects when they are merges or fixups', () => {
    assert.equal(evaluateCommitMessage('Merge branch main into feat/x', kitConfig.commit).ok, true);
    assert.equal(evaluateCommitMessage('fixup! feat: x', kitConfig.commit).ok, true);
  });

  it('should ignore comment lines when finding the subject', () => {
    assert.equal(evaluateCommitMessage('# Please enter\nfix: handle null\n', kitConfig.commit).ok, true);
  });

  it('should reject a trailer when it is configured as forbidden', () => {
    const settings = { ...kitConfig.commit, rejectTrailers: ['Co-Authored-By'] };
    assert.equal(evaluateCommitMessage('fix: x\n\nCo-Authored-By: Bot <bot@example.com>', settings).ok, false);
  });
});

describe('remote database guard', () => {
  const localHosts = kitConfig.dbGuard.localHosts;

  it('should read values when the env file has quotes, export and comments', () => {
    assert.deepEqual(parseEnvText('export DB_HOST="db.internal" # shared\n# x\nPORT=5432'), { DB_HOST: 'db.internal', PORT: '5432' });
  });

  it('should extract the host when the value is a database URL', () => {
    assert.equal(extractHost('postgres://user:secret@prod.example.com:5432/app'), 'prod.example.com');
  });

  it('should extract the host when the value is a SQL Server address with a port', () => {
    assert.equal(extractHost('tcp:sql.example.net,1433'), 'sql.example.net');
  });

  it('should classify compose service names as local when they are listed', () => {
    assert.equal(classifyHost('postgres', localHosts), 'local');
  });

  it('should block when any configured host is remote', () => {
    const hosts = findDatabaseHosts({ DB_HOST: 'localhost', DATABASE_URL: 'mysql://u:p@shared.example.com/db' }, ['DB_HOST', 'DATABASE_URL']);
    assert.equal(decide({ hosts, localHosts, ci: false, overrideSet: false }).code, EXIT_BLOCKED);
  });

  it('should allow when the override is set', () => {
    const hosts = [{ name: 'DB_HOST', host: 'shared.example.com' }];
    assert.equal(decide({ hosts, localHosts, ci: false, overrideSet: true }).code, 0);
  });

  it('should allow when running in CI', () => {
    assert.equal(decide({ hosts: [], localHosts, ci: true, overrideSet: false }).code, 0);
  });

  it('should report misconfiguration when no host is found', () => {
    assert.equal(decide({ hosts: [], localHosts, ci: false, overrideSet: false }).code, EXIT_MISCONFIGURED);
  });
});

describe('migration check', () => {
  const settings = kitConfig.migrations;

  it('should recognise a migration when it is under a configured dir', () => {
    assert.equal(isMigrationFile('migrations/20260101120000_add_users.py', settings), true);
    assert.equal(isMigrationFile('src/migrations.ts', settings), false);
  });

  it('should require a down step when the file has only up', () => {
    assert.match(checkReversible('migrations/1_a.ts', 'export async function up() {}', settings, () => true), /no down/);
  });

  it('should accept Alembic downgrade when present', () => {
    assert.equal(checkReversible('migrations/1_a.py', 'def upgrade():\n  pass\ndef downgrade():\n  pass', settings, () => true), null);
  });

  it('should require a sibling .down file when migrations are split into up and down files', () => {
    assert.match(checkReversible('migrations/0002_x.up.sql', '', settings, () => false), /no matching \.down/);
    assert.equal(checkReversible('migrations/0002_x.up.sql', '', settings, () => true), null);
  });

  it('should reject a migration when it is older than the newest one on the base branch', () => {
    assert.match(checkOrder('migrations/20250101000000_x.ts', [[20260101000000n]], settings), /not newer than/);
  });

  it('should accept a migration when it is newer than all existing ones', () => {
    assert.equal(checkOrder('migrations/20270101000000_x.ts', [[20260101000000n]], settings), null);
  });

  it('should compare Laravel timestamps when they contain underscores', () => {
    const laravel = { ...settings, timestampPattern: '^(\\d{4}_\\d{2}_\\d{2}_\\d{6})' };
    assert.equal(checkOrder('database/migrations/2026_02_01_000000_x.php', [[2026n, 1n, 1n, 120000n]], laravel), null);
    assert.match(checkOrder('database/migrations/2025_12_31_000000_x.php', [[2026n, 1n, 1n, 120000n]], laravel), /not newer than/);
  });

  it('should reject an unregistered migration when an order file is used', () => {
    assert.match(checkRegistration('migrations/20270101000000_x.ts', "['20260101000000_y']"), /not registered/);
  });
});

describe('prefix budget', () => {
  it('should flag over budget when files exceed the estimate', () => {
    const root = makeRepo({ 'AGENTS.md': 'x'.repeat(400) });
    const report = measurePrefix(root, { files: ['AGENTS.md', 'CLAUDE.md'], maxEstimatedTokens: 50, bytesPerToken: 4 });
    assert.equal(report.totalTokens, 100);
    assert.equal(report.overBudget, true);
    assert.equal(report.files[1].missing, true);
  });
});

describe('agent docs consistency', () => {
  const settings = { roster: ['AGENTS.md'], dirs: ['.claude/agents', '.claude/skills'], linkCheckFiles: ['AGENTS.md'] };

  it('should report a role file when AGENTS.md does not mention it', () => {
    const root = makeRepo({ 'AGENTS.md': '# Rules\n', '.claude/agents/reviewer.md': '# reviewer' });
    assert.deepEqual(evaluateAgentDocs(root, settings), ['.claude/agents/reviewer.md exists but is not mentioned in AGENTS.md']);
  });

  it('should report a link when its target does not exist', () => {
    const root = makeRepo({ 'AGENTS.md': 'See [plan](docs/plan.md) and `.claude/skills/migrations/SKILL.md`.' });
    assert.deepEqual(evaluateAgentDocs(root, settings), [
      'AGENTS.md points to docs/plan.md, which does not exist',
      'AGENTS.md points to .claude/skills/migrations/SKILL.md, which does not exist',
    ]);
  });

  it('should pass when every file is mentioned and every link resolves', () => {
    const root = makeRepo({
      'AGENTS.md': 'Roles: `reviewer`. Skills: `migrations`. See [docs](docs/a.md). Ignore [site](https://example.com).',
      'docs/a.md': 'a',
      '.claude/agents/reviewer.md': '# reviewer',
      '.claude/skills/migrations/SKILL.md': '# migrations',
    });
    assert.deepEqual(evaluateAgentDocs(root, settings), []);
  });
});
