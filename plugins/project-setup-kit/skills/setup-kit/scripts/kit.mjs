#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { closeSync, cpSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { checkOutdated, formatOutdated } from './outdated.mjs';

export const SKILL_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const TEMPLATES_DIR = join(SKILL_DIR, 'templates');
export function readKitVersion(skillDir = SKILL_DIR) {
  const pluginManifest = join(skillDir, '..', '..', '.claude-plugin', 'plugin.json');
  if (existsSync(pluginManifest)) return JSON.parse(readFileSync(pluginManifest, 'utf8')).version;
  const versionFile = join(skillDir, 'VERSION');
  if (existsSync(versionFile)) return readFileSync(versionFile, 'utf8').trim();
  return '0.0.0';
}

export const KIT_VERSION = readKitVersion();
export const STATE_FILE = '.ai-kit.json';

const USAGE = `Usage (run from the project root):
  node kit.mjs install <template> <dest> --item <id> [--force]   copy a template file or folder and record it
  node kit.mjs record <path>... --item <id> [--merged]          record files the agent wrote or merged
  node kit.mjs state <id> <state> [--answers '<json>'] [--note <text>] [--missing <text>]
                                                                set an item's state (installed, declined, existing, partial, not-applicable, pending)
  node kit.mjs context '<json>'                                 merge Phase 2 answers into context
  node kit.mjs setting <done|pending> <name>                    record a repository setting from Phase 4
  node kit.mjs config add <section>... [--item <id>]             add default sections to .ai-kit/config.json (keeps existing ones)
  node kit.mjs config set <section> '<json>' [--item <id>]       merge values into one section; --item records the new hash
  node kit.mjs config set <section> --file <values.json> [--item <id>]   same, reading the values from a file (for values with {file} or quotes)
  node kit.mjs pending list|apply|clean                          show, copy into place (run by the developer), or remove .ai-kit/pending
  node kit.mjs guard-test                                        send sample tool calls to every installed guard and compare the answers
  node kit.mjs plugin-rules <plugin> [--via <package>] [--config recommended]   print a lint plugin's preset rules (resolving it through a framework package)
  node kit.mjs verify                                           list recorded files that changed or disappeared
  node kit.mjs templates [prefix]                               list template paths
  node kit.mjs uninstall-plan <id>|--all [--json]                 what removing one item, or the whole kit, would delete, edit or keep (changes nothing)
  node kit.mjs outdated [--json]                                 list pinned actions, tool images and MCP packages that have a newer release
  node kit.mjs pin-actions <workflow>... [--check]               pin every GitHub action to a full commit SHA (the tag stays as a note); --check only lists unpinned ones`;

export function hashContent(content) {
  return `sha256:${createHash('sha256').update(content).digest('hex')}`;
}

export function hashFile(path) {
  return hashContent(readFileSync(path));
}

export function findProjectRoot(cwd = process.cwd()) {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return cwd;
  }
}

export function loadState(root) {
  const path = join(root, STATE_FILE);
  if (!existsSync(path)) return { kitVersion: KIT_VERSION, items: {}, files: {} };
  const state = JSON.parse(readFileSync(path, 'utf8'));
  return { items: {}, files: {}, ...state };
}

export function writeFileAtomically(path, content) {
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, content);
  renameSync(temporary, path);
}

export function saveState(root, state) {
  const next = { ...state, kitVersion: KIT_VERSION, updatedAt: new Date().toISOString().slice(0, 10) };
  writeFileAtomically(join(root, STATE_FILE), `${JSON.stringify(next, null, 2)}\n`);
}

const LOCK_WAIT_MS = 50;
const LOCK_TIMEOUT_MS = 10000;
const STALE_LOCK_MS = 60000;

function lockAge(lockPath) {
  try {
    return Date.now() - statSync(lockPath).mtimeMs;
  } catch {
    return 0;
  }
}

export function withStateLock(root, action) {
  const lockPath = join(root, `${STATE_FILE}.lock`);
  const started = Date.now();
  let handle = null;
  while (handle === null) {
    try {
      handle = openSync(lockPath, 'wx');
    } catch (error) {
      if (!['EEXIST', 'EPERM', 'EBUSY'].includes(error.code)) throw error;
      if (lockAge(lockPath) > STALE_LOCK_MS) rmSync(lockPath, { force: true });
      if (Date.now() - started > LOCK_TIMEOUT_MS) throw new Error(`${STATE_FILE} is locked by another kit command; try again`);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, LOCK_WAIT_MS);
    }
  }
  try {
    return action();
  } finally {
    closeSync(handle);
    rmSync(lockPath, { force: true });
  }
}

