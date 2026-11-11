import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const TEMPLATES = '../../plugins/project-setup-kit/skills/setup-kit/templates';
const { parseFindings } = await import(`${TEMPLATES}/checks/lint-ratchet.mjs`);
const { checkOrder, checkReversible, compareVersions, isIgnoredMigration, isMigrationFile, readVersion } = await import(`${TEMPLATES}/checks/migration-check.mjs`);

const flyway = {
  dirs: ['src/main/resources/db/migration'],
  filePattern: '\\.(sql|java)$',
  timestampPattern: '^V(\\d+(?:[._]\\d+)*)__',
  downRequired: false,
  ignorePattern: '^(R|U)[0-9]*__',
};

describe('lint ratchet with Java tools', () => {
  it('should parse Checkstyle lines when they start with a severity tag', () => {
    const findings = parseFindings('[WARN] /repo/src/main/java/App.java:12:5: Missing a Javadoc comment. [MissingJavadocMethod]');
    assert.deepEqual(findings, [{ file: '/repo/src/main/java/App.java', line: 12, message: 'Missing a Javadoc comment. [MissingJavadocMethod]' }]);
  });

  it('should parse Checkstyle error lines when the tag is ERROR', () => {
    assert.equal(parseFindings('[ERROR] src/main/java/App.java:3: Line is longer than 120 characters.').at(0).line, 3);
  });

  it('should parse Maven compiler lines when the position is in brackets', () => {
    const findings = parseFindings('[WARNING] /repo/src/main/java/App.java:[27,13] unchecked conversion');
    assert.deepEqual(findings, [{ file: '/repo/src/main/java/App.java', line: 27, message: 'unchecked conversion' }]);
  });

  it('should parse PMD emacs lines when they have no column', () => {
    assert.equal(parseFindings('src/main/java/App.java:40:\tAvoid unused local variables such as x.').at(0).line, 40);
  });

  it('should ignore Maven progress lines when they have no file position', () => {
    assert.deepEqual(parseFindings('[INFO] BUILD SUCCESS\n[INFO] Total time: 3.2 s\n[ERROR] Failed to execute goal'), []);
  });
});

describe('Flyway migrations', () => {
  it('should read dotted and underscored versions as segments', () => {
    assert.deepEqual(readVersion('V1.10__add_index.sql', flyway), [1n, 10n]);
    assert.deepEqual(readVersion('V2_1__add_column.sql', flyway), [2n, 1n]);
    assert.deepEqual(readVersion('V20260101120000__init.sql', flyway), [20260101120000n]);
  });

  it('should order V1.10 after V1.9 when comparing segment by segment', () => {
    assert.equal(compareVersions([1n, 10n], [1n, 9n]), 1);
    assert.equal(compareVersions([1n], [1n, 0n]), 0);
  });

  it('should accept a new version when it is newer than the base branch', () => {
    assert.equal(checkOrder('src/main/resources/db/migration/V1.10__x.sql', [[1n, 9n], [1n, 2n]], flyway), null);
  });

  it('should reject a new version when it reuses or precedes an existing one', () => {
    assert.match(checkOrder('src/main/resources/db/migration/V1.9__x.sql', [[1n, 9n]], flyway), /not newer than .*1\.9/);
  });

  it('should not require a down step when downRequired is false', () => {
    assert.equal(checkReversible('src/main/resources/db/migration/V3__x.sql', 'CREATE TABLE t (id int);', flyway, () => false), null);
  });

  it('should skip repeatable and undo scripts when ignorePattern matches', () => {
    assert.equal(isIgnoredMigration('src/main/resources/db/migration/R__views.sql', flyway), true);
    assert.equal(isIgnoredMigration('src/main/resources/db/migration/U3__undo.sql', flyway), true);
    assert.equal(isIgnoredMigration('src/main/resources/db/migration/V3__x.sql', flyway), false);
  });

  it('should recognise Java-based migrations when they live in the migration folder', () => {
    assert.equal(isMigrationFile('src/main/resources/db/migration/V4__Backfill.java', flyway), true);
    assert.equal(isMigrationFile('src/main/java/App.java', flyway), false);
  });
});
