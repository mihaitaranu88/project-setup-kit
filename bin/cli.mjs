#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const SKILL_SOURCE = join(PACKAGE_ROOT, 'plugins', 'project-setup-kit', 'skills', 'setup-kit');
export const VERSION = JSON.parse(readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf8')).version;
export const SKILL_TARGET = '.agents/skills/setup-kit';
export const LEGACY_SKILL_TARGET = '.ai-kit/setup-kit';
export const TOOLS = ['copilot', 'cursor', 'codex', 'gemini', 'opencode', 'claude', 'other'];

const USAGE = `project-setup-kit ${VERSION}

Usage (run in the project root):
  npx github:mihaitaranu88/project-setup-kit install-skill --tool <copilot|cursor|codex|gemini|opencode|other> [--no-gitignore]
      Copy the /setup-kit skill into .agents/skills/setup-kit/ (the shared Agent Skills folder) and add a command your AI tool can run.
  npx github:mihaitaranu88/project-setup-kit guards --tool <claude|copilot|cursor> [--force]
      Install only the agent guards (git, destructive commands, .env, protected files) without an AI session.
  npx github:mihaitaranu88/project-setup-kit help

Claude Code users do not need this: install the plugin with
  /plugin marketplace add mihaitaranu88/project-setup-kit`;

const PROMPT_BODY = `Run the project setup kit for this repository.

Read \`${SKILL_TARGET}/SKILL.md\` and follow it exactly, including the conversation flow in \`${SKILL_TARGET}/references/flow.md\`. Wherever the kit says \`<skill-dir>\`, use \`${SKILL_TARGET}\`. Ask one item at a time, give your recommendation and the reason, and write nothing without my consent.`;

function toPosix(path) {
  return path.split(/[\\/]/).join('/');
}

export function readOption(args, name) {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] ?? null : null;
}

function appendLineOnce(path, line) {
  const current = existsSync(path) ? readFileSync(path, 'utf8') : '';
  if (current.split(/\r?\n/).includes(line)) return false;
  writeFileSync(path, `${current}${current && !current.endsWith('\n') ? '\n' : ''}${line}\n`);
  return true;
}

export function promptFileFor(tool) {
  if (tool === 'copilot') {
    return {
      path: join('.github', 'prompts', 'setup-kit.prompt.md'),
      content: `---\nmode: agent\ndescription: Set up AI-agent files, guards, checks and CI for this repository, one item at a time\n---\n\n${PROMPT_BODY}\n`,
    };
  }
  if (tool === 'cursor') {
    return { path: join('.cursor', 'commands', 'setup-kit.md'), content: `${PROMPT_BODY}\n` };
  }
  if (tool === 'gemini') {
    return {
      path: join('.gemini', 'commands', 'setup-kit.toml'),
      content: `description = "Set up AI-agent files, guards, checks and CI for this repository, one item at a time"\nprompt = """\n${PROMPT_BODY}\n"""\n`,
    };
  }
  return null;
}

const HOW_TO_RUN = {
  copilot: 'Run /setup-kit in Copilot Chat (agent mode).',
  cursor: 'Run /setup-kit in Cursor.',
  gemini: 'Run /setup-kit in Gemini CLI.',
  codex: 'Codex finds the skill in .agents/skills: run $setup-kit or ask "set up the kit for this repository".',
  opencode: 'Ask opencode: "use the setup-kit skill to set up this repository".',
  other: `Ask your AI agent: "Follow ${SKILL_TARGET}/SKILL.md".`,
};

export function howToRun(tool) {
  return HOW_TO_RUN[tool] ?? HOW_TO_RUN.other;
}

function removeLegacyCopy(root) {
  const legacy = join(root, LEGACY_SKILL_TARGET);
  if (!existsSync(join(legacy, 'SKILL.md'))) return false;
  rmSync(legacy, { recursive: true, force: true });
  const gitignore = join(root, '.gitignore');
  if (existsSync(gitignore)) {
    const lines = readFileSync(gitignore, 'utf8').split(/\r?\n/);
    const kept = lines.filter(line => line !== `/${LEGACY_SKILL_TARGET}/`);
    if (kept.length !== lines.length) writeFileSync(gitignore, kept.join('\n'));
  }
  return true;
}

export function installSkill(root, { tool, gitignore = true }) {
  if (!TOOLS.includes(tool)) throw new Error(`--tool must be one of: ${TOOLS.filter(name => name !== 'claude').join(', ')}`);
  if (tool === 'claude') throw new Error('Claude Code installs the plugin directly: /plugin marketplace add mihaitaranu88/project-setup-kit');
  const migrated = removeLegacyCopy(root);
  const target = join(root, SKILL_TARGET);
  mkdirSync(dirname(target), { recursive: true });
  rmSync(target, { recursive: true, force: true });
  cpSync(SKILL_SOURCE, target, { recursive: true, force: true });
  writeFileSync(join(target, 'VERSION'), `${VERSION}\n`);
  const written = [toPosix(SKILL_TARGET)];
  const prompt = promptFileFor(tool);
  if (prompt) {
    const promptPath = join(root, prompt.path);
    mkdirSync(dirname(promptPath), { recursive: true });
    const current = existsSync(promptPath) ? readFileSync(promptPath, 'utf8') : null;
    if (current === null || current.includes(LEGACY_SKILL_TARGET)) {
      writeFileSync(promptPath, prompt.content);
      written.push(toPosix(prompt.path));
    }
  }
  if (gitignore && appendLineOnce(join(root, '.gitignore'), `/${toPosix(SKILL_TARGET)}/`)) written.push('.gitignore');
  return { written, prompt, migrated };
}

