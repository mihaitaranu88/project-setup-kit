import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { REPO_ROOT, annotate, git, listChangedFiles, loadKitConfig, resolveBaseRef } from './lib.mjs';

export function isMigrationFile(path, settings) {
  return (settings.dirs ?? []).some(dir => path.startsWith(`${dir.replace(/\/$/, '')}/`)) && new RegExp(settings.filePattern).test(path);
}

export function isIgnoredMigration(path, settings) {
  return Boolean(settings.ignorePattern) && new RegExp(settings.ignorePattern).test(basename(path));
}

export function readVersion(path, settings) {
  const match = basename(path).match(new RegExp(settings.timestampPattern));
  if (!match) return null;
  const segments = match[1].split(/[^0-9]+/).filter(Boolean).map(segment => BigInt(segment));
  return segments.length > 0 ? segments : null;
}

export function compareVersions(left, right) {
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const a = left[index] ?? 0n;
    const b = right[index] ?? 0n;
    if (a !== b) return a > b ? 1 : -1;
  }
  return 0;
}

export function formatVersion(version) {
  return version.map(String).join('.');
}

export function checkReversible(path, content, settings, fileExists) {
  if (settings.downRequired === false) return null;
  if (/\.up\.[a-z]+$/i.test(path)) {
    return fileExists(path.replace(/\.up\.([a-z]+)$/i, '.down.$1')) ? null : `${path} has no matching .down file`;
  }
  if (/\.down\.[a-z]+$/i.test(path)) return null;
  if (!settings.downPattern) return null;
  return new RegExp(settings.downPattern).test(content) ? null : `${path} has no down/rollback step`;
}

export function checkOrder(path, existingVersions, settings) {
  const version = readVersion(path, settings);
  if (version === null) return `${path} has no version prefix matching ${settings.timestampPattern}`;
  const newest = existingVersions.reduce((max, value) => (max === null || compareVersions(value, max) > 0 ? value : max), null);
  if (newest === null || compareVersions(version, newest) > 0) return null;
  return `${path} is not newer than the newest migration already on the base branch (${formatVersion(newest)})`;
}

export function checkRegistration(path, orderFileContent) {
  const name = basename(path, extname(path));
  return orderFileContent.includes(name) ? null : `${path} is not registered in the migration order file`;
}

function listBaseMigrations(baseRef, settings) {
  return (settings.dirs ?? [])
    .flatMap(dir => {
      try {
        return git(['ls-tree', '-r', '--name-only', baseRef, '--', dir]).split('\n');
      } catch {
        return [];
      }
    })
    .filter(path => path && isMigrationFile(path, settings) && !isIgnoredMigration(path, settings));
}

function main() {
  const config = loadKitConfig();
  const settings = config.migrations;
  if (!settings) return;
  const baseRef = resolveBaseRef(config);
  const added = listChangedFiles(baseRef, 'A').filter(path => isMigrationFile(path, settings) && !isIgnoredMigration(path, settings));
  if (added.length === 0) {
    process.stdout.write('No new migrations.\n');
    return;
  }
  const baseMigrations = listBaseMigrations(baseRef, settings);
  const versionsInDir = dir =>
    baseMigrations
      .filter(path => dirname(path) === dir)
      .map(path => readVersion(path, settings))
      .filter(value => value !== null);
  const orderFile = settings.orderFile ? join(REPO_ROOT, settings.orderFile) : null;
  const orderContent = orderFile && existsSync(orderFile) ? readFileSync(orderFile, 'utf8') : null;
  const fileExists = path => existsSync(join(REPO_ROOT, path));
  const problems = added.flatMap(path => [
    checkReversible(path, readFileSync(join(REPO_ROOT, path), 'utf8'), settings, fileExists),
    settings.orderCheck === false || /\.down\.[a-z]+$/i.test(path) ? null : checkOrder(path, versionsInDir(dirname(path)), settings),
    orderContent === null ? null : checkRegistration(path, orderContent),
  ]).filter(Boolean);
  for (const problem of problems) annotate('error', problem);
  process.stdout.write(`Checked ${added.length} new migration file(s).\n`);
  if (problems.length > 0) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) main();