export function listFilesRecursively(path) {
  if (!statSync(path).isDirectory()) return [path];
  return readdirSync(path).flatMap(name => listFilesRecursively(join(path, name)));
}

export function planRemoval(state, root, { item = null, all = false } = {}) {
  const removing = all ? null : String(item);
  const plan = { delete: [], ask: [], editMerged: [], keepShared: [], missing: [] };
  for (const [path, info] of Object.entries(state.files ?? {}).sort(([a], [b]) => a.localeCompare(b))) {
    const owners = (info.items ?? []).map(String);
    if (!all && !owners.includes(removing)) continue;
    const others = all ? [] : owners.filter(owner => owner !== removing && ['installed', 'partial'].includes(state.items?.[owner]?.state ?? 'installed'));
    const absolute = join(root, path);
    if (!existsSync(absolute)) plan.missing.push(path);
    else if (others.length > 0) plan.keepShared.push({ path, sharedWith: others });
    else if (info.hash === 'merged') plan.editMerged.push(path);
    else if (hashFile(absolute) === info.hash) plan.delete.push(path);
    else plan.ask.push(path);
  }
  const settings = all ? (state.settings?.done ?? []) : [];
  return { ...plan, settings, items: all ? Object.keys(state.items ?? {}).filter(id => ['installed', 'partial'].includes(state.items[id].state)) : [removing] };
}

export function formatRemovalPlan(plan) {
  const section = (title, entries, render = entry => entry) => (entries.length > 0 ? [`${title}:`, ...entries.map(entry => `  ${render(entry)}`)] : []);
  return [
    `Items: ${plan.items.join(', ') || 'none'}`,
    ...section('Delete (unchanged since the kit wrote them)', plan.delete),
    ...section('Ask first (changed by the team since the kit wrote them; show the diff)', plan.ask),
    ...section('Edit, do not delete (shared files the kit merged into: remove only the kit blocks or entries)', plan.editMerged),
    ...section('Keep (still used by another installed item; remove only this item\'s part)', plan.keepShared, entry => `${entry.path} (items ${entry.sharedWith.join(', ')})`),
    ...section('Already gone', plan.missing),
    ...section('Repository settings to undo by hand (Phase 4 did these)', plan.settings),
  ].join('\n');
}

export function recordFiles(state, { root, item, paths, merged = false }) {
  const items = { ...state.items };
  const files = { ...state.files };
  const entry = { ...(items[item] ?? {}) };
  const recorded = new Set(entry.files ?? []);
  for (const absolute of paths) {
    const path = relative(root, absolute).split('\\').join('/');
    const previous = files[path] ?? { items: [] };
    files[path] = {
      hash: merged ? 'merged' : hashFile(absolute),
      items: [...new Set([...previous.items, String(item)])].sort((a, b) => Number(a) - Number(b)),
    };
    recorded.add(path);
  }
  entry.files = [...recorded].sort();
  items[item] = entry;
  return { ...state, items, files };
}

export const ITEM_STATES = ['installed', 'declined', 'existing', 'partial', 'not-applicable', 'pending'];

export function setItemState(state, { item, value, answers, note, missing }) {
  if (!ITEM_STATES.includes(value)) throw new Error(`unknown state "${value}", use one of: ${ITEM_STATES.join(', ')}`);
  const previous = state.items?.[item] ?? {};
  const entry = { ...previous, state: value, date: new Date().toISOString().slice(0, 10) };
  if (answers) entry.answers = { ...(previous.answers ?? {}), ...answers };
  if (note) entry.note = note;
  if (missing) entry.missing = missing;
  else if (value !== 'partial') delete entry.missing;
  return { ...state, items: { ...(state.items ?? {}), [item]: entry } };
}

export function mergeContext(state, context) {
  return { ...state, context: { ...(state.context ?? {}), ...context } };
}

export function setSetting(state, { status, name }) {
  if (!['done', 'pending'].includes(status)) throw new Error('setting status must be done or pending');
  const settings = { done: [], pending: [], ...(state.settings ?? {}) };
  const other = status === 'done' ? 'pending' : 'done';
  settings[other] = settings[other].filter(entry => entry !== name);
  settings[status] = [...new Set([...settings[status], name])];
  return { ...state, settings };
}

