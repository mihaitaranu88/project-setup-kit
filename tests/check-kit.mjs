import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SKILL = join(ROOT, 'plugins/project-setup-kit/skills/setup-kit');
const TEMPLATES = join(SKILL, 'templates');
const problems = [];

function read(path) {
  return readFileSync(join(ROOT, path), 'utf8');
}

const catalog = read('plugins/project-setup-kit/skills/setup-kit/references/catalog.md');
const writesLines = catalog.split('\n').filter(line => line.startsWith('- writes:'));
const templateRefs = writesLines.flatMap(line =>
  [...line.matchAll(/`([a-z-]+\/[^`\s]+?)`\s*(?:→|,|;|\(|$|or|and)/g)].map(match => match[1]),
).filter(ref => !/[*<]/.test(ref) && !ref.startsWith('docs/'));
for (const ref of new Set(templateRefs)) {
  if (!existsSync(join(TEMPLATES, ref))) problems.push(`catalog.md references missing template: ${ref}`);
}

const guideRefs = [...catalog.matchAll(/- guide: `([^`]+)`/g)].map(match => match[1]);
for (const guide of new Set(guideRefs)) {
  if (!existsSync(join(SKILL, 'references/guides', guide))) problems.push(`catalog.md references missing guide: ${guide}`);
}

const itemIds = [...catalog.matchAll(/^### (\d+) · /gm)].map(match => Number(match[1]));
const expected = Array.from({ length: itemIds.length }, (_, index) => index + 1);
if (itemIds.join(',') !== expected.join(',')) problems.push(`catalog item ids are not 1..${itemIds.length} in order`);

const skill = read('plugins/project-setup-kit/skills/setup-kit/SKILL.md');
for (const [, ref] of skill.matchAll(/\| `((?:references|templates)\/[^`*]+)` \|/g)) {
  if (!existsSync(join(SKILL, ref))) problems.push(`SKILL.md references missing file: ${ref}`);
}

const plugin = JSON.parse(read('plugins/project-setup-kit/.claude-plugin/plugin.json'));
const marketplace = JSON.parse(read('.claude-plugin/marketplace.json'));
const listed = marketplace.plugins.find(entry => entry.name === plugin.name);
if (!listed) problems.push('marketplace.json does not list the plugin');
else if (listed.version !== plugin.version) problems.push(`version mismatch: marketplace ${listed.version}, plugin ${plugin.version}`);
const packageVersion = JSON.parse(read('package.json')).version;
if (packageVersion !== plugin.version) problems.push(`version mismatch: package.json ${packageVersion}, plugin ${plugin.version}`);
if (!read('CHANGELOG.md').includes(`## ${plugin.version}`)) problems.push(`CHANGELOG.md has no section for ${plugin.version}`);

for (const fixture of ['ts-app', 'python-app', 'php-app', 'go-app', 'java-app', 'monorepo', 'empty', 'rust-app', 'dotnet-app', 'ruby-app', 'kotlin-app']) {
  if (!existsSync(join(ROOT, 'tests/fixtures', fixture, 'expected.json'))) problems.push(`fixture ${fixture} has no expected.json`);
}

const profiles = read('plugins/project-setup-kit/skills/setup-kit/references/profiles.md');
const profileIds = [...profiles.matchAll(/^\| (\d+) \| /gm)].map(match => Number(match[1]));
if (profileIds.join(',') !== expected.join(',')) problems.push(`profiles.md must list items 1..${itemIds.length} in order`);
for (const line of profiles.split('\n').filter(row => /^\| \d+ \| /.test(row))) {
  const cells = line.split('|').slice(3, 6).map(cell => cell.trim().split(/[ ,]/)[0]);
  if (cells.some(cell => !['yes', 'no', 'ask'].includes(cell))) problems.push(`profiles.md has an invalid answer: ${line}`);
}
if (!existsSync(join(ROOT, 'plugins/project-setup-kit/.claude-plugin/icon.png'))) problems.push('plugin icon is missing');

if (problems.length > 0) {
  for (const problem of problems) process.stdout.write(`✖ ${problem}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`✔ Kit is consistent: ${itemIds.length} items, ${new Set(templateRefs).size} template references, ${new Set(guideRefs).size} guides.\n`);
}
