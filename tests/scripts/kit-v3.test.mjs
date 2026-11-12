import assert from 'node:assert/strict';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const SKILL = '../../plugins/project-setup-kit/skills/setup-kit';
const { hashContent, installTemplate, recordFiles, run, verifyFiles } = await import(`${SKILL}/scripts/kit.mjs`);
const { DEFAULT_PRECHECK, mergeSettings, runDiffChecks, runLineChecks } = await import(`${SKILL}/templates/checks/precheck.mjs`);
const { isMentioned } = await import(`${SKILL}/templates/checks/agent-docs-consistency.mjs`);
const KIT_SCRIPT = fileURLToPath(new URL(`${SKILL}/scripts/kit.mjs`, import.meta.url));
const CHECKS_DIR = fileURLToPath(new URL(`${SKILL}/templates/checks/`, import.meta.url));

function makeGitRepo() {
  const root = mkdtempSync(join(tmpdir(), 'ai-kit-v3-'));
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: root });
  execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'init'], { cwd: root });
  return root;
}

function lines(...texts) {
  return texts.map((text, index) => ({ number: index + 1, text }));
}

describe('kit installer', () => {
  it('should copy a template and record its hash when the destination is free', () => {
    const root = makeGitRepo();
    const written = installTemplate({ root, template: 'repo/.editorconfig', dest: '.editorconfig' });
    const state = recordFiles({ items: {}, files: {} }, { root, item: '18', paths: written });
    assert.equal(existsSync(join(root, '.editorconfig')), true);
    assert.deepEqual(state.items['18'].files, ['.editorconfig']);
    assert.equal(state.files['.editorconfig'].hash, hashContent(readFileSync(join(root, '.editorconfig'))));
  });

  it('should refuse to overwrite when the destination exists', () => {
    const root = makeGitRepo();
    writeFileSync(join(root, '.editorconfig'), 'root = true\n');
    assert.throws(() => installTemplate({ root, template: 'repo/.editorconfig', dest: '.editorconfig' }), /already exists/);
  });

  it('should reject a template path when it escapes the templates folder', () => {
    assert.throws(() => installTemplate({ root: makeGitRepo(), template: '../SKILL.md', dest: 'x.md' }), /outside the templates folder/);
  });

  it('should reject a destination when it is outside the project', () => {
    assert.throws(() => installTemplate({ root: makeGitRepo(), template: 'repo/.editorconfig', dest: '../escape' }), /outside the project/);
  });

  it('should copy a whole folder when the template is a directory', () => {
    const root = makeGitRepo();
    const written = installTemplate({ root, template: 'guards', dest: '.ai-kit/hooks' });
    assert.ok(written.some(file => file.endsWith('git-guard.mjs')));
    assert.equal(existsSync(join(root, '.ai-kit/hooks/hook-io.mjs')), true);
  });

  it('should list every item that touched a shared file', () => {
    const root = makeGitRepo();
    writeFileSync(join(root, 'ci.yml'), 'a');
    let state = recordFiles({ items: {}, files: {} }, { root, item: '21', paths: [join(root, 'ci.yml')] });
    state = recordFiles(state, { root, item: '24', paths: [join(root, 'ci.yml')] });
    assert.deepEqual(state.files['ci.yml'].items, ['21', '24']);
  });

  it('should report a changed file when its hash differs', () => {
    const root = makeGitRepo();
    writeFileSync(join(root, 'a.txt'), 'one');
    const state = recordFiles({ items: {}, files: {} }, { root, item: '5', paths: [join(root, 'a.txt')] });
    writeFileSync(join(root, 'a.txt'), 'two');
    assert.deepEqual(verifyFiles(state, root).map(entry => entry.problem), ['changed since the kit wrote it']);
  });

  it('should not report merged files when their content changes', () => {
    const root = makeGitRepo();
    writeFileSync(join(root, 'AGENTS.md'), 'team text');
    const state = recordFiles({ items: {}, files: {} }, { root, item: '1', paths: [join(root, 'AGENTS.md')], merged: true });
    writeFileSync(join(root, 'AGENTS.md'), 'team text changed');
    assert.deepEqual(verifyFiles(state, root), []);
  });

  it('should write .ai-kit.json with the kit version when run from the command line', () => {
    const root = makeGitRepo();
    const result = spawnSync(process.execPath, [KIT_SCRIPT, 'install', 'repo/.gitattributes', '.gitattributes', '--item', '18'], { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const state = JSON.parse(readFileSync(join(root, '.ai-kit.json'), 'utf8'));
    assert.match(state.kitVersion, /^\d+\.\d+\.\d+$/);
    assert.deepEqual(state.items['18'].files, ['.gitattributes']);
  });

  it('should exit 3 when installing over an existing file from the command line', () => {
    const root = makeGitRepo();
    writeFileSync(join(root, '.gitattributes'), '* text=auto\n');
    const result = spawnSync(process.execPath, [KIT_SCRIPT, 'install', 'repo/.gitattributes', '.gitattributes', '--item', '18'], { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 3);
  });

  it('should list templates when asked with a prefix', () => {
    assert.match(run(['templates', 'guards/']), /guards\/git-guard\.mjs/);
  });
});

describe('precheck line checks', () => {
  const settings = mergeSettings(DEFAULT_PRECHECK, { lineChecks: { comments: { enabled: true } } });

  it('should flag a focused test when a test file adds .only', () => {
    const findings = runLineChecks('src/a.test.ts', lines("it.only('works', () => {});"), settings);
    assert.deepEqual(findings.map(finding => finding.check), ['focusedTests']);
  });

  it('should flag a debugger statement when it is on its own line', () => {
    assert.equal(runLineChecks('src/a.ts', lines('  debugger;'), settings)[0].check, 'debugStatements');
  });

  it('should flag a TODO when it has no ticket and accept one with a ticket', () => {
    assert.equal(runLineChecks('src/a.ts', lines('const x = 1; // TODO handle this'), settings).some(f => f.check === 'todoWithoutTicket'), true);
    assert.equal(runLineChecks('src/a.ts', lines('// TODO PROJ-12 handle this'), settings).some(f => f.check === 'todoWithoutTicket'), false);
  });

  it('should flag comments when the team bans them', () => {
    const findings = runLineChecks('src/a.ts', lines('// explains the code', 'const a = 1; // trailing', '/* block */'), settings);
    assert.equal(findings.filter(finding => finding.check === 'comments').length, 3);
  });

  it('should allow directive comments when they carry a reason', () => {
    const findings = runLineChecks('src/a.ts', lines('// eslint-disable-next-line no-console -- CLI output', 'const url = "https://example.com";', '"use client";'), settings);
    assert.equal(findings.filter(finding => finding.check === 'comments').length, 0);
  });

  it('should leave comments alone when the check is disabled by default', () => {
    const defaults = mergeSettings(DEFAULT_PRECHECK, {});
    assert.equal(runLineChecks('src/a.ts', lines('// a comment'), defaults).filter(finding => finding.check === 'comments').length, 0);
  });

  it('should only check test patterns in test files', () => {
    assert.equal(runLineChecks('src/a.ts', lines("it.only('x', () => {})"), settings).some(f => f.check === 'focusedTests'), false);
  });
});

describe('precheck diff checks', () => {
  const settings = mergeSettings(DEFAULT_PRECHECK, {});

  it('should warn when new source files come without any test', () => {
    const findings = runDiffChecks(['src/new.ts'], ['src/new.ts'], settings);
    assert.equal(findings[0].check, 'newSourceWithoutTest');
  });

  it('should apply the default test rule to Python, Go and PHP layouts', () => {
    assert.equal(runDiffChecks(['app/orders.py'], ['app/orders.py'], settings)[0]?.check, 'newSourceWithoutTest');
    assert.deepEqual(runDiffChecks(['app/orders.py', 'tests/test_orders.py'], ['app/orders.py', 'tests/test_orders.py'], settings), []);
    assert.deepEqual(runDiffChecks(['internal/order/order.go', 'internal/order/order_test.go'], ['internal/order/order.go', 'internal/order/order_test.go'], settings), []);
    assert.deepEqual(runDiffChecks(['app/__init__.py', 'migrations/versions/1_init.py'], ['app/__init__.py', 'migrations/versions/1_init.py'], settings), []);
    assert.deepEqual(runDiffChecks(['src/Order.php', 'tests/OrderTest.php'], ['src/Order.php', 'tests/OrderTest.php'], settings), []);
  });

  it('should not warn when the change also touches a test', () => {
    assert.deepEqual(runDiffChecks(['src/new.ts', 'src/new.test.ts'], ['src/new.ts', 'src/new.test.ts'], settings), []);
  });

  it('should not count Next.js route files as source needing tests', () => {
    assert.deepEqual(runDiffChecks(['app/page.tsx'], ['app/page.tsx'], settings), []);
  });

  it('should warn when tooling changes without docs', () => {
    assert.equal(runDiffChecks(['package.json'], [], settings)[0].check, 'toolingWithoutDocs');
    assert.deepEqual(runDiffChecks(['package.json', 'README.md'], [], settings), []);
  });
});

describe('precheck and ratchet on uncommitted changes', () => {
  it('should find a focused test in an untracked file when run with --working', () => {
    const root = makeGitRepo();
    mkdirSync(join(root, '.ai-kit/scripts'), { recursive: true });
    for (const name of ['lib.mjs', 'precheck.mjs']) writeFileSync(join(root, '.ai-kit/scripts', name), readFileSync(join(CHECKS_DIR, name)));
    mkdirSync(join(root, 'src'));
    writeFileSync(join(root, 'src/a.test.ts'), "describe.only('x', () => {});\n");
    const result = spawnSync(process.execPath, ['.ai-kit/scripts/precheck.mjs', '--working'], { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout, /src\/a\.test\.ts:1 Focused test/);
  });

  it('should pass when there are no uncommitted changes', () => {
    const root = makeGitRepo();
    mkdirSync(join(root, '.ai-kit/scripts'), { recursive: true });
    for (const name of ['lib.mjs', 'precheck.mjs']) writeFileSync(join(root, '.ai-kit/scripts', name), readFileSync(join(CHECKS_DIR, name)));
    const result = spawnSync(process.execPath, ['.ai-kit/scripts/precheck.mjs', '--working'], { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stdout + result.stderr);
  });
});

describe('agent docs roster mention', () => {
  it('should not accept a plain word as a mention', () => {
    assert.equal(isMentioned('This project uses Convex as its backend.', { name: 'convex', path: '.claude/skills/convex' }), false);
  });

  it('should accept a code mention, a slash command or a path', () => {
    assert.equal(isMentioned('Skills: `convex`.', { name: 'convex', path: '.claude/skills/convex' }), true);
    assert.equal(isMentioned('Run /bugfix to fix bugs.', { name: 'bugfix', path: '.claude/commands/bugfix.md' }), true);
    assert.equal(isMentioned('See .claude/agents/reviewer.md', { name: 'reviewer', path: '.claude/agents/reviewer.md' }), true);
  });
});

describe('fixes from the second end-to-end run', async () => {
  const { setItemState, mergeContext } = await import(`${SKILL}/scripts/kit.mjs`);
  const { checkProtectCall } = await import(`${SKILL}/templates/guards/protect-guard.mjs`);
  const { classifyInstall } = await import(`${SKILL}/templates/checks/lockfile-check.mjs`);

  it('should set an item state and merge answers when asked', () => {
    let state = setItemState({ items: {} }, { item: '1', value: 'installed', answers: { agentMayCommit: false } });
    state = setItemState(state, { item: '1', value: 'installed', answers: { comments: 'none' } });
    assert.deepEqual(state.items['1'].answers, { agentMayCommit: false, comments: 'none' });
  });

  it('should refuse an unknown item state', () => {
    assert.throws(() => setItemState({ items: {} }, { item: '1', value: 'done' }), /unknown state/);
  });

  it('should keep missing only while an item is partial', () => {
    let state = setItemState({ items: {} }, { item: '9', value: 'partial', missing: 'copy pending' });
    assert.equal(state.items['9'].missing, 'copy pending');
    state = setItemState(state, { item: '9', value: 'installed' });
    assert.equal(state.items['9'].missing, undefined);
  });

  it('should merge Phase 2 context when called twice', () => {
    const state = mergeContext(mergeContext({}, { team: false }), { platform: 'github' });
    assert.deepEqual(state.context, { team: false, platform: 'github' });
  });

  it('should let the agent write into .ai-kit/pending without asking', () => {
    const call = { host: 'claude', toolName: 'Write', paths: ['.ai-kit/pending/dot-claude/settings.json'], commands: [], payload: { cwd: '/repo' } };
    const previous = process.env.CLAUDE_PROJECT_DIR;
    process.env.CLAUDE_PROJECT_DIR = '/repo';
    assert.equal(checkProtectCall(call, {}), null);
    if (previous === undefined) delete process.env.CLAUDE_PROJECT_DIR;
    else process.env.CLAUDE_PROJECT_DIR = previous;
  });

  it('should still ask when a copy from pending targets a protected file', () => {
    const call = { host: 'claude', toolName: 'Bash', paths: [], commands: ['cp .ai-kit/pending/dot-claude/settings.json .claude/settings.json'], payload: {} };
    assert.equal(checkProtectCall(call, {}).decision, 'ask');
  });

  it('should treat pnpm installs as in sync when the lock copies match', () => {
    const root = mkdtempSync(join(tmpdir(), 'ai-kit-lock-'));
    mkdirSync(join(root, 'node_modules/.pnpm'), { recursive: true });
    writeFileSync(join(root, 'node_modules/.pnpm/lock.yaml'), 'lockfileVersion: 9\n');
    writeFileSync(join(root, 'pnpm-lock.yaml'), 'lockfileVersion: 9\n');
    const pair = { lock: 'pnpm-lock.yaml', installed: 'node_modules/.pnpm/lock.yaml', sameContent: true };
    assert.equal(classifyInstall(root, pair), 'in-sync');
    writeFileSync(join(root, 'pnpm-lock.yaml'), 'lockfileVersion: 9\npackages: {}\n');
    assert.equal(classifyInstall(root, pair), 'stale');
  });

  it('should report dependencies as not installed when the marker is missing', () => {
    const root = mkdtempSync(join(tmpdir(), 'ai-kit-lock-'));
    writeFileSync(join(root, 'package-lock.json'), '{}');
    assert.equal(classifyInstall(root, { lock: 'package-lock.json', installed: 'node_modules/.package-lock.json' }), 'not-installed');
  });

  it('should flag lint disables without a reason and accept ones with a reason', () => {
    const settings = mergeSettings(DEFAULT_PRECHECK, {});
    const flagged = runLineChecks('src/a.ts', lines('// eslint-disable-next-line no-console', '// @ts-ignore'), settings);
    assert.equal(flagged.filter(finding => finding.check === 'lintDisableWithoutReason').length, 2);
    const ok = runLineChecks('src/a.ts', lines('// eslint-disable-next-line no-console -- CLI output'), settings);
    assert.equal(ok.filter(finding => finding.check === 'lintDisableWithoutReason').length, 0);
  });

  it('should flag JSX comments when comments are banned', () => {
    const settings = mergeSettings(DEFAULT_PRECHECK, { lineChecks: { comments: { enabled: true } } });
    assert.equal(runLineChecks('app/page.tsx', lines('      {/* hero */}'), settings).some(finding => finding.check === 'comments'), true);
  });

  it('should not flag TODO lines in markdown', () => {
    const settings = mergeSettings(DEFAULT_PRECHECK, {});
    assert.deepEqual(runLineChecks('AGENTS.md', lines('TODO: confirm the deploy command'), settings), []);
  });

  it('should treat any env example file as tooling', () => {
    const settings = mergeSettings(DEFAULT_PRECHECK, {});
    assert.equal(runDiffChecks(['.env.local.example'], [], settings)[0].check, 'toolingWithoutDocs');
  });
});

describe('fixes from the third end-to-end run', async () => {
  const kit = await import(`${SKILL}/scripts/kit.mjs`);
  const { checkProtectCall } = await import(`${SKILL}/templates/guards/protect-guard.mjs`);
  const { findDangerousCommand, resolveDangerPolicy } = await import(`${SKILL}/templates/guards/danger-guard.mjs`);
  const { evaluateAgentDocs } = await import(`${SKILL}/templates/checks/agent-docs-consistency.mjs`);

  it('should map protected paths to pending paths and back', () => {
    assert.equal(kit.toPendingPath('.claude/settings.json'), '.ai-kit/pending/dot-claude/settings.json.pending');
    assert.equal(kit.toPendingPath('lefthook.yml'), '.ai-kit/pending/lefthook.yml.pending');
    assert.equal(kit.fromPendingPath('.ai-kit/pending/dot-claude/agents/reviewer.md.pending'), '.claude/agents/reviewer.md');
  });

  it('should refuse to install into a tool-protected path', () => {
    assert.throws(() => kit.installTemplate({ root: makeGitRepo(), template: 'roles/reviewer.md', dest: '.claude/agents/reviewer.md' }), /protected by the AI tool/);
  });

  it('should install into the pending path instead', () => {
    const root = makeGitRepo();
    kit.installTemplate({ root, template: 'roles/reviewer.md', dest: kit.toPendingPath('.claude/agents/reviewer.md') });
    assert.deepEqual(kit.listPending(root).map(entry => entry.target), ['.claude/agents/reviewer.md']);
  });

  it('should copy pending files into place and clean up when the developer applies them', () => {
    const root = makeGitRepo();
    kit.installTemplate({ root, template: 'roles/reviewer.md', dest: kit.toPendingPath('.claude/agents/reviewer.md') });
    assert.match(kit.run(['pending', 'apply'], root), /Copied 1 file/);
    assert.equal(existsSync(join(root, '.claude/agents/reviewer.md')), true);
    assert.match(kit.run(['pending', 'clean'], root), /Removed/);
    assert.equal(existsSync(join(root, '.ai-kit/pending')), false);
  });

  it('should refuse to clean while files are still pending', () => {
    const root = makeGitRepo();
    kit.installTemplate({ root, template: 'roles/reviewer.md', dest: kit.toPendingPath('.claude/agents/reviewer.md') });
    assert.throws(() => kit.run(['pending', 'clean'], root), /still pending/);
  });

  it('should move a setting between pending and done', () => {
    let state = kit.setSetting({}, { status: 'pending', name: 'secret:SONAR_TOKEN' });
    state = kit.setSetting(state, { status: 'done', name: 'secret:SONAR_TOKEN' });
    assert.deepEqual(state.settings, { done: ['secret:SONAR_TOKEN'], pending: [] });
  });

  it('should add only the requested config sections and keep existing values', () => {
    const defaults = { gitGuard: { deny: ['push'] }, branch: { pattern: 'x' } };
    const next = kit.addConfigSections({ gitGuard: { deny: ['commit'] } }, defaults, ['gitGuard', 'branch']);
    assert.deepEqual(next, { gitGuard: { deny: ['commit'] }, branch: { pattern: 'x' } });
    assert.throws(() => kit.addConfigSections({}, defaults, ['nope']), /unknown config section/);
  });

  it('should merge values into a config section', () => {
    assert.deepEqual(kit.setConfigSection({ branch: { pattern: 'x', exempt: [] } }, 'branch', { pattern: 'y' }), { branch: { pattern: 'y', exempt: [] } });
  });

  it('should write config sections through the command line', () => {
    const root = makeGitRepo();
    kit.run(['config', 'add', 'gitGuard', 'branch'], root);
    kit.run(['config', 'set', 'branch', '{"pattern":"^feat/"}'], root);
    const config = JSON.parse(readFileSync(join(root, '.ai-kit/config.json'), 'utf8'));
    assert.deepEqual(Object.keys(config), ['gitGuard', 'branch']);
    assert.equal(config.branch.pattern, '^feat/');
  });

  it('should ask before the agent runs pending apply', () => {
    const call = { host: 'claude', toolName: 'Bash', paths: [], commands: ['node /x/scripts/kit.mjs pending apply'], payload: {} };
    assert.equal(checkProtectCall(call, {}).decision, 'ask');
  });

  it('should leave the installs pack off by default and flag installs when it is on', () => {
    assert.equal(findDangerousCommand('pnpm add lodash', resolveDangerPolicy({})), null);
    const strict = resolveDangerPolicy({ dangerGuard: { packs: ['installs'] } });
    for (const command of ['pnpm add lodash', 'npm install express', 'pip install requests', 'composer require guzzlehttp/guzzle', 'go get github.com/x/y']) {
      assert.equal(findDangerousCommand(command, strict)?.pack, 'installs', command);
    }
    for (const command of ['pnpm install', 'npm ci', 'pip install -r requirements.txt', 'npm install --frozen-lockfile']) {
      assert.equal(findDangerousCommand(command, strict), null, command);
    }
  });

  it('should accept links to agent files that are staged in pending', () => {
    const root = makeGitRepo();
    mkdirSync(join(root, '.ai-kit/pending/dot-claude/agents'), { recursive: true });
    writeFileSync(join(root, '.ai-kit/pending/dot-claude/agents/reviewer.md.pending'), '# reviewer');
    writeFileSync(join(root, 'AGENTS.md'), 'Reviewer: `.claude/agents/reviewer.md`.');
    assert.deepEqual(evaluateAgentDocs(root, { roster: ['AGENTS.md'], dirs: ['.claude/agents'], linkCheckFiles: ['AGENTS.md'] }), []);
  });
});

describe('fixes from the empty-folder run', async () => {
  const kit = await import(`${SKILL}/scripts/kit.mjs`);

  it('should record the config file hash when config set gets an item', () => {
    const root = makeGitRepo();
    kit.run(['config', 'add', 'branch', '--item', '38'], root);
    kit.run(['config', 'set', 'branch', '{"pattern":"^feat/"}', '--item', '38'], root);
    const state = JSON.parse(readFileSync(join(root, '.ai-kit.json'), 'utf8'));
    assert.deepEqual(state.files['.ai-kit/config.json'].items, ['38']);
    assert.deepEqual(kit.verifyFiles(state, root), []);
  });

  it('should keep every update when several state commands run in parallel', async () => {
    const root = makeGitRepo();
    const runs = Array.from({ length: 8 }, (_, index) =>
      new Promise(resolvePromise => {
        const child = spawn(process.execPath, [KIT_SCRIPT, 'state', String(index + 1), 'installed'], { cwd: root });
        child.on('exit', resolvePromise);
      }),
    );
    const codes = await Promise.all(runs);
    assert.deepEqual(codes, [0, 0, 0, 0, 0, 0, 0, 0]);
    const state = JSON.parse(readFileSync(join(root, '.ai-kit.json'), 'utf8'));
    assert.equal(Object.keys(state.items).length, 8);
    assert.equal(existsSync(join(root, '.ai-kit.json.lock')), false);
  });
});

describe('fixes from the fourth end-to-end run', async () => {
  const kit = await import(`${SKILL}/scripts/kit.mjs`);
  const { findDangerousCommand, resolveDangerPolicy } = await import(`${SKILL}/templates/guards/danger-guard.mjs`);
  const strict = resolveDangerPolicy({ dangerGuard: { packs: ['installs'] } });

  it('should catch installs when flags come before the package', () => {
    for (const command of ['pnpm add -D vitest', 'npm i -g typescript', 'npm install --save-dev eslint', 'yarn global add serve']) {
      assert.equal(findDangerousCommand(command, strict)?.pack, 'installs', command);
    }
  });

  it('should still allow lockfile installs when only flags follow', () => {
    for (const command of ['pnpm install --frozen-lockfile', 'npm ci', 'npm install', 'pnpm i']) {
      assert.equal(findDangerousCommand(command, strict), null, command);
    }
  });

  it('should read config values from a file when set with --file', () => {
    const root = makeGitRepo();
    writeFileSync(join(root, 'values.json'), JSON.stringify({ rules: [{ match: '\\.ts$', commands: ['pnpm exec eslint {file}'] }] }));
    kit.run(['config', 'set', 'postEdit', '--file', 'values.json', '--item', '36'], root);
    const config = JSON.parse(readFileSync(join(root, '.ai-kit/config.json'), 'utf8'));
    assert.equal(config.postEdit.rules[0].commands[0], 'pnpm exec eslint {file}');
  });

  it('should name every added section in the config add message', () => {
    assert.match(kit.run(['config', 'add', 'gitGuard', 'branch'], makeGitRepo()), /add gitGuard, branch/);
  });

  it('should not interpolate untrusted pull request fields into run commands', () => {
    const dir = fileURLToPath(new URL(`${SKILL}/templates/ci/github/`, import.meta.url));
    const untrusted = /run:[^\n]*\$\{\{\s*github\.(head_ref|event\.pull_request\.(title|body|head\.ref))/;
    for (const name of readdirSync(dir).filter(file => file.endsWith('.yml'))) {
      const content = readFileSync(join(dir, name), 'utf8');
      assert.equal(untrusted.test(content), false, name);
      for (const block of content.split(/\n\s*- /)) {
        if (/run: \|/.test(block)) assert.equal(/\$\{\{\s*github\.(head_ref|event\.pull_request\.(title|body))/.test(block.split('run: |')[1] ?? ''), false, name);
      }
    }
  });
});

describe('fixes from the fifth end-to-end run', async () => {
  const kit = await import(`${SKILL}/scripts/kit.mjs`);

  it('should report every installed guard answer as expected', () => {
    const root = makeGitRepo();
    kit.installTemplate({ root, template: 'guards', dest: '.ai-kit/hooks' });
    const results = kit.runGuardTests(root);
    assert.equal(results.length, kit.GUARD_SAMPLES.length);
    assert.deepEqual(results.filter(entry => !entry.ok).map(entry => `${entry.guard} ${entry.actual}`), []);
  });

  it('should say when no guards are installed', () => {
    assert.match(kit.run(['guard-test'], makeGitRepo()), /No guards installed/);
  });

  it('should read a plugin preset through another package', () => {
    const root = makeGitRepo();
    mkdirSync(join(root, 'node_modules/framework-config/node_modules/demo-plugin'), { recursive: true });
    writeFileSync(join(root, 'package.json'), '{}');
    writeFileSync(join(root, 'node_modules/framework-config/package.json'), '{"name":"framework-config","main":"index.js"}');
    writeFileSync(join(root, 'node_modules/framework-config/index.js'), 'module.exports = {};');
    writeFileSync(join(root, 'node_modules/framework-config/node_modules/demo-plugin/package.json'), '{"name":"demo-plugin","main":"index.js"}');
    writeFileSync(join(root, 'node_modules/framework-config/node_modules/demo-plugin/index.js'), "module.exports = { configs: { recommended: { rules: { 'demo/a': 'error' } } } };");
    assert.deepEqual(kit.readPluginRules(root, 'demo-plugin', 'framework-config'), { 'demo/a': 'error' });
  });
});
