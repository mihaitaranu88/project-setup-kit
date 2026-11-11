import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const SKILL = '../../plugins/project-setup-kit/skills/setup-kit';
const cli = await import('../../bin/cli.mjs');
const { quoteForShell } = await import(`${SKILL}/templates/guards/hook-io.mjs`);
const { findDangerousCommand, resolveDangerPolicy } = await import(`${SKILL}/templates/guards/danger-guard.mjs`);
const { worktreePath } = await import(`${SKILL}/templates/checks/worktree.mjs`);
const { readKitVersion } = await import(`${SKILL}/scripts/kit.mjs`);

function emptyRepo() {
  const root = mkdtempSync(join(tmpdir(), 'kit-v020-'));
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: root });
  return root;
}

describe('npx CLI', () => {
  it('should copy the skill and write a Copilot prompt when the tool is copilot', () => {
    const root = emptyRepo();
    const { written } = cli.installSkill(root, { tool: 'copilot' });
    assert.ok(existsSync(join(root, '.agents/skills/setup-kit/SKILL.md')));
    assert.equal(readFileSync(join(root, '.agents/skills/setup-kit/VERSION'), 'utf8').trim(), cli.VERSION);
    assert.match(readFileSync(join(root, '.github/prompts/setup-kit.prompt.md'), 'utf8'), /mode: agent[\s\S]*\.agents\/skills\/setup-kit\/SKILL\.md/);
    assert.deepEqual(written, ['.agents/skills/setup-kit', '.github/prompts/setup-kit.prompt.md', '.gitignore']);
  });

  it('should write a Cursor command and add the skill folder to .gitignore once', () => {
    const root = emptyRepo();
    cli.installSkill(root, { tool: 'cursor' });
    cli.installSkill(root, { tool: 'cursor' });
    assert.ok(existsSync(join(root, '.cursor/commands/setup-kit.md')));
    assert.equal(readFileSync(join(root, '.gitignore'), 'utf8').match(/\/\.agents\/skills\/setup-kit\//g).length, 1);
  });

  it('should send Claude Code users to the plugin', () => {
    assert.throws(() => cli.installSkill(emptyRepo(), { tool: 'claude' }), /plugin marketplace add/);
  });

  it('should let the copied kit.mjs read its version from the VERSION file', () => {
    const root = emptyRepo();
    cli.installSkill(root, { tool: 'other' });
    assert.equal(readKitVersion(join(root, '.agents/skills/setup-kit')), cli.VERSION);
  });

  it('should write a Gemini CLI command when the tool is gemini', () => {
    const root = emptyRepo();
    cli.installSkill(root, { tool: 'gemini' });
    const command = readFileSync(join(root, '.gemini/commands/setup-kit.toml'), 'utf8');
    assert.match(command, /^description = "/);
    assert.match(command, /prompt = """\n[\s\S]*\.agents\/skills\/setup-kit\/SKILL\.md[\s\S]*\n"""\n$/);
  });

  it('should rely on skill discovery without a command file when the tool is codex', () => {
    const root = emptyRepo();
    const { written } = cli.installSkill(root, { tool: 'codex' });
    assert.deepEqual(written, ['.agents/skills/setup-kit', '.gitignore']);
    assert.match(cli.runCli(['install-skill', '--tool', 'codex'], root), /\$setup-kit/);
  });

  it('should move a copy installed by 0.2.0 and repoint its prompt when installing again', () => {
    const root = emptyRepo();
    mkdirSync(join(root, '.ai-kit/setup-kit'), { recursive: true });
    writeFileSync(join(root, '.ai-kit/setup-kit/SKILL.md'), 'old');
    mkdirSync(join(root, '.cursor/commands'), { recursive: true });
    writeFileSync(join(root, '.cursor/commands/setup-kit.md'), 'Read `.ai-kit/setup-kit/SKILL.md`');
    writeFileSync(join(root, '.gitignore'), 'node_modules/\n/.ai-kit/setup-kit/\n');
    const output = cli.runCli(['install-skill', '--tool', 'cursor'], root);
    assert.match(output, /Moved the earlier copy/);
    assert.ok(!existsSync(join(root, '.ai-kit/setup-kit')));
    assert.match(readFileSync(join(root, '.cursor/commands/setup-kit.md'), 'utf8'), /\.agents\/skills\/setup-kit/);
    assert.equal(readFileSync(join(root, '.gitignore'), 'utf8'), 'node_modules/\n/.agents/skills/setup-kit/\n');
  });

  it('should keep a prompt the user edited when installing again', () => {
    const root = emptyRepo();
    mkdirSync(join(root, '.cursor/commands'), { recursive: true });
    writeFileSync(join(root, '.cursor/commands/setup-kit.md'), 'my own text');
    cli.installSkill(root, { tool: 'cursor' });
    assert.equal(readFileSync(join(root, '.cursor/commands/setup-kit.md'), 'utf8'), 'my own text');
  });

  it('should install the guards and wire them for Claude Code without duplicating hooks', () => {
    const root = emptyRepo();
    cli.installGuards(root, { tool: 'claude' });
    cli.installGuards(root, { tool: 'claude', force: true });
    const settings = JSON.parse(readFileSync(join(root, '.claude/settings.json'), 'utf8'));
    const commands = settings.hooks.PreToolUse.flatMap(entry => entry.hooks.map(hook => hook.command));
    assert.equal(commands.length, 4);
    assert.equal(new Set(commands).size, 4);
    const config = JSON.parse(readFileSync(join(root, '.ai-kit/config.json'), 'utf8'));
    assert.deepEqual(Object.keys(config), ['gitGuard', 'dangerGuard', 'protectFiles']);
  });

  it('should keep existing Claude settings when merging hooks', () => {
    const merged = cli.mergeClaudeHooks({ permissions: { allow: ['Bash(ls)'] }, hooks: { Stop: [{ hooks: [] }] } });
    assert.deepEqual(merged.permissions, { allow: ['Bash(ls)'] });
    assert.ok(merged.hooks.Stop);
    assert.equal(merged.hooks.PreToolUse.length, 3);
  });

  it('should wire Copilot and Cursor guards', () => {
    const copilot = emptyRepo();
    cli.installGuards(copilot, { tool: 'copilot' });
    assert.ok(existsSync(join(copilot, '.github/hooks/danger-guard.json')));
    const cursor = emptyRepo();
    cli.installGuards(cursor, { tool: 'cursor' });
    const hooks = JSON.parse(readFileSync(join(cursor, '.cursor/hooks.json'), 'utf8'));
    assert.equal(hooks.hooks.beforeShellExecution.length, 4);
  });

  it('should refuse to overwrite installed guards without --force', () => {
    const root = emptyRepo();
    cli.installGuards(root, { tool: 'cursor' });
    assert.throws(() => cli.installGuards(root, { tool: 'cursor' }), /--force/);
  });

  it('should print usage for help', () => {
    assert.match(cli.runCli(['help']), /install-skill/);
  });
});

describe('Windows support', () => {
  it('should quote paths with double quotes on Windows and single quotes elsewhere', () => {
    assert.equal(quoteForShell('src/my file.ts', 'win32'), '"src/my file.ts"');
    assert.equal(quoteForShell('src/my file.ts', 'linux'), "'src/my file.ts'");
  });

  it('should ask before broad recursive deletes written for PowerShell or cmd', () => {
    const policy = resolveDangerPolicy({});
    for (const command of ['Remove-Item -Recurse -Force C:\\', 'Remove-Item -Recurse -Force ~', 'rd /s /q C:\\', 'rmdir /s /q .']) {
      assert.equal(findDangerousCommand(command, policy)?.pack, 'filesystem', command);
    }
    assert.equal(findDangerousCommand('Remove-Item -Recurse -Force .\\dist', policy), null);
  });

  it('should name worktree folders without path separators', () => {
    assert.equal(worktreePath(join('work', 'app'), 'feat/PROJ-1-x'), join('work', 'app-feat-PROJ-1-x'));
  });
});
