import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { REPO_ROOT, annotate, listChangedFiles, loadKitConfig, readChangedLines, resolveDiffScope } from './lib.mjs';

export const DEFAULT_PRECHECK = {
  exclude: '(^|/)(node_modules|vendor|dist|build|\\.next|coverage|\\.ai-kit)/|\\.(lock|min\\.js|snap)$|(^|/)(package-lock\\.json|pnpm-lock\\.yaml|yarn\\.lock|composer\\.lock|go\\.sum)$|(^|/)_generated/',
  lineChecks: {
    focusedTests: {
      level: 'error',
      files: '\\.(test|spec)\\.[cm]?[jt]sx?$|(^|/)test_[^/]+\\.py$|_test\\.(py|go)$|Test\\.(php|java|kt)$',
      pattern: '\\b(?:describe|it|test|context)\\.only\\s*\\(|\\bf(?:it|describe)\\s*\\(|@pytest\\.mark\\.only\\b|->only\\(\\)',
      message: 'Focused test left in the code; it silently skips every other test.',
    },
    skippedTests: {
      level: 'warning',
      files: '\\.(test|spec)\\.[cm]?[jt]sx?$|(^|/)test_[^/]+\\.py$|_test\\.(py|go)$|Test\\.(php|java|kt)$',
      pattern: '\\b(?:describe|it|test)\\.skip\\s*\\(|\\bx(?:it|describe)\\s*\\(|@pytest\\.mark\\.skip\\b|\\bt\\.Skip\\(|@Disabled\\b|markTestSkipped\\(',
      message: 'Skipped test added; say why in the PR or remove the skip.',
    },
    debugStatements: {
      level: 'error',
      files: '\\.([cm]?[jt]sx?|py|php|rb|go)$',
      pattern: '^\\s*debugger\\s*;?\\s*$|\\bbreakpoint\\(\\)|\\bpdb\\.set_trace\\(|\\b(?:dd|dump|var_dump|ray)\\s*\\(|\\bbinding\\.pry\\b',
      message: 'Debug statement left in the code.',
    },
    todoWithoutTicket: {
      level: 'warning',
      files: '\\.([cm]?[jt]sx?|py|php|rb|go|java|kt|cs|rs|swift|vue|svelte)$',
      pattern: '\\b(?:TODO|FIXME|HACK)\\b(?!.*(?:[A-Z][A-Z0-9]+-\\d+|#\\d+))',
      message: 'TODO without a ticket reference (e.g. PROJ-123 or #123).',
    },
    comments: {
      enabled: false,
      level: 'error',
      files: '\\.([cm]?[jt]sx?)$',
      pattern: '^\\s*(?://|/\\*|\\*(?!/)|\\{/\\*)|[^:"\'`]//\\s|\\{/\\*.*\\*/\\}',
      allow: 'eslint-disable[^\\n]*--\\s*\\S|@ts-expect-error\\s+\\S|prettier-ignore|@license|^\\s*//\\s*#(?:region|endregion)|^#!|"use (?:client|server|strict)"',
      message: 'Code comment added; this project uses self-explanatory code instead.',
    },
    lintDisableWithoutReason: {
      level: 'error',
      files: '\\.([cm]?[jt]sx?|py|go|php)$',
      pattern: 'eslint-disable(?:-next-line|-line)?(?![^\\n]*--\\s*\\S)|@ts-ignore|#\\s*noqa(?!:)|#\\s*type:\\s*ignore(?!\\[)|//\\s*nolint(?!:\\w+\\s*//\\s*\\S)|@phpstan-ignore-line',
      message: 'Lint or type check disabled without a specific rule and a reason.',
    },
    isoDateSplit: {
      level: 'warning',
      files: '\\.([cm]?[jt]sx?)$',
      pattern: "\\.split\\(\\s*['\"]T['\"]\\s*\\)",
      message: 'Splitting an ISO string to get a date gives off-by-one-day bugs across time zones; use the date utilities.',
    },
    fillerNames: {
      enabled: false,
      level: 'warning',
      files: '\\.([cm]?[jt]sx?|py|php|go|java|kt|cs)$',
      pattern: '\\b(?:const|let|var|function|class|interface|type|def|func)\\s+\\w*(?:Data|Info|Details|Helper|Helpers|Manager|Util|Utils|Impl|Stuff|Thing)\\b',
      message: 'Filler word in a new name (Data, Info, Helper, Manager, Util…); name what it holds or does.',
    },
  },
  diffChecks: {
    newSourceWithoutTest: {
      level: 'warning',
      source: '^(?:.+/)?(src|app|lib|convex|internal|pkg)/.*\\.(?:[cm]?[jt]sx?|py|php|go|rb|java|kt|cs)$',
      exclude: '\\.(test|spec)\\.|_test\\.go$|\\.d\\.ts$|(^|/)(_generated|types?|migrations?|__init__\\.py)(/|$)|(^|/)(page|layout|loading|error|not-found)\\.[jt]sx?$|(^|/)(tests?|spec|__tests__)/',
      tests: '\\.(test|spec)\\.[cm]?[jt]sx?$|(^|/)__tests__/|(^|/)tests?/.*\\.py$|(^|/)test_[^/]*\\.py$|_test\\.(py|go)$|Tests?\\.(php|java|kt|cs)$|_spec\\.rb$|(^|/)spec/|(^|/)tests/.*\\.rs$',
      message: 'New source files without any test file in this change.',
    },
    toolingWithoutDocs: {
      level: 'warning',
      tooling: '^(package\\.json|composer\\.json|pyproject\\.toml|go\\.mod|\\.env[^/]*\\.(?:example|sample|template|dist)|\\.github/workflows/|\\.ai-kit/config\\.json)',
      docs: '^(README\\.md|AGENTS\\.md|CLAUDE\\.md|docs/)',
      message: 'Tooling or configuration changed without a README/AGENTS.md/docs update.',
    },
  },
};

