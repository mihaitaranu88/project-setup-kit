import { realpathSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { REPO_ROOT, annotate, listChangedFiles, loadKitConfig, quoteForShell, readChangedLines, resolveDiffScope } from './lib.mjs';

const SEVERITY_PREFIX = /^\s*(?:\[(?:WARN|WARNING|ERROR|INFO|FATAL)\]\s+|(?:warning|error|WARN|ERROR):\s+)/;
const FINDING_FORMATS = [
  /^(?:\.\/)?([^:\s[][^:]*?):(\d+)(?::\d+)?[:\s]\s*(.*)$/,
  /^(?:\.\/)?([^:\s[][^:]*?):\[(\d+)(?:,\d+)?\]\s*(.*)$/,
];

function matchFinding(line) {
  const text = line.replace(SEVERITY_PREFIX, '');
  for (const format of FINDING_FORMATS) {
    const match = text.match(format);
    if (match) return match;
  }
  return null;
}

export function parseFindings(output) {
  return output
    .split(/\r?\n/)
    .map(matchFinding)
    .filter(Boolean)
    .map(([, file, line, message]) => ({ file, line: Number(line), message }));
}

export function keepChangedLineFindings(findings, changedLines, root) {
  return findings
    .map(finding => ({ ...finding, file: finding.file.startsWith(root) ? finding.file.slice(root.length + 1) : finding.file }))
    .filter(finding => changedLines.get(finding.file)?.has(finding.line));
}

export function buildCommand(template, files) {
  return template.replaceAll('{files}', files.map(quoteForShell).join(' '));
}

function runCheck(check, changedFiles, changedLines) {
  const files = changedFiles.filter(file => new RegExp(check.files).test(file));
  if (files.length === 0) return [];
  const result = spawnSync(buildCommand(check.command, files), {
    cwd: REPO_ROOT,
    shell: true,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  const findings = parseFindings(output);
  if (result.status !== 0 && findings.length === 0) {
    throw new Error(`"${check.name}" failed without parseable findings, so the ratchet cannot verify the diff:\n${output.trim()}`);
  }
  return keepChangedLineFindings(findings, changedLines, REPO_ROOT);
}

function main() {
  const config = loadKitConfig();
  const checks = config.ratchet?.checks ?? [];
  const scope = resolveDiffScope(config);
  const changedFiles = listChangedFiles(scope);
  const changedLines = readChangedLines(scope);
  let total = 0;
  for (const check of checks) {
    const violations = runCheck(check, changedFiles, changedLines);
    total += violations.length;
    for (const violation of violations) annotate('error', `${violation.file}:${violation.line} ${violation.message} [${check.name}]`);
  }
  process.stdout.write(`Lint ratchet: ${total} finding(s) on changed lines (${scope.label}).\n`);
  if (total > 0) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) main();
