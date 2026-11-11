import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const { buildCases, findDrift, graderMatches } = await import('../build-evals.mjs');

const GO_ANSWER = 'Analysis done.\n```json\n{"mode": "existing",\n "parts": [{"path": ".", "language": "go"}],\n "has": {"frontend": false, "api": true, "db": false, "severalServices": false, "versionedReleases": false},\n "alreadyConfigured": [],\n "notApplicable": [14, 17, 19, 26, 42, 43, "46"]}\n```';

function regexGraders(name) {
  const evalCase = buildCases().find(candidate => candidate.name === name);
  return Object.entries(evalCase.files).filter(([file, content]) => file.startsWith('graders/') && content.includes('type: regex'));
}

describe('plugin eval cases', () => {
  it('should match the committed eval cases with the fixtures', () => {
    assert.deepEqual(findDrift(), []);
  });

  it('should pass every regex grader when the answer matches expected.json', () => {
    for (const [file, content] of regexGraders('detect-go-app')) assert.equal(graderMatches(content, GO_ANSWER), true, file);
  });

  it('should fail the item grader when an expected item is not skipped', () => {
    const answer = GO_ANSWER.replace('14, ', '');
    const failing = regexGraders('detect-go-app').filter(([, content]) => !graderMatches(content, answer)).map(([file]) => file);
    assert.deepEqual(failing, ['graders/skips-item-14.md']);
  });

  it('should not count item 4 as skipped when only 14 or 43 is listed', () => {
    const [, grader] = regexGraders('detect-ts-app').find(([file]) => file === 'graders/skips-item-42.md');
    assert.equal(graderMatches(grader, '"notApplicable": [142, 420]'), false);
    assert.equal(graderMatches(grader, '"alreadyConfigured": [42]'), true);
  });

  it('should count the parts exactly', () => {
    const [, grader] = regexGraders('detect-monorepo').find(([file]) => file === 'graders/parts-count.md');
    assert.equal(graderMatches(grader, '"parts": [{"language": "typescript"}, {"language": "php"}]'), true);
    assert.equal(graderMatches(grader, '"parts": [{"language": "typescript"}]'), false);
  });
});