export function mergeSettings(defaults, overrides = {}) {
  const merged = { ...defaults, ...overrides, lineChecks: { ...defaults.lineChecks }, diffChecks: { ...defaults.diffChecks } };
  for (const group of ['lineChecks', 'diffChecks']) {
    for (const [name, value] of Object.entries(overrides[group] ?? {})) {
      merged[group][name] = { ...(defaults[group][name] ?? {}), ...value };
    }
  }
  return merged;
}

export function runLineChecks(file, lines, settings) {
  const findings = [];
  for (const [name, check] of Object.entries(settings.lineChecks)) {
    if (check.enabled === false || !new RegExp(check.files).test(file)) continue;
    const pattern = new RegExp(check.pattern);
    const allow = check.allow ? new RegExp(check.allow) : null;
    for (const { number, text } of lines) {
      if (pattern.test(text) && !(allow && allow.test(text))) {
        findings.push({ check: name, level: check.level, file, line: number, message: check.message });
      }
    }
  }
  return findings;
}

export function runDiffChecks(changedFiles, addedFiles, settings) {
  const findings = [];
  const source = settings.diffChecks.newSourceWithoutTest;
  if (source && source.enabled !== false) {
    const newSources = addedFiles.filter(file => new RegExp(source.source).test(file) && !new RegExp(source.exclude).test(file));
    const touchesTests = changedFiles.some(file => new RegExp(source.tests).test(file));
    if (newSources.length > 0 && !touchesTests) {
      findings.push({ check: 'newSourceWithoutTest', level: source.level, file: newSources.join(', '), line: null, message: source.message });
    }
  }
  const tooling = settings.diffChecks.toolingWithoutDocs;
  if (tooling && tooling.enabled !== false) {
    const toolingFiles = changedFiles.filter(file => new RegExp(tooling.tooling).test(file));
    const touchesDocs = changedFiles.some(file => new RegExp(tooling.docs).test(file));
    if (toolingFiles.length > 0 && !touchesDocs) {
      findings.push({ check: 'toolingWithoutDocs', level: tooling.level, file: toolingFiles.join(', '), line: null, message: tooling.message });
    }
  }
  return findings;
}

function readAddedLines(file, lineNumbers) {
  const absolute = join(REPO_ROOT, file);
  if (!existsSync(absolute)) return [];
  const content = readFileSync(absolute, 'utf8').split('\n');
  return [...lineNumbers].sort((a, b) => a - b).map(number => ({ number, text: content[number - 1] ?? '' }));
}

function main() {
  const config = loadKitConfig();
  const settings = mergeSettings(DEFAULT_PRECHECK, config.precheck);
  const scope = resolveDiffScope(config);
  const exclude = new RegExp(settings.exclude);
  const changedFiles = listChangedFiles(scope).filter(file => !exclude.test(file));
  const addedFiles = listChangedFiles(scope, 'A').filter(file => !exclude.test(file));
  const changedLines = readChangedLines(scope);
  const findings = [
    ...[...changedLines.entries()]
      .filter(([file]) => !exclude.test(file))
      .flatMap(([file, numbers]) => runLineChecks(file, readAddedLines(file, numbers), settings)),
    ...runDiffChecks(changedFiles, addedFiles, settings),
  ];
  for (const finding of findings) {
    annotate(finding.level, `${finding.file}${finding.line ? `:${finding.line}` : ''} ${finding.message} [${finding.check}]`);
  }
  const errors = findings.filter(finding => finding.level === 'error').length;
  process.stdout.write(`Precheck: ${errors} error(s), ${findings.length - errors} warning(s) on ${scope.label}.\n`);
  if (errors > 0) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) main();
