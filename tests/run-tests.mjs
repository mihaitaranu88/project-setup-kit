import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = fileURLToPath(new URL('./scripts/', import.meta.url));
const files = readdirSync(directory)
  .filter(name => name.endsWith('.test.mjs'))
  .sort()
  .map(name => join(directory, name));
const result = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });
process.exitCode = result.status ?? 1;
