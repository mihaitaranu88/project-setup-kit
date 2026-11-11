import { existsSync, realpathSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { REPO_ROOT, annotate, hasFlag, loadKitConfig } from './lib.mjs';

export function measurePrefix(root, budget) {
  const bytesPerToken = budget.bytesPerToken ?? 4;
  const files = (budget.files ?? []).map(path => {
    const absolute = join(root, path);
    const bytes = existsSync(absolute) ? statSync(absolute).size : 0;
    return { path, bytes, tokens: Math.floor(bytes / bytesPerToken), missing: !existsSync(absolute) };
  });
  const totalTokens = files.reduce((sum, file) => sum + file.tokens, 0);
  return { files, totalTokens, maxEstimatedTokens: budget.maxEstimatedTokens, overBudget: totalTokens > budget.maxEstimatedTokens };
}

function main() {
  const budget = loadKitConfig().prefixBudget;
  if (!budget) {
    annotate('warning', 'prefix-budget: no prefixBudget in .ai-kit/config.json');
    return;
  }
  const report = measurePrefix(REPO_ROOT, budget);
  for (const file of report.files.filter(entry => !entry.missing)) {
    process.stdout.write(`${String(file.tokens).padStart(7)} est. tokens  ${file.path}\n`);
  }
  process.stdout.write(`Total: ${report.totalTokens} est. tokens (budget ${report.maxEstimatedTokens})\n`);
  if (!report.overBudget) return;
  annotate(
    hasFlag('strict') ? 'error' : 'warning',
    `Always-loaded agent instructions are over budget: ${report.totalTokens} > ${report.maxEstimatedTokens} est. tokens. Move detail into skills or files read on demand.`,
  );
  if (hasFlag('strict')) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) main();
