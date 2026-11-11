import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const { checkOutdated, findPins, formatOutdated, latestStable } = await import('../../plugins/project-setup-kit/skills/setup-kit/scripts/outdated.mjs');

const SHA = 'a'.repeat(40);
const TAGS = {
  'actions/checkout': ['v4', 'v4.4.0', 'v7', 'v7.0.1', 'v7.1.0-beta'],
  'actions/setup-node': ['v4', 'v4.4.0', 'v7', 'v7.1.0'],
  'rhysd/actionlint': ['v1.7.1', 'v1.7.12'],
  'aquasecurity/trivy': ['v0.76.2'],
  'astral-sh/setup-uv': ['v7', 'v10.3.3'],
};
const resolvers = { tags: repo => TAGS[repo] ?? [], npm: name => ({ '@upstash/context7-mcp': '4.7.0' })[name] };

function project(files) {
  const root = mkdtempSync(join(tmpdir(), 'kit-outdated-'));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

describe('outdated pins', () => {
  it('should find actions by tag or by SHA with a version note, tool images and npm pins', () => {
    const text = [
      '      - uses: actions/checkout@v4',
      `      - uses: actions/setup-node@${SHA} # v4`,
      '      - uses: ./.github/actions/local',
      '      - run: docker run rhysd/actionlint:1.7.1 && docker run aquasec/trivy:0.76.2 config .',
      '      - run: npx squawk-cli@2.72.0 a.sql',
    ].join('\n');
    assert.deepEqual(findPins('ci.yml', text).map(pin => `${pin.kind}:${pin.name}@${pin.current}`), [
      'action:actions/checkout@v4',
      'action:actions/setup-node@v4',
      'image:rhysd/actionlint@1.7.1',
      'image:aquasec/trivy@0.76.2',
      'npm:squawk-cli@2.72.0',
    ]);
  });

  it('should ignore pre-releases when picking the latest version', () => {
    assert.equal(latestStable(['v7.0.1', 'v7.1.0-beta', 'v6.9.9']), 'v7.0.1');
  });

  it('should report major and minor updates and stay quiet about current pins', () => {
    const root = project({
      '.github/workflows/ci.yml': `jobs:\n  a:\n    steps:\n      - uses: actions/checkout@v7\n      - uses: actions/setup-node@${SHA} # v4\n      - run: docker run rhysd/actionlint:1.7.1\n      - uses: astral-sh/setup-uv@v10.3.3\n`,
      '.mcp.json': '{"mcpServers":{"docs":{"command":"npx","args":["-y","@upstash/context7-mcp@4.6.0"]}}}',
    });
    const results = checkOutdated(root, resolvers);
    const byName = Object.fromEntries(results.map(result => [result.name, result]));
    assert.equal(byName['actions/checkout'].status, 'current');
    assert.equal(byName['actions/setup-node'].status, 'major');
    assert.equal(byName['actions/setup-node'].latest, 'v7');
    assert.equal(byName['rhysd/actionlint'].latest, '1.7.12');
    assert.equal(byName['astral-sh/setup-uv'].status, 'current');
    assert.equal(byName['@upstash/context7-mcp'].status, 'minor');
    const report = formatOutdated(results);
    assert.match(report, /MAJOR \.github\/workflows\/ci\.yml:5 actions\/setup-node v4 → v7 \(pinned SHA/);
    assert.match(report, /3 of 5 pinned versions are behind/);
  });

  it('should mark a pin as unknown when its releases cannot be read', () => {
    const root = project({ '.github/workflows/ci.yml': '      - uses: actions/checkout@v4\n' });
    const [result] = checkOutdated(root, { tags: () => { throw new Error('network down'); } });
    assert.equal(result.status, 'unknown');
    assert.match(formatOutdated([result]), /\?\s+\.github\/workflows\/ci\.yml:1 actions\/checkout v4 \(network down\)/);
  });
});