function withoutNotes(value) {
  if (Array.isArray(value)) return value.map(withoutNotes);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'note').map(([key, entry]) => [key, withoutNotes(entry)]));
}

export function addConfigSections(config, defaults, sections) {
  const next = { ...config };
  for (const section of sections) {
    if (!(section in defaults)) throw new Error(`unknown config section "${section}", use one of: ${Object.keys(defaults).join(', ')}`);
    if (!(section in next)) next[section] = withoutNotes(defaults[section]);
  }
  return next;
}

export function setConfigSection(config, section, values) {
  const current = config[section];
  const merged = current && typeof current === 'object' && !Array.isArray(current) ? { ...current, ...values } : values;
  return { ...config, [section]: merged };
}

export function listPending(root) {
  const base = join(root, '.ai-kit', 'pending');
  if (!existsSync(base)) return [];
  return listFilesRecursively(base).filter(file => file.endsWith('.pending')).map(file => {
    const pending = relative(root, file).split('\\').join('/');
    const target = fromPendingPath(pending);
    return { pending, target, copied: existsSync(join(root, target)) };
  });
}

function readJsonFile(path, fallback) {
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : fallback;
}

export function verifyFiles(state, root) {
  return Object.entries(state.files ?? {}).flatMap(([path, info]) => {
    const absolute = join(root, path);
    if (!existsSync(absolute)) return [{ path, problem: 'missing', items: info.items }];
    if (info.hash === 'merged') return [];
    return hashFile(absolute) === info.hash ? [] : [{ path, problem: 'changed since the kit wrote it', items: info.items }];
  });
}

export const TOOL_PROTECTED_DEST = [/^\.claude\//, /^\.mcp\.json$/, /^\.git\//, /^\.husky\//, /^\.cursor\//, /^\.vscode\//, /^lefthook\.ya?ml$/, /^\.pre-commit-config\.yaml$/];

export function isToolProtected(path) {
  return TOOL_PROTECTED_DEST.some(pattern => pattern.test(path));
}

export function toPendingPath(path) {
  const segments = path.split('/').map(segment => (segment.startsWith('.') ? `dot-${segment.slice(1)}` : segment));
  const last = segments.pop();
  return ['.ai-kit', 'pending', ...segments, `${last}.pending`].join('/');
}

export function fromPendingPath(path) {
  const inner = path.replace(/^\.ai-kit\/pending\//, '').replace(/\.pending$/, '');
  return inner
    .split('/')
    .map(segment => (segment.startsWith('dot-') ? `.${segment.slice(4)}` : segment))
    .join('/');
}

export function installTemplate({ root, template, dest, force = false }) {
  const source = resolve(TEMPLATES_DIR, template);
  if (relative(TEMPLATES_DIR, source).startsWith('..')) throw new Error(`template is outside the templates folder: ${template}`);
  if (!existsSync(source)) throw new Error(`template not found: ${template}`);
  const target = resolve(root, dest);
  if (relative(root, target).startsWith('..')) throw new Error(`destination is outside the project: ${dest}`);
  if (isToolProtected(relative(root, target).split('\\').join('/'))) {
    throw Object.assign(
      new Error(`${dest} is protected by the AI tool. Write it with the tool's own file tools so the developer gets the approval prompt, or stage it with: kit.mjs install ${template} ${toPendingPath(dest)}`),
      { code: 'PROTECTED' },
    );
  }
  const sourceFiles = listFilesRecursively(source);
  const targets = sourceFiles.map(file => (statSync(source).isDirectory() ? join(target, relative(source, file)) : target));
  const existing = targets.filter(existsSync);
  if (existing.length > 0 && !force) {
    const list = existing.map(file => relative(root, file)).join(', ');
    throw Object.assign(new Error(`already exists, merge instead of overwriting: ${list}`), { code: 'EXISTS' });
  }
  mkdirSync(dirname(target), { recursive: true });
  cpSync(source, target, { recursive: true, force: true });
  return targets;
}

function readOption(args, name) {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : null;
}

function positional(args) {
  const values = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index].startsWith('--')) {
      if (['item', 'answers', 'note', 'missing', 'file', 'via', 'config'].includes(args[index].slice(2))) index += 1;
      continue;
    }
    values.push(args[index]);
  }
  return values;
}

