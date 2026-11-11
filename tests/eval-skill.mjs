#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const FIXTURES = join(ROOT, 'tests', 'fixtures');
const PLUGIN_DIR = join(ROOT, 'plugins', 'project-setup-kit');
const HAS_KEYS = ['frontend', 'api', 'db', 'severalServices', 'versionedReleases'];

export const ANALYSIS_PROMPT = `/setup-kit

Automated evaluation, no human. Do Phase 0 and Phase 1 only (Phase 0b for an empty folder: report it, do not choose an option). Write nothing.
Then print exactly one JSON object in a \`\`\`json fenced block, with this shape and nothing else after it:
{"mode": "existing" | "new-project",
 "parts": [{"path": "<folder>", "language": "<typescript|javascript|python|php|go|java|...>"}],
 "has": {"frontend": bool, "api": bool, "db": bool, "severalServices": bool, "versionedReleases": bool},
 "alreadyConfigured": [<item ids>],
 "notApplicable": [<item ids>]}`;

export function extractJson(text) {
  const fenced = [...text.matchAll(/```json\s*([\s\S]*?)```/g)].map(match => match[1]);
  const candidates = fenced.length > 0 ? fenced.reverse() : [text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)];
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      continue;
    }
  }
  throw new Error('no JSON object found in the agent output');
}

function languagesOf(parts) {
  return [...new Set((parts ?? []).map(part => String(part.language).toLowerCase()))].sort();
}

export function compareAnalysis(expected, actual) {
  const problems = [];
  const expectedMode = expected.mode ?? 'existing';
  if ((actual.mode ?? 'existing') !== expectedMode) problems.push(`mode: expected ${expectedMode}, got ${actual.mode}`);
  const expectedLanguages = languagesOf(expected.parts);
  const actualLanguages = languagesOf(actual.parts);
  if (expectedLanguages.join(',') !== actualLanguages.join(',')) {
    problems.push(`languages: expected [${expectedLanguages}], got [${actualLanguages}]`);
  }
  if ((expected.parts ?? []).length !== (actual.parts ?? []).length) {
    problems.push(`parts: expected ${(expected.parts ?? []).length}, got ${(actual.parts ?? []).length}`);
  }
  for (const key of HAS_KEYS) {
    if (expected.has && key in expected.has && Boolean(actual.has?.[key]) !== expected.has[key]) {
      problems.push(`has.${key}: expected ${expected.has[key]}, got ${Boolean(actual.has?.[key])}`);
    }
  }
  const skipped = new Set([...(actual.notApplicable ?? []), ...(actual.alreadyConfigured ?? [])].map(Number));
  const missing = (expected.notApplicable ?? []).filter(id => !skipped.has(Number(id)));
  if (missing.length > 0) problems.push(`notApplicable: expected to skip ${missing.join(', ')} (not applicable or already configured)`);
  return problems;
}

function prepareRepo(fixture) {
  const work = mkdtempSync(join(tmpdir(), `kit-eval-${fixture}-`));
  cpSync(join(FIXTURES, fixture), work, { recursive: true });
  rmSync(join(work, 'expected.json'), { force: true });
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: work });
  execFileSync('git', ['add', '-A'], { cwd: work });
  execFileSync('git', ['-c', 'user.email=eval@example.invalid', '-c', 'user.name=kit-eval', 'commit', '-q', '--allow-empty', '-m', 'fixture'], { cwd: work });
  return work;
}

function runAnalysis(work) {
  const result = spawnSync(
    'claude',
    ['-p', ANALYSIS_PROMPT, '--plugin-dir', PLUGIN_DIR, '--output-format', 'json', '--allowedTools', 'Read,Glob,Grep,Skill,Bash(git log:*),Bash(git status:*),Bash(git ls-files:*),Bash(git remote -v),Bash(ls:*),Bash(cat:*),Bash(node --version)'],
    { cwd: work, encoding: 'utf8', timeout: 15 * 60 * 1000, maxBuffer: 64 * 1024 * 1024 },
  );
  if (result.status !== 0) throw new Error(`claude exited ${result.status}: ${(result.stderr || result.stdout).slice(-2000)}`);
  const envelope = JSON.parse(result.stdout);
  return { text: envelope.result ?? '', cost: envelope.total_cost_usd ?? null };
}

function main() {
  const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1].split(',') : null;
  const fixtures = readdirSync(FIXTURES).filter(name => !only || only.includes(name));
  const report = [];
  let failed = 0;
  for (const fixture of fixtures) {
    const expected = JSON.parse(readFileSync(join(FIXTURES, fixture, 'expected.json'), 'utf8'));
    const work = prepareRepo(fixture);
    try {
      const { text, cost } = runAnalysis(work);
      const problems = compareAnalysis(expected, extractJson(text));
      failed += problems.length > 0 ? 1 : 0;
      report.push(`${problems.length === 0 ? '✔' : '✖'} ${fixture}${cost === null ? '' : ` ($${cost.toFixed(2)})`}${problems.map(problem => `\n    ${problem}`).join('')}`);
    } catch (error) {
      failed += 1;
      report.push(`✖ ${fixture}\n    ${error.message}`);
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  }
  const summary = `${report.join('\n')}\n\n${fixtures.length - failed}/${fixtures.length} fixtures match expected.json`;
  process.stdout.write(`${summary}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) writeFileSync(process.env.GITHUB_STEP_SUMMARY, `\`\`\`\n${summary}\n\`\`\`\n`, { flag: 'a' });
  if (failed > 0) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) main();
