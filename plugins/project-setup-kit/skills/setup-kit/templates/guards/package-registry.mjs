import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const DAY_MS = 24 * 60 * 60 * 1000;

export const DEFAULT_DEPENDENCY_POLICY = {
  minAgeDays: 14,
  minWeeklyDownloads: 50,
  allow: [],
  timeoutMs: 5000,
};

export function resolveDependencyPolicy(config, root = null) {
  const policy = { ...DEFAULT_DEPENDENCY_POLICY, ...(config.dependencyCheck ?? {}) };
  if (!root) return policy;
  const registries = readPrivateRegistries(root);
  return { ...policy, allow: [...(policy.allow ?? []), ...registries.allow], privateEcosystems: registries.ecosystems };
}

function readText(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return '';
  }
}

function findCaseInsensitive(dir, name) {
  try {
    const match = readdirSync(dir).find(entry => entry.toLowerCase() === name.toLowerCase());
    return match ? readText(join(dir, match)) : '';
  } catch {
    return '';
  }
}

function goEnv(names) {
  try {
    return execFileSync('go', ['env', ...names], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 3000 }).split(/\r?\n/);
  } catch {
    return [];
  }
}

export function readPrivateRegistries(root, { home = homedir(), env = process.env, readGoEnv = goEnv } = {}) {
  const allow = [];
  const ecosystems = [];
  const npmrc = `${readText(join(root, '.npmrc'))}\n${readText(join(home, '.npmrc'))}`;
  for (const match of npmrc.matchAll(/^\s*(@[^:\s]+):registry\s*=/gm)) allow.push(`${match[1]}/*`);
  const npmRegistry = npmrc.match(/^\s*registry\s*=\s*(\S+)/m)?.[1] ?? env.npm_config_registry ?? env.NPM_CONFIG_REGISTRY;
  if (npmRegistry && !/registry\.npmjs\.org/.test(npmRegistry)) ecosystems.push('npm');
  const yarnrc = readText(join(root, '.yarnrc.yml'));
  const yarnRegistry = yarnrc.match(/^npmRegistryServer:\s*["']?(\S+?)["']?\s*$/m)?.[1];
  if (yarnRegistry && !/registry\.(?:npmjs\.org|yarnpkg\.com)/.test(yarnRegistry)) ecosystems.push('npm');
  const scopes = yarnrc.match(/^npmScopes:\s*\n((?:[ \t]+.*\n?)*)/m)?.[1] ?? '';
  for (const match of scopes.matchAll(/^[ \t]{2}["']?([a-z0-9][a-z0-9._-]*)["']?:\s*$/gm)) allow.push(`@${match[1]}/*`);
  const pipFiles = [join(root, 'pip.conf'), join(home, '.config', 'pip', 'pip.conf'), join(home, '.pip', 'pip.conf'), join(env.APPDATA ?? home, 'pip', 'pip.ini')];
  const python = [...pipFiles.map(readText), readText(join(root, 'pyproject.toml')), readText(join(root, 'uv.toml'))].join('\n');
  if (/^\s*(?:extra-)?index-url\s*=|\[\[tool\.uv\.index\]\]|\[\[index\]\]|\[\[tool\.poetry\.source\]\]/m.test(python) || env.PIP_INDEX_URL || env.UV_INDEX_URL || env.UV_DEFAULT_INDEX) ecosystems.push('pypi');
  const composer = readText(join(root, 'composer.json'));
  if (/"repositories"\s*:/.test(composer)) ecosystems.push('packagist');
  const nuget = findCaseInsensitive(root, 'nuget.config');
  if (/<add\s+key="[^"]+"\s+value="https?:\/\/(?!api\.nuget\.org)/i.test(nuget)) ecosystems.push('nuget');
  const maven = `${readText(join(root, 'pom.xml'))}\n${readText(join(home, '.m2', 'settings.xml'))}`;
  if (/<repositories>|<mirror>/.test(maven) || /repositories\s*\{[^}]*maven\s*\{/.test(readText(join(root, 'build.gradle')) + readText(join(root, 'build.gradle.kts')) + readText(join(root, 'settings.gradle.kts')))) ecosystems.push('maven');
  const goPrivate = [env.GOPRIVATE, env.GONOPROXY, ...(env.GOPRIVATE === undefined ? readGoEnv(['GOPRIVATE', 'GONOPROXY']) : [])].filter(Boolean).join(',');
  for (const pattern of goPrivate.split(',').map(value => value.trim()).filter(Boolean)) allow.push(`${pattern}*`);
  return { allow: [...new Set(allow)], ecosystems: [...new Set(ecosystems)] };
}

function globToRegex(glob) {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`);
}

export function isAllowed(name, policy) {
  return (policy.allow ?? []).some(pattern => globToRegex(pattern).test(name));
}

function encodeGoModule(path) {
  return path.replace(/[A-Z]/g, letter => `!${letter.toLowerCase()}`);
}

async function getJson(url, { fetchImpl, timeoutMs }) {
  const response = await fetchImpl(url, {
    headers: { accept: 'application/json', 'user-agent': 'project-setup-kit dependency check' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (response.status === 404) return { missing: true };
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
  return { body: await response.json() };
}

async function getText(url, { fetchImpl, timeoutMs }) {
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (response.status === 404 || response.status === 410) return { missing: true };
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
  return { body: await response.text() };
}

function earliest(dates) {
  const times = dates.map(value => Date.parse(value)).filter(Number.isFinite);
  return times.length > 0 ? new Date(Math.min(...times)) : null;
}

const LOOKUPS = {
  async npm(name, options) {
    const meta = await getJson(`https://registry.npmjs.org/${name.replace('/', '%2F')}`, options);
    if (meta.missing) return { exists: false };
    const downloads = await getJson(`https://api.npmjs.org/downloads/point/last-week/${name}`, options).catch(() => ({}));
    return {
      exists: true,
      createdAt: meta.body.time?.created ? new Date(meta.body.time.created) : null,
      weeklyDownloads: typeof downloads.body?.downloads === 'number' ? downloads.body.downloads : null,
    };
  },
  async pypi(name, options) {
    const meta = await getJson(`https://pypi.org/pypi/${encodeURIComponent(name)}/json`, options);
    if (meta.missing) return { exists: false };
    const uploads = Object.values(meta.body.releases ?? {}).flat().map(file => file.upload_time_iso_8601 ?? file.upload_time);
    const stats = await getJson(`https://pypistats.org/api/packages/${encodeURIComponent(name.toLowerCase())}/recent`, options).catch(() => ({}));
    const weekly = stats.body?.data?.last_week;
    return { exists: true, createdAt: earliest(uploads), weeklyDownloads: typeof weekly === 'number' ? weekly : null };
  },
  async packagist(name, options) {
    const meta = await getJson(`https://repo.packagist.org/p2/${name.toLowerCase()}.json`, options);
    if (meta.missing) return { exists: false };
    const versions = meta.body.packages?.[name.toLowerCase()] ?? [];
    const stats = await getJson(`https://packagist.org/packages/${name.toLowerCase()}/stats.json`, options).catch(() => ({}));
    const monthly = stats.body?.downloads?.monthly;
    return { exists: true, createdAt: earliest(versions.map(version => version.time)), weeklyDownloads: typeof monthly === 'number' ? Math.round(monthly / 4.3) : null };
  },
  async crates(name, options) {
    const meta = await getJson(`https://crates.io/api/v1/crates/${encodeURIComponent(name)}`, options);
    if (meta.missing) return { exists: false };
    const recent = meta.body.crate?.recent_downloads;
    return {
      exists: true,
      createdAt: meta.body.crate?.created_at ? new Date(meta.body.crate.created_at) : null,
      weeklyDownloads: typeof recent === 'number' ? Math.round(recent / 13) : null,
    };
  },
  async rubygems(name, options) {
    const versions = await getJson(`https://rubygems.org/api/v1/versions/${encodeURIComponent(name)}.json`, options);
    if (versions.missing) return { exists: false };
    return { exists: true, createdAt: earliest((versions.body ?? []).map(version => version.created_at)), weeklyDownloads: null };
  },
  async nuget(name, options) {
    const versions = await getJson(`https://api.nuget.org/v3-flatcontainer/${name.toLowerCase()}/index.json`, options);
    if (versions.missing) return { exists: false };
    return { exists: true, createdAt: null, weeklyDownloads: null };
  },
  async go(name, options) {
    const segments = name.split('/');
    for (let length = segments.length; length >= Math.min(3, segments.length); length -= 1) {
      const candidate = segments.slice(0, length).join('/');
      const versions = await getText(`https://proxy.golang.org/${encodeGoModule(candidate)}/@v/list`, options);
      if (versions.missing) continue;
      const tags = versions.body.split('\n').map(line => line.trim()).filter(Boolean);
      const infos = await Promise.all(
        tags.slice(0, 20).map(tag => getJson(`https://proxy.golang.org/${encodeGoModule(candidate)}/@v/${tag}.info`, options).catch(() => ({}))),
      );
      const latest = tags.length === 0 ? await getJson(`https://proxy.golang.org/${encodeGoModule(candidate)}/@latest`, options).catch(() => ({})) : null;
      if (tags.length === 0 && latest?.missing) continue;
      return { exists: true, module: candidate, createdAt: earliest([...infos.map(info => info.body?.Time), latest?.body?.Time]), weeklyDownloads: null };
    }
    return { exists: false };
  },
  async maven(name, options) {
    const [group, artifact] = name.split(':');
    const metadata = await getText(`https://repo1.maven.org/maven2/${group.replace(/\./g, '/')}/${artifact}/maven-metadata.xml`, options);
    if (metadata.missing) return { exists: false };
    return { exists: true, createdAt: null, weeklyDownloads: null };
  },
};

export const ECOSYSTEM_LABELS = { npm: 'npm', pypi: 'PyPI', packagist: 'Packagist', crates: 'crates.io', go: 'the Go module proxy', maven: 'Maven Central', rubygems: 'RubyGems', nuget: 'NuGet' };

export async function lookupPackage(ecosystem, name, { fetchImpl = globalThis.fetch, timeoutMs = DEFAULT_DEPENDENCY_POLICY.timeoutMs } = {}) {
  const lookup = LOOKUPS[ecosystem];
  if (!lookup) return { exists: null, error: `no lookup for ${ecosystem}` };
  try {
    return await lookup(name, { fetchImpl, timeoutMs });
  } catch (error) {
    return { exists: null, error: error.message };
  }
}

export function assessPackage(info, policy, now = Date.now()) {
  if (info.exists === false) return { level: 'block', reasons: ['does not exist on the registry (a mistyped or invented name, or one an attacker can register)'] };
  if (info.exists !== true) return { level: 'unknown', reasons: [`could not be checked (${info.error ?? 'no answer'})`] };
  const reasons = [];
  if (info.createdAt) {
    const ageDays = Math.floor((now - info.createdAt.getTime()) / DAY_MS);
    if (ageDays < policy.minAgeDays) reasons.push(`was first published ${ageDays} day${ageDays === 1 ? '' : 's'} ago`);
  }
  if (typeof info.weeklyDownloads === 'number' && info.weeklyDownloads < policy.minWeeklyDownloads) {
    reasons.push(`has only ${info.weeklyDownloads} downloads a week`);
  }
  return reasons.length > 0 ? { level: 'warn', reasons } : { level: 'ok', reasons: [] };
}

export async function checkPackages(packages, policy, options = {}) {
  const privateEcosystems = new Set(policy.privateEcosystems ?? []);
  const results = await Promise.all(
    packages
      .filter(pkg => !pkg.privateSource && !isAllowed(pkg.name, policy) && !privateEcosystems.has(pkg.ecosystem))
      .map(async pkg => ({ ...pkg, ...assessPackage(await lookupPackage(pkg.ecosystem, pkg.name, { timeoutMs: policy.timeoutMs, ...options }), policy, options.now) })),
  );
  return results;
}

export function describeResult(result) {
  return `${result.name} (${ECOSYSTEM_LABELS[result.ecosystem] ?? result.ecosystem}) ${result.reasons.join(' and ')}`;
}

function splitWords(command) {
  return [...command.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)].map(match => match[1] ?? match[2] ?? match[3]);
}

const SEGMENT_SEPARATOR = /\s*(?:&&|\|\||;|\||\r?\n)\s*/;
const REDIRECT = /^\d*(?:>>?|<|&>)&?\d*$/;
const REDIRECT_WITH_TARGET = /^\d*(?:>>?|<|&>)\S+$/;

function withoutRedirections(words) {
  const kept = [];
  for (let index = 0; index < words.length; index += 1) {
    const word = words[index];
    if (REDIRECT.test(word)) {
      if (!/&\d$/.test(word)) index += 1;
      continue;
    }
    if (REDIRECT_WITH_TARGET.test(word)) continue;
    kept.push(word);
  }
  return kept;
}

function isLocalSpec(spec) {
  return /^(?:\.{0,2}[\\/]|~|[a-z][a-z0-9+.-]*:|git\+)/i.test(spec) || /\.(?:tgz|tar\.gz|whl|zip|gem|nupkg)$/i.test(spec);
}

function npmName(spec) {
  const alias = spec.match(/^(?:@[^/@\s]+\/)?[^@\s]+@npm:(.+)$/);
  if (alias) return npmName(alias[1]);
  if (isLocalSpec(spec)) return null;
  if (!spec.startsWith('@') && spec.includes('/')) return null;
  const at = spec.indexOf('@', 1);
  const name = at > 0 ? spec.slice(0, at) : spec;
  return /^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/i.test(name) ? name : null;
}

function pythonName(spec) {
  if (isLocalSpec(spec) || /\s@\s|^\S+\s*@\s*\S+:\/\//.test(spec)) return null;
  const match = spec.match(/^([A-Za-z0-9][A-Za-z0-9._-]*)/);
  return match ? match[1] : null;
}

const NPM_FLAGS = ['--registry', '--tag', '--prefix', '--workspace', '--omit', '--include', '--cache', '--userconfig', '--loglevel', '--save-prefix', '--install-strategy', '--before'];
const PIP_FLAGS = ['-r', '--requirement', '-e', '--editable', '-c', '--constraint', '-i', '--index-url', '--extra-index-url', '-f', '--find-links', '-t', '--target', '--trusted-host', '--timeout', '--retries', '--platform', '--python-version', '--implementation', '--abi', '--root', '--prefix', '--src', '--cache-dir', '--log', '--proxy', '--cert', '--client-cert', '--exists-action', '--progress-bar', '--upgrade-strategy', '--no-binary', '--only-binary', '--config-settings', '-C'];
const PIP_PRIVATE = ['-i', '--index-url', '--extra-index-url', '-f', '--find-links'];

const INSTALLERS = [
  { tools: ['npm'], verbs: [['i'], ['install'], ['add']], ecosystem: 'npm', name: npmName, flagsWithValue: [...NPM_FLAGS, '-w'], privateFlags: ['--registry'] },
  { tools: ['pnpm'], verbs: [['i'], ['install'], ['add']], ecosystem: 'npm', name: npmName, flagsWithValue: ['--filter', '-F', '--registry', '--dir', '-C', '--reporter', '--loglevel', '--config', '--save-prefix'], privateFlags: ['--registry'] },
  { tools: ['bun'], verbs: [['i'], ['install'], ['add']], ecosystem: 'npm', name: npmName, flagsWithValue: ['--registry', '--cwd', '--cache-dir', '--backend'], privateFlags: ['--registry'] },
  { tools: ['yarn'], verbs: [['add'], ['global', 'add']], ecosystem: 'npm', name: npmName, flagsWithValue: ['--registry', '--cwd'], privateFlags: ['--registry'] },
  { tools: ['pip', 'pip3'], verbs: [['install']], ecosystem: 'pypi', name: pythonName, flagsWithValue: PIP_FLAGS, privateFlags: PIP_PRIVATE },
  { tools: ['uv'], verbs: [['add'], ['pip', 'install'], ['tool', 'install']], ecosystem: 'pypi', name: pythonName, flagsWithValue: [...PIP_FLAGS, '--requirements', '--group', '--optional', '--index', '--default-index', '--python', '-p', '--package', '--directory', '--project', '--marker', '-m', '--extra', '--rev', '--tag', '--branch'], privateFlags: [...PIP_PRIVATE, '--index', '--default-index'] },
  { tools: ['poetry'], verbs: [['add']], ecosystem: 'pypi', name: pythonName, flagsWithValue: ['-G', '--group', '--source', '-E', '--extras', '--python', '--platform', '--markers', '-C', '--directory'], privateFlags: ['--source'] },
  { tools: ['pipx'], verbs: [['install']], ecosystem: 'pypi', name: pythonName, flagsWithValue: ['--python', '--index-url', '-i', '--pip-args', '--suffix'], privateFlags: ['--index-url', '-i'] },
  { tools: ['composer'], verbs: [['require']], ecosystem: 'packagist', name: spec => (/^[a-z0-9_.-]+\/[a-z0-9_.-]+/i.test(spec) ? spec.split(/[:=\s]/)[0].toLowerCase() : null), flagsWithValue: ['--working-dir', '-d'], privateFlags: [] },
  { tools: ['cargo'], verbs: [['add'], ['install']], ecosystem: 'crates', name: spec => (isLocalSpec(spec) ? null : spec.split('@')[0]), flagsWithValue: ['--path', '--git', '--branch', '--tag', '--rev', '-F', '--features', '--rename', '--registry', '--index', '-p', '--package', '--target', '--target-dir', '--manifest-path', '--vers', '--version', '--config', '--root', '-j', '--jobs', '--profile'], privateFlags: ['--registry', '--index', '--git', '--path'] },
  { tools: ['gem'], verbs: [['install']], ecosystem: 'rubygems', name: spec => (/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(spec) ? spec : null), flagsWithValue: ['-v', '--version', '-i', '--install-dir', '-s', '--source', '-n', '--bindir', '--platform'], privateFlags: ['-s', '--source'] },
  { tools: ['bundle'], verbs: [['add']], ecosystem: 'rubygems', name: spec => (/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(spec) ? spec : null), flagsWithValue: ['--version', '-v', '--group', '-g', '--source', '-s', '--git', '--github', '--path', '--branch', '--ref', '--require'], privateFlags: ['--source', '-s', '--git', '--github', '--path'] },
  { tools: ['dotnet'], verbs: [['add', 'package']], ecosystem: 'nuget', name: spec => (/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(spec) && !/\.(?:cs|fs|vb)proj$/i.test(spec) ? spec : null), flagsWithValue: ['-v', '--version', '-f', '--framework', '-s', '--source', '--package-directory'], privateFlags: ['-s', '--source'] },
  { tools: ['go'], verbs: [['get'], ['install']], ecosystem: 'go', name: spec => (/^[a-z0-9.-]+\.[a-z]{2,}\/\S+/i.test(spec) ? spec.split('@')[0].replace(/\/\.\.\.$/, '') : null), flagsWithValue: ['-C', '-modfile', '-o'], privateFlags: [] },
];

function findVerb(installer, args) {
  let index = 0;
  while (index < args.length && args[index].startsWith('-')) index += installer.flagsWithValue.includes(args[index]) ? 2 : 1;
  for (const verb of installer.verbs) {
    const candidate = [...args.slice(index, index + verb.length)];
    if (installer.tools.includes('dotnet') && verb.length === 2 && args[index] === 'add' && args[index + 2] === 'package') return index + 3;
    if (candidate.join(' ') === verb.join(' ')) return index + verb.length;
  }
  return -1;
}

export function findInstalledPackages(command) {
  const found = [];
  for (const segment of command.split(SEGMENT_SEPARATOR)) {
    const words = withoutRedirections(splitWords(segment.trim()).filter(word => !/^[A-Z_][A-Z0-9_]*=/.test(word)));
    while (['sudo', 'npx', 'python', 'python3', 'py', 'command', 'exec', 'time'].includes(words[0])) {
      if (['python', 'python3', 'py'].includes(words[0])) {
        if (words[1] !== '-m') break;
        words.splice(0, 2);
      } else {
        words.shift();
      }
    }
    if (words.length === 0) continue;
    const tool = words[0].replace(/\.(?:exe|cmd)$/i, '').split(/[\\/]/).pop();
    const installer = INSTALLERS.find(candidate => candidate.tools.includes(tool));
    if (!installer) continue;
    const args = words.slice(1);
    const start = findVerb(installer, args);
    if (start < 0) continue;
    const rest = args.slice(start);
    const custom = rest.some((arg, index) => installer.privateFlags.includes(arg.split('=')[0]) && (arg.includes('=') || index + 1 < rest.length));
    for (let index = 0; index < rest.length; index += 1) {
      const arg = rest[index];
      if (installer.flagsWithValue.includes(arg)) {
        index += 1;
        continue;
      }
      if (arg.startsWith('-')) continue;
      const name = installer.name(arg);
      if (name) found.push({ ecosystem: installer.ecosystem, name, ...(custom ? { privateSource: true } : {}) });
    }
  }
  return found;
}
