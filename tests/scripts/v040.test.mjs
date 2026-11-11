import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const SKILL = '../../plugins/project-setup-kit/skills/setup-kit';
const { runSteps, selectSteps } = await import(`${SKILL}/templates/checks/verify.mjs`);
const { findUnpinnedActions, pinWorkflowText, resolveActionSha } = await import(`${SKILL}/scripts/kit.mjs`);
const { renderAll, renderTemplate } = await import('../lint-workflows.mjs');

const SHA_A = 'a'.repeat(40);
const SHA_B = 'b'.repeat(40);

describe('verify command', () => {
  const settings = { steps: [{ name: 'lint', run: 'lint' }, { name: 'test', run: 'test', cwd: 'web' }, { name: 'build', run: 'build' }] };

  it('should run every step and report all failures when not bailing', () => {
    const ran = [];
    const { ok, results } = runSteps(settings.steps, { root: '/repo', run: (command, cwd) => (ran.push([command, cwd]), command === 'test' ? 1 : 0), log: () => {} });
    assert.equal(ok, false);
    assert.deepEqual(ran.map(([command]) => command), ['lint', 'test', 'build']);
    assert.match(ran[1][1].split('\\').join('/'), /\/repo\/web$/);
    assert.deepEqual(results.map(result => result.ok), [true, false, true]);
  });

  it('should stop at the first failure with bail', () => {
    const lines = [];
    const { ok, results } = runSteps(settings.steps, { root: '/repo', bail: true, run: command => (command === 'lint' ? 1 : 0), log: line => lines.push(line) });
    assert.equal(ok, false);
    assert.equal(results.length, 1);
    assert.match(lines.join('\n'), /2 step\(s\) not run/);
  });

  it('should pick named steps and reject unknown ones', () => {
    assert.deepEqual(selectSteps(settings, 'test,lint').map(step => step.name), ['lint', 'test']);
    assert.throws(() => selectSteps(settings, 'deploy'), /unknown verify step: deploy/);
  });
});

describe('pin-actions', () => {
  const workflow = [
    'steps:',
    '  - uses: actions/checkout@v4',
    '  - uses: "github/codeql-action/init@v3"',
    `  - uses: actions/setup-node@${SHA_A} # v4`,
    '  - uses: ./.github/actions/local',
    '  - uses: docker://alpine:3',
    '  - uses: owner/missing@v9',
  ].join('\n');
  const refs = {
    'actions/checkout': [{ name: 'refs/tags/v4', sha: SHA_B }],
    'github/codeql-action': [{ name: 'refs/tags/v3', sha: 'c'.repeat(40) }, { name: 'refs/tags/v3^{}', sha: 'd'.repeat(40) }],
    'owner/missing': [],
  };
  const resolver = (repo, ref) => resolveActionSha(repo, ref, () => refs[repo]);

  it('should list only actions that are not pinned to a full SHA', () => {
    assert.deepEqual(findUnpinnedActions(workflow).map(entry => `${entry.repo}${entry.path}@${entry.ref}`), ['actions/checkout@v4', 'github/codeql-action/init@v3', 'owner/missing@v9']);
  });

  it('should pin to the peeled commit of an annotated tag and keep the tag as a note', () => {
    const { text, pinned, failed } = pinWorkflowText(workflow, resolver);
    assert.match(text, new RegExp(`uses: actions/checkout@${SHA_B} # v4`));
    assert.match(text, /uses: "github\/codeql-action\/init@d{40}" # v3/);
    assert.match(text, new RegExp(`actions/setup-node@${SHA_A} # v4`));
    assert.match(text, /uses: \.\/\.github\/actions\/local/);
    assert.deepEqual(pinned, ['actions/checkout@v4', 'github/codeql-action/init@v3']);
    assert.deepEqual(failed, ['owner/missing@v9']);
  });
});

describe('workflow template rendering for actionlint and zizmor', () => {
  it('should drop template switches and replace placeholders', () => {
    const rendered = renderTemplate('    - uses: pnpm/action-setup@v4\n      if: "{{USES_PNPM}}"\n    - run: {{INSTALL_COMMAND}} && echo ${{ github.sha }}\n      env:\n        {{BUILD_ENV_PLACEHOLDERS}}');
    assert.equal(rendered, '    - uses: pnpm/action-setup@v4\n    - run: placeholder && echo ${{ github.sha }}\n      env:\n        PLACEHOLDER: "1"');
  });

  it('should render one CI workflow per language and leave no kit placeholders', () => {
    const files = renderAll();
    assert.ok(['ci-node.yml', 'ci-python.yml', 'ci-php.yml', 'ci-go.yml', 'ci-java.yml', 'workflow-security.yml', 'copilot-setup-steps.yml'].every(name => name in files));
    for (const [name, content] of Object.entries(files)) assert.doesNotMatch(content, /(?<!\$)\{\{(?!\s)/, name);
  });
});