export const GUARD_SAMPLES = [
  { guard: 'git-guard.mjs', tool: 'Bash', input: { command: 'git push origin main' }, expect: 'deny' },
  { guard: 'git-guard.mjs', tool: 'Bash', input: { command: 'git status' }, expect: 'allow' },
  { guard: 'danger-guard.mjs', tool: 'Bash', input: { command: 'rm -rf ~/' }, expect: 'ask' },
  { guard: 'danger-guard.mjs', tool: 'Bash', input: { command: 'git commit --no-verify -m wip' }, expect: 'ask' },
  { guard: 'danger-guard.mjs', tool: 'Bash', input: { command: 'rm -rf dist' }, expect: 'allow' },
  { guard: 'protect-guard.mjs', tool: 'Edit', input: { file_path: '.claude/settings.json' }, expect: 'ask' },
  { guard: 'protect-guard.mjs', tool: 'Edit', input: { file_path: 'src/index.ts' }, expect: 'allow' },
  { guard: 'env-guard.mjs', tool: 'Read', input: { file_path: '.env' }, expect: 'deny' },
  { guard: 'env-guard.mjs', tool: 'Bash', input: { command: 'cat .env.local' }, expect: 'deny' },
  { guard: 'env-guard.mjs', tool: 'Read', input: { file_path: '.env.example' }, expect: 'allow' },
  { guard: 'deps-guard.mjs', tool: 'Bash', input: { command: 'npm ci' }, expect: 'allow' },
  { guard: 'deps-guard.mjs', tool: 'Bash', input: { command: 'npm install react' }, expect: 'allow' },
  { guard: 'deps-guard.mjs', tool: 'Bash', input: { command: 'pip install requests' }, expect: 'allow' },
];

const USES_LINE = /^(\s*-?\s*uses:\s*)(["']?)([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)((?:\/[^@\s"']+)?)@([^\s"'#]+)\2(\s*#[^\r]*)?(\r?)$/;

export function findUnpinnedActions(text) {
  return text.split('\n').flatMap((line, index) => {
    const match = line.match(USES_LINE);
    if (!match || /^[0-9a-f]{40}$/.test(match[5])) return [];
    return [{ line: index + 1, repo: match[3], path: match[4], ref: match[5] }];
  });
}

export function lsRemote(repo, ref) {
  const output = execFileSync('git', ['ls-remote', `https://github.com/${repo}`, `refs/tags/${ref}`, `refs/tags/${ref}^{}`, `refs/heads/${ref}`], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 30000,
  });
  return output.split('\n').filter(Boolean).map(line => {
    const [sha, name] = line.split('\t');
    return { sha, name };
  });
}

export function resolveActionSha(repo, ref, listRefs = lsRemote) {
  const refs = listRefs(repo, ref);
  const pick = name => refs.find(entry => entry.name === name)?.sha;
  return pick(`refs/tags/${ref}^{}`) ?? pick(`refs/tags/${ref}`) ?? pick(`refs/heads/${ref}`) ?? null;
}

export function pinWorkflowText(text, resolve = resolveActionSha) {
  const pinned = [];
  const failed = [];
  const lines = text.split('\n').map(line => {
    const match = line.match(USES_LINE);
    if (!match || /^[0-9a-f]{40}$/.test(match[5])) return line;
    const [, prefix, quote, repo, path, ref, comment = '', carriage = ''] = match;
    const extra = comment.replace(/^\s*#\s*/, '').replace(new RegExp(`^${ref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b\\s*`), '').trim();
    let sha = null;
    try {
      sha = resolve(repo, ref);
    } catch {
      sha = null;
    }
    if (!sha) {
      failed.push(`${repo}${path}@${ref}`);
      return line;
    }
    pinned.push(`${repo}${path}@${ref}`);
    return `${prefix}${quote}${repo}${path}@${sha}${quote} # ${ref}${extra ? ` ${extra}` : ''}${carriage}`;
  });
  return { text: lines.join('\n'), pinned, failed };
}

export function readDecision(stdout) {
  const text = stdout.trim();
  if (!text) return 'allow';
  const parsed = JSON.parse(text);
  return parsed.hookSpecificOutput?.permissionDecision ?? parsed.permissionDecision ?? parsed.permission ?? 'allow';
}

export function runGuardTests(root, samples = GUARD_SAMPLES) {
  const hooksDir = join(root, '.ai-kit', 'hooks');
  return samples
    .filter(sample => existsSync(join(hooksDir, sample.guard)))
    .map(sample => {
      const payload = JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: sample.tool, tool_input: sample.input, cwd: root });
      const result = spawnSync(process.execPath, [join(hooksDir, sample.guard)], {
        input: payload,
        encoding: 'utf8',
        env: { ...process.env, CLAUDE_PROJECT_DIR: root },
      });
      const actual = result.status === 0 ? readDecision(result.stdout) : `error (${result.stderr.trim().split('\n')[0]})`;
      return { ...sample, actual, ok: actual === sample.expect };
    });
}

