#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const result = JSON.parse(readFileSync(process.argv[2] ?? 'eval-result.json', 'utf8'));
const format = value => (typeof value === 'number' ? value.toFixed(2) : '-');
const rows = result.cases.map(entry => `| ${entry.name} | ${format(entry.aggregates.score)} | ${format(entry.aggregates.scoreWithout)} | ${format(entry.aggregates.delta)} |`);
process.stdout.write(`${['| case | with | without | delta |', '|---|---|---|---|', ...rows, '', `Cost: $${format(result.costUsd)}`].join('\n')}\n`);
