#!/usr/bin/env node
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { checkOutdated, formatOutdated } from '../plugins/project-setup-kit/skills/setup-kit/scripts/outdated.mjs';
import { renderAll } from './lint-workflows.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

async function main() {
  const work = mkdtempSync(join(tmpdir(), 'kit-freshness-'));
  try {
    mkdirSync(join(work, '.github', 'workflows'), { recursive: true });
    for (const [name, content] of Object.entries(renderAll())) writeFileSync(join(work, '.github', 'workflows', name), content);
    writeFileSync(join(work, '.mcp.json'), readFileSync(join(ROOT, 'plugins/project-setup-kit/skills/setup-kit/templates/repo/.mcp.json')));
    const results = await checkOutdated(work);
    const report = formatOutdated(results).replace(/\.github\/workflows\/ci-[a-z]+\.yml/g, match => match.replace(/ci-([a-z]+)\.yml/, 'ci.$1.yml'));
    process.stdout.write(`${report}\n`);
    if (process.env.GITHUB_STEP_SUMMARY) writeFileSync(process.env.GITHUB_STEP_SUMMARY, `\`\`\`\n${report}\n\`\`\`\n`, { flag: 'a' });
    if (process.argv.includes('--strict') && results.some(result => result.status === 'major' || result.status === 'minor')) process.exitCode = 1;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) await main();
