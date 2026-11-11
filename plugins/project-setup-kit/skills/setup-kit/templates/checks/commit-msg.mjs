import { readFileSync, realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { loadKitConfig } from './lib.mjs';

const GENERATED_SUBJECT = /^(Merge |Revert "|fixup! |squash! |amend! )/;

export function extractSubject(message) {
  return message
    .split(/\r?\n/)
    .filter(line => !line.startsWith('#'))
    .map(line => line.trim())
    .find(Boolean) ?? '';
}

export function evaluateCommitMessage(message, settings) {
  const subject = extractSubject(message);
  const problems = [];
  if (!subject) problems.push('The commit message is empty.');
  else if (!GENERATED_SUBJECT.test(subject) && settings.pattern && !new RegExp(settings.pattern).test(subject)) {
    problems.push(`Subject "${subject}" does not match ${settings.pattern}.`);
  }
  for (const trailer of settings.rejectTrailers ?? []) {
    if (new RegExp(`^${trailer}:`, 'im').test(message)) problems.push(`Trailer "${trailer}:" is not allowed in this project.`);
  }
  if (problems.length === 0) return { ok: true, message: 'Commit message OK.' };
  const examples = (settings.examples ?? []).map(example => `  ✓ ${example}`).join('\n');
  return { ok: false, message: [...problems, examples ? `Examples:\n${examples}` : ''].filter(Boolean).join('\n') };
}

function main() {
  const settings = loadKitConfig().commit;
  const messageFile = process.argv[2];
  if (!settings || !messageFile) return;
  const outcome = evaluateCommitMessage(readFileSync(messageFile, 'utf8'), settings);
  if (!outcome.ok) {
    process.stderr.write(`✖ ${outcome.message}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) main();