const GUARD_WIRING = {
  claude: [
    { matcher: 'Bash', guards: ['git-guard.mjs', 'danger-guard.mjs'] },
    { matcher: 'Bash|Edit|Write|MultiEdit|NotebookEdit', guards: ['protect-guard.mjs'] },
    { matcher: 'Bash|Read|Edit|Write|MultiEdit|Grep|Glob|NotebookEdit', guards: ['env-guard.mjs'] },
  ],
  copilot: ['git-guard', 'danger-guard', 'protect-guard', 'env-guard'],
  cursor: ['git-guard.mjs', 'danger-guard.mjs', 'protect-guard.mjs', 'env-guard.mjs'],
};

function readJson(path, fallback) {
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : fallback;
}

export function mergeClaudeHooks(settings) {
  const next = { ...settings, hooks: { ...(settings.hooks ?? {}) } };
  const preToolUse = [...(next.hooks.PreToolUse ?? [])];
  for (const { matcher, guards } of GUARD_WIRING.claude) {
    for (const guard of guards) {
      const command = `node "$CLAUDE_PROJECT_DIR/.ai-kit/hooks/${guard}"`;
      const present = preToolUse.some(entry => (entry.hooks ?? []).some(hook => hook.command === command));
      if (present) continue;
      const existing = preToolUse.find(entry => entry.matcher === matcher);
      const hook = { type: 'command', command, timeout: 10 };
      if (existing) existing.hooks = [...(existing.hooks ?? []), hook];
      else preToolUse.push({ matcher, hooks: [hook] });
    }
  }
  next.hooks.PreToolUse = preToolUse;
  return next;
}

export function mergeCursorHooks(config) {
  const next = { version: 1, ...config, hooks: { ...(config.hooks ?? {}) } };
  const shell = [...(next.hooks.beforeShellExecution ?? [])];
  for (const guard of GUARD_WIRING.cursor) {
    const command = `node .ai-kit/hooks/${guard}`;
    if (!shell.some(entry => entry.command === command)) shell.push({ command });
  }
  const read = [...(next.hooks.beforeReadFile ?? [])];
  if (!read.some(entry => entry.command === 'node .ai-kit/hooks/env-guard.mjs')) read.push({ command: 'node .ai-kit/hooks/env-guard.mjs' });
  next.hooks.beforeShellExecution = shell;
  next.hooks.beforeReadFile = read;
  return next;
}

export function installGuards(root, { tool, force = false }) {
  if (!['claude', 'copilot', 'cursor'].includes(tool)) throw new Error('--tool must be claude, copilot or cursor');
  const templates = join(SKILL_SOURCE, 'templates');
  const hooksDir = join(root, '.ai-kit', 'hooks');
  if (existsSync(hooksDir) && !force) throw new Error('.ai-kit/hooks already exists; use --force to overwrite the guard scripts');
  mkdirSync(hooksDir, { recursive: true });
  cpSync(join(templates, 'guards'), hooksDir, { recursive: true, force: true });
  const configPath = join(root, '.ai-kit', 'config.json');
  const defaults = readJson(join(templates, 'checks', 'config.json'), {});
  const config = readJson(configPath, {});
  for (const section of ['gitGuard', 'dangerGuard', 'protectFiles']) if (!(section in config)) config[section] = defaults[section];
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
  const written = ['.ai-kit/hooks/', '.ai-kit/config.json'];
  if (tool === 'claude') {
    const settingsPath = join(root, '.claude', 'settings.json');
    mkdirSync(dirname(settingsPath), { recursive: true });
    writeFileSync(settingsPath, `${JSON.stringify(mergeClaudeHooks(readJson(settingsPath, {})), null, 2)}\n`);
    written.push('.claude/settings.json');
  }
  if (tool === 'copilot') {
    const dir = join(root, '.github', 'hooks');
    mkdirSync(dir, { recursive: true });
    for (const guard of GUARD_WIRING.copilot) {
      const wiring = join(templates, 'tool-config', 'copilot', `${guard}.json`);
      const dest = join(dir, `${guard}.json`);
      if (existsSync(wiring) && (!existsSync(dest) || force)) {
        cpSync(wiring, dest);
        written.push(toPosix(relative(root, dest)));
      }
    }
  }
  if (tool === 'cursor') {
    const hooksPath = join(root, '.cursor', 'hooks.json');
    mkdirSync(dirname(hooksPath), { recursive: true });
    writeFileSync(hooksPath, `${JSON.stringify(mergeCursorHooks(readJson(hooksPath, {})), null, 2)}\n`);
    written.push('.cursor/hooks.json');
  }
  return written;
}

export function runCli(argv, cwd = process.cwd()) {
  const [command, ...args] = argv;
  if (!command || command === 'help' || command === '--help') return USAGE;
  if (command === 'install-skill') {
    const tool = readOption(args, 'tool') ?? 'other';
    const { written, migrated } = installSkill(cwd, { tool, gitignore: !args.includes('--no-gitignore') });
    const moved = migrated ? `\nMoved the earlier copy from ${LEGACY_SKILL_TARGET}/ to ${SKILL_TARGET}/.` : '';
    return `Wrote: ${written.join(', ')}${moved}\n${howToRun(tool)}`;
  }
  if (command === 'guards') {
    const tool = readOption(args, 'tool');
    if (!tool) throw new Error('--tool is required');
    const written = installGuards(cwd, { tool, force: args.includes('--force') });
    return `Wrote: ${written.join(', ')}\nNode 20+ must be installed for the guards to run. Test them in your AI tool by asking it to run "git push".`;
  }
  throw new Error(USAGE);
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  try {
    process.stdout.write(`${runCli(process.argv.slice(2))}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
