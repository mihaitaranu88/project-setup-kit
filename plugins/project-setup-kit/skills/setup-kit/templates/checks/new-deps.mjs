import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { basename, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { REPO_ROOT, annotate, git, hasFlag, loadKitConfig, resolveBaseRef } from './lib.mjs';

const REGISTRY_MODULE = existsSync(new URL('../hooks/package-registry.mjs', import.meta.url))
  ? '../hooks/package-registry.mjs'
  : '../guards/package-registry.mjs';
const { checkPackages, describeResult, resolveDependencyPolicy } = await import(REGISTRY_MODULE);

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function tomlSections(text) {
  const sections = new Map();
  let current = '';
  for (const line of text.split(/\r?\n/)) {
    const header = line.match(/^\s*\[{1,2}([^\]]+)\]{1,2}\s*$/);
    if (header) {
      current = header[1].trim();
      if (!sections.has(current)) sections.set(current, []);
    } else {
      if (!sections.has(current)) sections.set(current, []);
      sections.get(current).push(line);
    }
  }
  return sections;
}

function quotedStrings(text) {
  return [...text.matchAll(/"([^"]+)"|'([^']+)'/g)].map(match => match[1] ?? match[2]);
}

function pythonRequirementName(requirement) {
  const match = requirement.trim().match(/^([A-Za-z0-9][A-Za-z0-9._-]*)/);
  return match && !/^(?:https?|git|file):/i.test(requirement) ? match[1].toLowerCase().replace(/_/g, '-') : null;
}

function tableKeys(lines) {
  return lines.map(line => line.match(/^\s*([A-Za-z0-9_.-]+)\s*=/)).filter(Boolean).map(match => match[1]);
}

function arrayBody(lines, key) {
  const text = lines.join('\n');
  const start = text.search(new RegExp(`(?:^|\\n)\\s*${key}\\s*=\\s*\\[`));
  if (start < 0) return '';
  let index = text.indexOf('[', start) + 1;
  let quote = null;
  const begin = index;
  for (; index < text.length; index += 1) {
    const char = text[index];
    if (quote) {
      if (char === quote) quote = null;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === ']') {
      break;
    }
  }
  return text.slice(begin, index);
}

