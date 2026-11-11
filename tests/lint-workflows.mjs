#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const WORKFLOWS = join(ROOT, 'plugins/project-setup-kit/skills/setup-kit/templates/ci/github');
const EXTRA = [join(ROOT, 'plugins/project-setup-kit/skills/setup-kit/templates/agent-env/copilot-setup-steps.yml')];
export const ACTIONLINT_IMAGE = 'rhysd/actionlint:1.7.12';
export const ZIZMOR_IMAGE = 'ghcr.io/zizmorcore/zizmor:1.32.0';
const LANGUAGES = ['node', 'python', 'php', 'go', 'java', 'dotnet', 'ruby', 'rust'];

export function renderTemplate(text) {
  return text
    .split('\n')
    .filter(line => !/^\s*if:\s*"\{\{[^}]*\}\}"\s*$/.test(line))
    .map(line => {
      const lone = line.match(/^(\s*)\{\{[A-Z_0-9]+\}\}\s*$/);
      if (lone) return `${lone[1]}PLACEHOLDER: "1"`;
      return line.replace(/(?<!\$)\{\{(?!\s)[^}]*\}\}/g, 'placeholder');
    })
    .join('\n');
}

export function renderCi(shell, fragment) {
  const indented = fragment.split('\n').map(line => (line ? `  ${line}` : line)).join('\n');
  return shell.replace(/^\s*"?\{\{JOBS_FROM_ci\.<language>\.yml\}\}"?.*$/m, indented);
}

export function renderAll() {
  const files = {};
  const shell = readFileSync(join(WORKFLOWS, 'ci.yml'), 'utf8');
  for (const language of LANGUAGES) {
    files[`ci-${language}.yml`] = renderTemplate(renderCi(shell, readFileSync(join(WORKFLOWS, `ci.${language}.yml`), 'utf8')));
  }
  for (const name of readdirSync(WORKFLOWS).filter(file => file.endsWith('.yml') && !file.startsWith('ci.'))) {
    files[name] = renderTemplate(readFileSync(join(WORKFLOWS, name), 'utf8'));
  }
  for (const path of EXTRA) files[path.split(/[\\/]/).pop()] = renderTemplate(readFileSync(path, 'utf8'));
  return files;
}

function docker(args, cwd) {
  return spawnSync('docker', ['run', '--rm', '-v', `${cwd}:/repo`, '-w', '/repo', ...args], { encoding: 'utf8' });
}

function main() {
  const work = mkdtempSync(join(tmpdir(), 'kit-workflows-'));
  chmodSync(work, 0o755);
  try {
    mkdirSync(join(work, '.github', 'workflows'), { recursive: true });
    for (const [name, content] of Object.entries(renderAll())) writeFileSync(join(work, '.github', 'workflows', name), content);
    spawnSync('git', ['init', '-q'], { cwd: work });
    writeFileSync(join(work, 'zizmor.yml'), 'rules:\n  unpinned-uses:\n    disable: true\n');
    const files = readdirSync(join(work, '.github', 'workflows')).map(name => `.github/workflows/${name}`);
    const actionlint = docker([ACTIONLINT_IMAGE, '-no-color', '-ignore', 'SC2034', '-ignore', 'label .* is unknown', ...files], work);
    const zizmor = docker([ZIZMOR_IMAGE, '--format=plain', '--min-severity=low', '--offline', '--config', 'zizmor.yml', '.github/workflows'], work);
    process.stdout.write(`actionlint:\n${actionlint.stdout}${actionlint.stderr}\nzizmor:\n${zizmor.stdout}${zizmor.stderr}\n`);
    if (actionlint.status !== 0 || zizmor.status !== 0) process.exitCode = 1;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) main();
