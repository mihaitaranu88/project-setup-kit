import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { basename, dirname, extname, join, normalize, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { REPO_ROOT, annotate, isCi, loadKitConfig } from './lib.mjs';

const MARKDOWN_LINK = /\[[^\]]*\]\(([^)\s#]+)(?:#[^)]*)?\)/g;
const BACKTICK_PATH = /`((?:\.claude|\.github|\.cursor|\.ai-kit|docs)\/[^`\s*{}<>]+)`/g;

function toPosix(path) {
  return path.split(sep).join('/');
}

function listEntries(root, dir) {
  const absolute = join(root, dir);
  if (!existsSync(absolute)) return [];
  return readdirSync(absolute)
    .filter(name => !name.startsWith('.') && name.toLowerCase() !== 'readme.md')
    .map(name => {
      const path = toPosix(join(dir, name));
      const isDirectory = statSync(join(root, path)).isDirectory();
      return {
        path,
        name: isDirectory ? name : basename(name, extname(name)).replace(/\.(agent|prompt)$/, ''),
        markdownFiles: isDirectory ? [`${path}/SKILL.md`].filter(file => existsSync(join(root, file))) : [path],
      };
    })
    .filter(entry => entry.markdownFiles.length > 0 && entry.markdownFiles.every(file => file.endsWith('.md')));
}

export function filterIgnored(root, paths) {
  if (paths.length === 0) return paths;
  const result = spawnSync('git', ['check-ignore', '--stdin'], { cwd: root, input: paths.join('\n'), encoding: 'utf8' });
  if (result.error || (result.status !== 0 && result.status !== 1)) return paths;
  const ignored = new Set(result.stdout.split(/\r?\n/).filter(Boolean).map(path => toPosix(path).replace(/\/$/, '')));
  return paths.filter(path => !ignored.has(path));
}

export function toPendingPath(path) {
  const segments = path.split('/').map(segment => (segment.startsWith('.') && segment !== '.' && segment !== '..' ? `dot-${segment.slice(1)}` : segment));
  const last = segments.pop();
  return ['.ai-kit', 'pending', ...segments, `${last}.pending`].join('/');
}

function existsOrPending(root, target, acceptPending) {
  if (existsSync(join(root, target))) return true;
  if (!acceptPending) return false;
  const pending = join(root, toPendingPath(target));
  const pendingDir = pending.replace(/\.pending$/, '');
  return existsSync(pending) || existsSync(pendingDir);
}

export function findBrokenReferences(root, file, { acceptPending = true } = {}) {
  const content = readFileSync(join(root, file), 'utf8');
  const fromFile = [...content.matchAll(MARKDOWN_LINK)]
    .map(match => match[1])
    .filter(target => !/^[a-z]+:/i.test(target))
    .map(target => toPosix(normalize(join(dirname(file), decodeURIComponent(target)))));
  const fromRoot = [...content.matchAll(BACKTICK_PATH)].map(match => toPosix(normalize(match[1].replace(/[.,:;)]$/, ''))));
  return [...new Set([...fromFile, ...fromRoot])]
    .filter(target => !relative(root, join(root, target)).startsWith('..'))
    .filter(target => !existsOrPending(root, target, acceptPending));
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function isMentioned(text, entry) {
  const name = escapeRegex(entry.name);
  const asCode = new RegExp(`\`/?${name}\``);
  const asCommand = new RegExp(`(^|[\\s(])/${name}(?![\\w-])`);
  const asPath = new RegExp(`${escapeRegex(entry.path)}|/${name}(?:\\.(?:agent|prompt))?\\.md|/${name}/SKILL\\.md`);
  return asCode.test(text) || asCommand.test(text) || asPath.test(text);
}

export function evaluateAgentDocs(root, settings, { acceptPending = true } = {}) {
  const problems = [];
  const rosterText = (settings.roster ?? [])
    .filter(file => existsSync(join(root, file)))
    .map(file => readFileSync(join(root, file), 'utf8'))
    .join('\n');
  const listed = (settings.dirs ?? []).flatMap(dir => listEntries(root, dir));
  const tracked = new Set(filterIgnored(root, listed.map(entry => entry.path)));
  const entries = listed.filter(entry => tracked.has(entry.path));
  for (const entry of entries) {
    if (!isMentioned(rosterText, entry)) {
      problems.push(`${entry.path} exists but is not mentioned in ${settings.roster.join(', ')}`);
    }
  }
  const filesToCheck = [
    ...(settings.linkCheckFiles ?? []).filter(file => existsSync(join(root, file))),
    ...entries.flatMap(entry => entry.markdownFiles),
  ];
  for (const file of [...new Set(filesToCheck)]) {
    const broken = findBrokenReferences(root, file, { acceptPending });
    const tracked = new Set(filterIgnored(root, broken));
    for (const target of broken) {
      problems.push(tracked.has(target) ? `${file} points to ${target}, which does not exist` : `${file} points to ${target}, which git ignores: it exists only on some machines, so teammates and CI agents cannot open it. Link a committed file instead, or say in plain words that it is a local file.`);
    }
  }
  return problems;
}

function main() {
  const settings = loadKitConfig().agentDocs ?? { roster: ['AGENTS.md'], dirs: [], linkCheckFiles: ['AGENTS.md'] };
  const problems = evaluateAgentDocs(REPO_ROOT, settings, { acceptPending: !isCi() });
  if (problems.length === 0) {
    process.stdout.write('Agent docs are consistent.\n');
    return;
  }
  for (const problem of problems) annotate('error', problem);
  process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) main();