export const MANIFESTS = [
  {
    file: 'package.json',
    ecosystem: 'npm',
    parse(text) {
      const manifest = safeJson(text);
      const names = [];
      for (const field of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
        for (const [name, spec] of Object.entries(manifest[field] ?? {})) {
          const value = String(spec);
          if (/^(?:workspace|file|link|portal|git|git\+\w+|github|https?):/.test(value) || value.startsWith('.') || value.startsWith('/')) continue;
          const alias = value.match(/^npm:((?:@[^/@]+\/)?[^@]+)/);
          names.push(alias ? alias[1] : name);
        }
      }
      return names;
    },
  },
  {
    file: 'pyproject.toml',
    ecosystem: 'pypi',
    parse(text) {
      const sections = tomlSections(text);
      const names = [];
      for (const [section, lines] of sections) {
        if (section === 'project') names.push(...quotedStrings(arrayBody(lines, 'dependencies')).map(pythonRequirementName));
        if (section === 'project.optional-dependencies' || section === 'dependency-groups') names.push(...quotedStrings(lines.join('\n')).map(pythonRequirementName));
        if (/^tool\.poetry\.(?:group\.[^.]+\.)?(?:dev-)?dependencies$/.test(section)) names.push(...tableKeys(lines).map(key => key.toLowerCase()));
      }
      return names.filter(name => name && name !== 'python');
    },
  },
  {
    file: /^requirements[\w.-]*\.(?:txt|in)$/,
    ecosystem: 'pypi',
    parse(text) {
      return text
        .split(/\r?\n/)
        .map(line => line.replace(/#.*/, '').trim())
        .filter(line => line && !line.startsWith('-'))
        .map(pythonRequirementName)
        .filter(Boolean);
    },
  },
  {
    file: 'composer.json',
    ecosystem: 'packagist',
    parse(text) {
      const manifest = safeJson(text);
      return [...Object.keys(manifest.require ?? {}), ...Object.keys(manifest['require-dev'] ?? {})].filter(name => name.includes('/')).map(name => name.toLowerCase());
    },
  },
  {
    file: 'Cargo.toml',
    ecosystem: 'crates',
    parse(text) {
      const names = [];
      for (const [section, lines] of tomlSections(text)) {
        if (!/(?:^|\.)(?:dev-|build-)?dependencies$/.test(section)) continue;
        for (const line of lines) {
          const match = line.match(/^\s*([A-Za-z0-9_-]+)\s*=\s*(.*)$/);
          if (!match || /\b(?:path|git)\s*=/.test(match[2]) || /\bworkspace\s*=\s*true/.test(match[2])) continue;
          const renamed = match[2].match(/\bpackage\s*=\s*"([^"]+)"/);
          names.push(renamed ? renamed[1] : match[1]);
        }
      }
      return names;
    },
  },
  {
    file: 'go.mod',
    ecosystem: 'go',
    parse(text) {
      const names = [];
      const block = text.match(/require\s*\(([\s\S]*?)\)/g) ?? [];
      for (const part of block) for (const line of part.split('\n').slice(1)) {
        const match = line.trim().match(/^([^\s()]+)\s+v\S+/);
        if (match) names.push(match[1]);
      }
      for (const match of text.matchAll(/^require\s+([^\s(]+)\s+v\S+/gm)) names.push(match[1]);
      const replaced = new Set([...text.matchAll(/^\s*(?:replace\s+)?(\S+)(?:\s+v\S+)?\s+=>\s+\.{1,2}\//gm)].map(match => match[1]));
      return names.filter(name => !replaced.has(name));
    },
  },
  {
    file: 'pom.xml',
    ecosystem: 'maven',
    parse(text) {
      const names = [];
      for (const match of text.matchAll(/<dependency>([\s\S]*?)<\/dependency>/g)) {
        const group = match[1].match(/<groupId>\s*([^<\s]+)\s*<\/groupId>/)?.[1];
        const artifact = match[1].match(/<artifactId>\s*([^<\s]+)\s*<\/artifactId>/)?.[1];
        if (group && artifact && !group.includes('${') && !artifact.includes('${')) names.push(`${group}:${artifact}`);
      }
      return names;
    },
  },
];

export function manifestFor(path) {
  const name = basename(path);
  return MANIFESTS.find(manifest => (typeof manifest.file === 'string' ? manifest.file === name : manifest.file.test(name))) ?? null;
}

export function findNewDependencies(changes) {
  const found = new Map();
  for (const { path, before, after } of changes) {
    const manifest = manifestFor(path);
    if (!manifest) continue;
    const old = new Set(manifest.parse(before ?? ''));
    for (const name of manifest.parse(after ?? '')) {
      if (!old.has(name)) found.set(`${manifest.ecosystem}:${name}`, { ecosystem: manifest.ecosystem, name, path });
    }
  }
  return [...found.values()];
}

function readAt(ref, path) {
  try {
    return git(['show', `${ref}:${path}`]);
  } catch {
    return '';
  }
}

function collectChanges(baseRef) {
  const files = git(['diff', '--name-only', '--diff-filter=AM', `${baseRef}...HEAD`]).split('\n').filter(Boolean);
  const staged = hasFlag('staged') ? git(['diff', '--name-only', '--cached', '--diff-filter=AM']).split('\n').filter(Boolean) : [];
  return [...new Set([...files, ...staged])]
    .filter(path => manifestFor(path))
    .map(path => ({
      path,
      before: readAt(hasFlag('staged') ? 'HEAD' : baseRef, path),
      after: existsSync(join(REPO_ROOT, path)) ? readFileSync(join(REPO_ROOT, path), 'utf8') : '',
    }));
}

async function main() {
  const config = loadKitConfig();
  const policy = resolveDependencyPolicy(config);
  const baseRef = hasFlag('staged') ? 'HEAD' : resolveBaseRef(config);
  const added = findNewDependencies(collectChanges(baseRef));
  if (added.length === 0) {
    process.stdout.write('No new dependencies.\n');
    return;
  }
  const results = await checkPackages(added, policy);
  let failed = false;
  for (const result of results) {
    if (result.level === 'block') {
      failed = true;
      annotate('error', `New dependency ${describeResult(result)} — added in ${result.path}. Check the exact name; if it is a private package, add it to dependencyCheck.allow in .ai-kit/config.json.`);
    } else if (result.level === 'warn') {
      if (policy.failOnWarn) failed = true;
      annotate(policy.failOnWarn ? 'error' : 'warning', `New dependency ${describeResult(result)} — added in ${result.path}. Make sure it is the package you meant.`);
    } else if (result.level === 'unknown') {
      annotate('warning', `New dependency ${describeResult(result)} — added in ${result.path}.`);
    } else {
      annotate('notice', `New dependency ${result.name} (${result.ecosystem}) looks established.`);
    }
  }
  const skipped = added.length - results.length;
  if (skipped > 0) process.stdout.write(`${skipped} new dependenc${skipped === 1 ? 'y on the allow list was' : 'ies on the allow list were'} not checked.\n`);
  if (failed) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) await main();