export function readPluginRules(root, plugin, via, configName = 'recommended') {
  const fromRoot = createRequire(join(root, 'package.json'));
  const base = via ? createRequire(fromRoot.resolve(via)) : fromRoot;
  const loaded = base(plugin);
  const config = loaded.configs?.[configName] ?? loaded.default?.configs?.[configName];
  if (!config) throw new Error(`${plugin} has no "${configName}" config`);
  return config.rules ?? {};
}

const MUTATING_COMMANDS = new Set(['install', 'record', 'state', 'context', 'setting', 'config']);

export function run(argv, cwd = process.cwd()) {
  const root = findProjectRoot(cwd);
  if (MUTATING_COMMANDS.has(argv[0])) return withStateLock(root, () => runCommand(argv, cwd, root));
  return runCommand(argv, cwd, root);
}

function runCommand(argv, cwd, root) {
  const [command, ...args] = argv;
  if (!command || command === 'help' || command === '--help') return USAGE;
  if (command === 'templates') {
    const prefix = args[0] ?? '';
    return listFilesRecursively(TEMPLATES_DIR)
      .map(file => relative(TEMPLATES_DIR, file).split('\\').join('/'))
      .filter(file => file.startsWith(prefix))
      .join('\n');
  }
  if (command === 'guard-test') {
    const results = runGuardTests(root);
    if (results.length === 0) return 'No guards installed in .ai-kit/hooks.';
    const lines = results.map(entry => `${entry.ok ? 'ok  ' : 'FAIL'} ${entry.guard} ${JSON.stringify(entry.input)} -> ${entry.actual}${entry.ok ? '' : ` (expected ${entry.expect})`}`);
    const failed = results.filter(entry => !entry.ok).length;
    if (failed > 0) throw Object.assign(new Error(`${lines.join('\n')}\n${failed} guard answer(s) wrong`), { code: 'GUARD' });
    return lines.join('\n');
  }
  if (command === 'plugin-rules') {
    const [plugin] = positional(args);
    if (!plugin) throw new Error(USAGE);
    return JSON.stringify(readPluginRules(root, plugin, readOption(args, 'via'), readOption(args, 'config') ?? 'recommended'), null, 2);
  }
  if (command === 'uninstall-plan') {
    const [item] = positional(args);
    const all = args.includes('--all');
    if (!item && !all) throw new Error(USAGE);
    const plan = planRemoval(loadState(root), root, { item, all });
    return args.includes('--json') ? JSON.stringify(plan, null, 2) : formatRemovalPlan(plan);
  }
  if (command === 'outdated') {
    return checkOutdated(root).then(results => (args.includes('--json') ? JSON.stringify(results, null, 2) : formatOutdated(results)));
  }
  if (command === 'pin-actions') {
    const files = positional(args).map(path => resolve(cwd, path));
    if (files.length === 0) throw new Error(USAGE);
    if (args.includes('--check')) {
      const unpinned = files.flatMap(file => findUnpinnedActions(readFileSync(file, 'utf8')).map(entry => `${relative(root, file)}:${entry.line} ${entry.repo}${entry.path}@${entry.ref}`));
      if (unpinned.length > 0) throw Object.assign(new Error(`Not pinned to a commit SHA:\n${unpinned.join('\n')}`), { code: 'UNPINNED' });
      return 'Every action is pinned to a commit SHA.';
    }
    const report = files.map(file => {
      const result = pinWorkflowText(readFileSync(file, 'utf8'));
      if (result.pinned.length > 0) writeFileAtomically(file, result.text);
      return `${relative(root, file)}: pinned ${result.pinned.length}${result.failed.length ? `, could not resolve ${result.failed.join(', ')}` : ''}`;
    });
    return `${report.join('\n')}\nRecord the changed files again: node kit.mjs record <files> --item <their item>.`;
  }
  if (command === 'verify') {
    const problems = verifyFiles(loadState(root), root);
    if (problems.length === 0) return 'All recorded files are unchanged.';
    return problems.map(entry => `${entry.path}: ${entry.problem} (items ${entry.items.join(', ')})`).join('\n');
  }
  if (command === 'state') {
    const [item, value] = positional(args);
    if (!item || !value) throw new Error(USAGE);
    const answersText = readOption(args, 'answers');
    const next = setItemState(loadState(root), {
      item,
      value,
      answers: answersText ? JSON.parse(answersText) : null,
      note: readOption(args, 'note'),
      missing: readOption(args, 'missing'),
    });
    saveState(root, next);
    return `Item ${item} is now ${value}.`;
  }
  if (command === 'setting') {
    const [status, name] = positional(args);
    if (!status || !name) throw new Error(USAGE);
    saveState(root, setSetting(loadState(root), { status, name }));
    return `Setting "${name}" recorded as ${status}.`;
  }
  if (command === 'config') {
    const [action, ...rest] = positional(args);
    const configPath = join(root, '.ai-kit', 'config.json');
    const defaults = readJsonFile(join(TEMPLATES_DIR, 'checks', 'config.json'), {});
    const current = readJsonFile(configPath, {});
    let next;
    if (action === 'add') next = addConfigSections(current, defaults, rest);
    else if (action === 'set' && rest.length >= 1 && (rest.length === 2 || readOption(args, 'file'))) {
      const valuesText = readOption(args, 'file') ? readFileSync(resolve(cwd, readOption(args, 'file')), 'utf8') : rest[1];
      next = setConfigSection(current, rest[0], JSON.parse(valuesText));
    }
    else throw new Error(USAGE);
    mkdirSync(dirname(configPath), { recursive: true });
    writeFileAtomically(configPath, `${JSON.stringify(next, null, 2)}\n`);
    const item = readOption(args, 'item');
    if (item) saveState(root, recordFiles(loadState(root), { root, item, paths: [configPath] }));
    const sections = action === 'add' ? rest.join(', ') : rest[0];
    return `Updated .ai-kit/config.json (${action} ${sections})${item ? ` and recorded it for item ${item}` : ''}.`;
  }
  if (command === 'pending') {
    const [action = 'list'] = positional(args);
    const entries = listPending(root);
    if (action === 'list') {
      if (entries.length === 0) return 'Nothing pending.';
      return entries.map(entry => `${entry.copied ? 'copied ' : 'pending'}  ${entry.pending} -> ${entry.target}`).join('\n');
    }
    if (action === 'apply') {
      const todo = entries.filter(entry => !entry.copied || args.includes('--force'));
      for (const entry of todo) {
        mkdirSync(dirname(join(root, entry.target)), { recursive: true });
        cpSync(join(root, entry.pending), join(root, entry.target));
      }
      const skipped = entries.length - todo.length;
      return `Copied ${todo.length} file(s)${skipped ? `; ${skipped} target(s) already exist, merge them by hand or use --force` : ''}. Next: run the follow-up commands from the setup summary, then: node kit.mjs pending clean`;
    }
    if (action === 'clean') {
      const left = entries.filter(entry => !entry.copied);
      if (left.length > 0) throw new Error(`still pending: ${left.map(entry => entry.target).join(', ')}`);
      rmSync(join(root, '.ai-kit', 'pending'), { recursive: true, force: true });
      return 'Removed .ai-kit/pending.';
    }
    throw new Error(USAGE);
  }
  if (command === 'context') {
    const [json] = positional(args);
    if (!json) throw new Error(USAGE);
    saveState(root, mergeContext(loadState(root), JSON.parse(json)));
    return 'Context saved.';
  }
  const item = readOption(args, 'item');
  if (!item) throw new Error(`--item is required\n${USAGE}`);
  if (command === 'install') {
    const [template, dest] = positional(args);
    if (!template || !dest) throw new Error(USAGE);
    const written = installTemplate({ root, template, dest, force: args.includes('--force') });
    saveState(root, recordFiles(loadState(root), { root, item, paths: written }));
    return `Installed ${written.map(file => relative(root, file)).join(', ')} for item ${item}.`;
  }
  if (command === 'record') {
    const paths = positional(args).map(path => resolve(cwd, path));
    const missing = paths.filter(path => !existsSync(path));
    if (missing.length > 0) throw new Error(`not found: ${missing.join(', ')}`);
    saveState(root, recordFiles(loadState(root), { root, item, paths: paths.flatMap(listFilesRecursively), merged: args.includes('--merged') }));
    return `Recorded ${paths.length} path(s) for item ${item}.`;
  }
  throw new Error(USAGE);
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  try {
    process.stdout.write(`${await run(process.argv.slice(2))}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = { EXISTS: 3, PROTECTED: 4, UNPINNED: 5 }[error.code] ?? 1;
  }
}
