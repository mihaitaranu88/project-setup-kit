import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export const DOCKER_IMAGES = {
  'rhysd/actionlint': { repo: 'rhysd/actionlint', tagPrefix: '' },
  'ghcr.io/zizmorcore/zizmor': { repo: 'zizmorcore/zizmor', tagPrefix: '' },
  'hadolint/hadolint': { repo: 'hadolint/hadolint', tagPrefix: 'v' },
  'aquasec/trivy': { repo: 'aquasecurity/trivy', tagPrefix: '' },
  'ghcr.io/gitleaks/gitleaks': { repo: 'gitleaks/gitleaks', tagPrefix: 'v' },
  'zricethezav/gitleaks': { repo: 'gitleaks/gitleaks', tagPrefix: 'v' },
};

const VERSION = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?$/;

export function parseVersion(value) {
  const match = String(value).match(VERSION);
  return match ? match.slice(1).map(part => (part === undefined ? null : Number(part))) : null;
}

export function compareVersions(left, right) {
  const [a, b] = [parseVersion(left), parseVersion(right)];
  for (let index = 0; index < 3; index += 1) {
    const difference = (a?.[index] ?? 0) - (b?.[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

export function latestStable(tags) {
  return tags.filter(tag => /^v?\d+\.\d+\.\d+$/.test(tag)).sort(compareVersions).pop() ?? null;
}

function lines(text) {
  return text.split('\n');
}

export function findPins(path, text) {
  const pins = [];
  lines(text).forEach((line, index) => {
    const at = { path, line: index + 1 };
    const action = line.match(/uses:\s*["']?([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)(?:\/[^@\s"']+)?@([^\s"'#]+)["']?(?:\s*#\s*(\S+))?/);
    if (action && !action[1].startsWith('.')) {
      const [, repo, ref, note] = action;
      const shown = /^[0-9a-f]{40}$/.test(ref) ? note : ref;
      if (shown && parseVersion(shown)) pins.push({ ...at, kind: 'action', name: repo, current: shown, pinnedSha: ref !== shown });
    }
    for (const match of line.matchAll(/((?:ghcr\.io\/)?[a-z0-9-]+\/[a-z0-9-]+):(v?\d+\.\d+\.\d+)\b/g)) {
      if (DOCKER_IMAGES[match[1]]) pins.push({ ...at, kind: 'image', name: match[1], current: match[2] });
    }
    for (const match of line.matchAll(/(?:npx\s+(?:(?:-y|--yes)\s+)?|["'])((?:@[a-z0-9-]+\/)?[a-z0-9][a-z0-9._-]*)@(\d+\.\d+\.\d+)\b/g)) {
      pins.push({ ...at, kind: 'npm', name: match[1], current: match[2] });
    }
    for (const match of line.matchAll(/(?:pip3?\s+install|uvx|pipx\s+run|uv\s+tool\s+run)\s+([A-Za-z0-9][A-Za-z0-9._-]*)==(\d+(?:\.\d+){1,2})\b/g)) {
      pins.push({ ...at, kind: 'pypi', name: match[1], current: match[2] });
    }
    for (const match of line.matchAll(/go\s+(?:run|install)\s+([a-z0-9.-]+\.[a-z]{2,}\/[^@\s]+)@(v\d+\.\d+\.\d+)\b/g)) {
      pins.push({ ...at, kind: 'go', name: match[1], current: match[2] });
    }
  });
  return pins;
}

export function listPinnedFiles(root) {
  const files = [];
  const workflows = join(root, '.github', 'workflows');
  if (existsSync(workflows)) for (const name of readdirSync(workflows)) if (/\.ya?ml$/.test(name)) files.push(`.github/workflows/${name}`);
  for (const path of ['.mcp.json', '.vscode/mcp.json', '.cursor/mcp.json', '.pre-commit-config.yaml', 'lefthook.yml', '.github/workflows/copilot-setup-steps.yml']) {
    if (existsSync(join(root, path)) && !files.includes(path)) files.push(path);
  }
  return files;
}

export function gitTags(repo) {
  const output = execFileSync('git', ['ls-remote', '--tags', '--refs', `https://github.com/${repo}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 });
  return output.split('\n').filter(Boolean).map(line => line.split('refs/tags/')[1]);
}

export function npmLatest(name) {
  return execFileSync('npm', ['view', name, 'version'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000, shell: process.platform === 'win32' }).trim();
}

export async function pypiLatest(name) {
  const response = await fetch(`https://pypi.org/pypi/${encodeURIComponent(name)}/json`, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`PyPI answered ${response.status}`);
  return (await response.json()).info.version;
}

export async function goLatest(path, fetchImpl = globalThis.fetch) {
  const segments = path.split('/');
  for (let length = segments.length; length >= Math.min(3, segments.length); length -= 1) {
    const module = segments.slice(0, length).join('/').replace(/[A-Z]/g, letter => `!${letter.toLowerCase()}`);
    const response = await fetchImpl(`https://proxy.golang.org/${module}/@latest`, { signal: AbortSignal.timeout(15000) });
    if (response.status === 404 || response.status === 410) continue;
    if (!response.ok) throw new Error(`Go proxy answered ${response.status}`);
    return (await response.json()).Version;
  }
  throw new Error(`no Go module found for ${path}`);
}

export function resolveLatest(pin, { tags = gitTags, npm = npmLatest, pypi = pypiLatest, go = goLatest } = {}) {
  if (pin.kind === 'npm') return npm(pin.name);
  if (pin.kind === 'pypi') return pypi(pin.name);
  if (pin.kind === 'go') return go(pin.name);
  const repo = pin.kind === 'image' ? DOCKER_IMAGES[pin.name].repo : pin.name;
  const all = tags(repo);
  const latest = latestStable(all);
  if (!latest) return null;
  if (pin.kind === 'image') return `${DOCKER_IMAGES[pin.name].tagPrefix}${latest.replace(/^v/, '')}`;
  const isMajorOnly = /^v?\d+$/.test(pin.current);
  if (isMajorOnly) {
    const major = `v${parseVersion(latest)[0]}`;
    return all.includes(major) ? major : latest;
  }
  return latest;
}

export async function checkOutdated(root, resolvers = {}) {
  const pins = listPinnedFiles(root).flatMap(path => findPins(path, readFileSync(join(root, path), 'utf8')));
  const cache = new Map();
  const results = [];
  for (const pin of pins) {
    const key = `${pin.kind}:${pin.name}:${/^v?\d+$/.test(pin.current) ? 'major' : 'full'}`;
    if (!cache.has(key)) {
      try {
        cache.set(key, { latest: await resolveLatest(pin, resolvers) });
      } catch (error) {
        cache.set(key, { error: error.message.split('\n')[0] });
      }
    }
    results.push(classify(pin, cache.get(key)));
  }
  return results;
}

function classify(pin, { latest, error }) {
  if (error || !latest) return { ...pin, status: 'unknown', error: error ?? 'no released version found' };
  const newer = compareVersions(latest, pin.current) > 0;
  const leading = parseVersion(pin.current)[0] === 0 ? 1 : 0;
  const major = newer && parseVersion(latest)[leading] !== parseVersion(pin.current)[leading];
  return { ...pin, latest, status: newer ? (major ? 'major' : 'minor') : 'current' };
}

export function formatOutdated(results) {
  const outdated = results.filter(result => result.status === 'major' || result.status === 'minor');
  const unknown = results.filter(result => result.status === 'unknown');
  const rows = outdated.map(result => `${result.status === 'major' ? 'MAJOR' : 'minor'} ${result.path}:${result.line} ${result.name} ${result.current} → ${result.latest}${result.pinnedSha ? ' (pinned SHA: re-run pin-actions after the change)' : ''}`);
  const notes = unknown.map(result => `?     ${result.path}:${result.line} ${result.name} ${result.current} (${result.error})`);
  const summary = outdated.length === 0 ? `All ${results.length - unknown.length} pinned versions are current.` : `${outdated.length} of ${results.length} pinned versions are behind. Read the release notes of every MAJOR change before updating.`;
  return [...rows, ...notes, summary].join('\n');
}
