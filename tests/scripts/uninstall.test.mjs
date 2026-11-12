import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const { formatRemovalPlan, hashContent, planRemoval } = await import('../../plugins/project-setup-kit/skills/setup-kit/scripts/kit.mjs');

function setup() {
  const root = mkdtempSync(join(tmpdir(), 'kit-uninstall-'));
  const files = {
    '.ai-kit/hooks/git-guard.mjs': 'guard',
    '.github/workflows/ci.yml': 'ci',
    '.github/workflows/security.yml': 'security edited by the team',
    'AGENTS.md': '# Rules',
  };
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  const state = {
    items: { 1: { state: 'installed' }, 9: { state: 'installed' }, 21: { state: 'installed' }, 24: { state: 'installed' }, 27: { state: 'installed' }, 6: { state: 'declined' } },
    files: {
      '.ai-kit/hooks/git-guard.mjs': { hash: hashContent('guard'), items: ['9'] },
      '.github/workflows/ci.yml': { hash: hashContent('ci'), items: ['21', '24'] },
      '.github/workflows/security.yml': { hash: hashContent('security'), items: ['27'] },
      'AGENTS.md': { hash: 'merged', items: ['1', '9'] },
      'docs/ai-memory/README.md': { hash: hashContent('x'), items: ['6'] },
    },
    settings: { done: ['required-check:ci'] },
  };
  return { root, state };
}

describe('uninstall plan', () => {
  it('should keep a file another installed item still uses when removing one item', () => {
    const { root, state } = setup();
    const plan = planRemoval(state, root, { item: '24' });
    assert.deepEqual(plan.keepShared, [{ path: '.github/workflows/ci.yml', sharedWith: ['21'] }]);
    assert.deepEqual(plan.delete, []);
    rmSync(root, { recursive: true, force: true });
  });

  it('should sort every recorded file for a full removal by what is safe to do', () => {
    const { root, state } = setup();
    const plan = planRemoval(state, root, { all: true });
    assert.deepEqual(plan.delete, ['.ai-kit/hooks/git-guard.mjs', '.github/workflows/ci.yml']);
    assert.deepEqual(plan.ask, ['.github/workflows/security.yml']);
    assert.deepEqual(plan.editMerged, ['AGENTS.md']);
    assert.deepEqual(plan.missing, ['docs/ai-memory/README.md']);
    assert.deepEqual(plan.settings, ['required-check:ci']);
    assert.deepEqual(plan.items.sort(), ['1', '21', '24', '27', '9']);
    const text = formatRemovalPlan(plan);
    assert.match(text, /Ask first[^\n]*\n {2}\.github\/workflows\/security\.yml/);
    assert.match(text, /Repository settings to undo by hand[^\n]*\n {2}required-check:ci/);
    rmSync(root, { recursive: true, force: true });
  });
});
