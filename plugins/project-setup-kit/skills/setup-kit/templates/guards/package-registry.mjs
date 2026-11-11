const DAY_MS = 24 * 60 * 60 * 1000;

export const DEFAULT_DEPENDENCY_POLICY = {
  minAgeDays: 14,
  minWeeklyDownloads: 50,
  allow: [],
  timeoutMs: 5000,
};

export function resolveDependencyPolicy(config) {
  return { ...DEFAULT_DEPENDENCY_POLICY, ...(config.dependencyCheck ?? {}) };
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
    return { exists: true, createdAt: earliest(uploads), weeklyDownloads: null };
  },
  async packagist(name, options) {
    const meta = await getJson(`https://repo.packagist.org/p2/${name.toLowerCase()}.json`, options);
    if (meta.missing) return { exists: false };
    const versions = meta.body.packages?.[name.toLowerCase()] ?? [];
    return { exists: true, createdAt: earliest(versions.map(version => version.time)), weeklyDownloads: null };
  },
  async crates(name, options) {
    const meta = await getJson(`https://crates.io/api/v1/crates/${encodeURIComponent(name)}`, options);
    if (meta.missing) return { exists: false };
    return { exists: true, createdAt: meta.body.crate?.created_at ? new Date(meta.body.crate.created_at) : null, weeklyDownloads: null };
  },
  async go(name, options) {
    const versions = await getText(`https://proxy.golang.org/${encodeGoModule(name)}/@v/list`, options);
    if (versions.missing) return { exists: false };
    const tags = versions.body.split('\n').map(line => line.trim()).filter(Boolean);
    if (tags.length === 0) return { exists: true, createdAt: null, weeklyDownloads: null };
    const infos = await Promise.all(
      tags.slice(0, 20).map(tag => getJson(`https://proxy.golang.org/${encodeGoModule(name)}/@v/${tag}.info`, options).catch(() => ({}))),
    );
    return { exists: true, createdAt: earliest(infos.map(info => info.body?.Time)), weeklyDownloads: null };
  },
  async maven(name, options) {
    const [group, artifact] = name.split(':');
    const metadata = await getText(`https://repo1.maven.org/maven2/${group.replace(/\./g, '/')}/${artifact}/maven-metadata.xml`, options);
    if (metadata.missing) return { exists: false };
    return { exists: true, createdAt: null, weeklyDownloads: null };
  },
};

export const ECOSYSTEM_LABELS = { npm: 'npm', pypi: 'PyPI', packagist: 'Packagist', crates: 'crates.io', go: 'the Go module proxy', maven: 'Maven Central' };

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
  const results = await Promise.all(
    packages
      .filter(pkg => !isAllowed(pkg.name, policy))
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

const SEGMENT_SEPARATOR = /\s*(?:&&|\|\||;|\|)\s*/;

function isLocalSpec(spec) {
  return /^(?:\.{0,2}\/|~|[a-z]+:|git\+|https?:)/i.test(spec) || spec.endsWith('.tgz') || spec.endsWith('.whl') || spec.endsWith('.tar.gz');
}

function npmName(spec) {
  if (isLocalSpec(spec)) return null;
  if (!spec.startsWith('@') && spec.includes('/')) return null;
  const at = spec.indexOf('@', 1);
  const name = at > 0 ? spec.slice(0, at) : spec;
  return /^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/i.test(name) ? name : null;
}

function pythonName(spec) {
  if (isLocalSpec(spec)) return null;
  const match = spec.match(/^([A-Za-z0-9][A-Za-z0-9._-]*)/);
  return match ? match[1] : null;
}

const INSTALLERS = [
  { pattern: /^(?:npm|pnpm|bun)$/, verbs: ['i', 'install', 'add'], ecosystem: 'npm', name: npmName, flagsWithValue: ['--registry', '--tag', '--filter', '-w', '--workspace', '--prefix'] },
  { pattern: /^yarn$/, verbs: ['add'], ecosystem: 'npm', name: npmName, flagsWithValue: ['--registry'] },
  { pattern: /^(?:pip|pip3)$/, verbs: ['install'], ecosystem: 'pypi', name: pythonName, flagsWithValue: ['-r', '--requirement', '-e', '--editable', '-c', '--constraint', '-i', '--index-url', '--extra-index-url', '-t', '--target'] },
  { pattern: /^uv$/, verbs: ['add', 'pip install'], ecosystem: 'pypi', name: pythonName, flagsWithValue: ['-r', '--requirements', '--group', '--optional', '--index', '--index-url', '-e', '--editable'] },
  { pattern: /^poetry$/, verbs: ['add'], ecosystem: 'pypi', name: pythonName, flagsWithValue: ['-G', '--group', '--source'] },
  { pattern: /^composer$/, verbs: ['require'], ecosystem: 'packagist', name: spec => (/^[a-z0-9_.-]+\/[a-z0-9_.-]+/i.test(spec) ? spec.split(':')[0].toLowerCase() : null), flagsWithValue: [] },
  { pattern: /^cargo$/, verbs: ['add'], ecosystem: 'crates', name: spec => (isLocalSpec(spec) ? null : spec.split('@')[0]), flagsWithValue: ['--path', '--git', '--branch', '--tag', '--rev', '-F', '--features', '--rename', '--registry', '-p', '--package'] },
  { pattern: /^go$/, verbs: ['get', 'install'], ecosystem: 'go', name: spec => (/^[a-z0-9.-]+\.[a-z]{2,}\/\S+/i.test(spec) ? spec.split('@')[0].replace(/\/\.\.\.$/, '') : null), flagsWithValue: [] },
];

export function findInstalledPackages(command) {
  const found = [];
  for (const segment of command.split(SEGMENT_SEPARATOR)) {
    const words = splitWords(segment.trim()).filter(word => !/^[A-Z_][A-Z0-9_]*=/.test(word));
    while (words[0] === 'sudo' || words[0] === 'npx' || words[0] === 'python' || words[0] === 'python3') {
      if ((words[0] === 'python' || words[0] === 'python3') && words[1] === '-m') words.splice(0, 2);
      else words.shift();
    }
    if (words.length === 0) continue;
    const installer = INSTALLERS.find(candidate => candidate.pattern.test(words[0]));
    if (!installer) continue;
    const rest = words.slice(1);
    const verb = installer.verbs.find(candidate => rest.slice(0, candidate.split(' ').length).join(' ') === candidate);
    if (!verb) continue;
    const args = rest.slice(verb.split(' ').length);
    for (let index = 0; index < args.length; index += 1) {
      const arg = args[index];
      if (installer.flagsWithValue.includes(arg)) {
        index += 1;
        continue;
      }
      if (arg.startsWith('-')) continue;
      const name = installer.name(arg);
      if (name) found.push({ ecosystem: installer.ecosystem, name });
    }
  }
  return found;
}
