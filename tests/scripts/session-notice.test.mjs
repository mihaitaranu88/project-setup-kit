import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('../../plugins/project-setup-kit/hooks/session-notice.mjs', import.meta.url));
const { buildNotice, compareVersions } = await import(SCRIPT);

function project(state) {
  const root = mkdtempSync(join(tmpdir(), 'kit-notice-'));
  if (state) writeFileSync(join(root, '.ai-kit.json'), JSON.stringify(state));
  return root;
}

describe('session notice', () => {
  it('should stay silent when the project has no .ai-kit.json', () => {
    assert.equal(buildNotice(project(null), '0.3.0'), null);
  });

  it('should suggest an update when the project was set up with an older kit', () => {
    assert.match(buildNotice(project({ kitVersion: '0.2.0' }), '0.3.0'), /0\.3\.0 is installed; this project was set up with 0\.2\.0/);
  });

  it('should stay silent when the project is on the installed version or newer', () => {
    assert.equal(buildNotice(project({ kitVersion: '0.3.0' }), '0.3.0'), null);
    assert.equal(buildNotice(project({ kitVersion: '0.10.0' }), '0.9.0'), null);
  });

  it('should count the files waiting in .ai-kit/pending', () => {
    const root = project({ kitVersion: '0.3.0' });
    mkdirSync(join(root, '.ai-kit/pending/dot-claude'), { recursive: true });
    writeFileSync(join(root, '.ai-kit/pending/dot-claude/settings.json.pending'), '{}');
    writeFileSync(join(root, '.ai-kit/pending/AGENTS.md.pending'), '');
    assert.match(buildNotice(root, '0.3.0'), /^2 kit files wait in \.ai-kit\/pending/);
  });

  it('should stay silent when the project turned the notice off', () => {
    assert.equal(buildNotice(project({ kitVersion: '0.1.0', settings: { sessionNotice: false } }), '0.3.0'), null);
  });

  it('should compare versions numerically', () => {
    assert.ok(compareVersions('0.10.0', '0.9.1') > 0);
    assert.equal(compareVersions('1.2.0', '1.2'), 0);
  });

  it('should print a systemMessage and never fail when run as a hook', () => {
    const root = project({ kitVersion: '0.0.1' });
    const output = execFileSync(process.execPath, [SCRIPT], { env: { ...process.env, CLAUDE_PROJECT_DIR: root }, encoding: 'utf8' });
    assert.match(JSON.parse(output).systemMessage, /Run \/setup-kit update/);
    const broken = project(null);
    writeFileSync(join(broken, '.ai-kit.json'), '{ not json');
    assert.equal(execFileSync(process.execPath, [SCRIPT], { env: { ...process.env, CLAUDE_PROJECT_DIR: broken }, encoding: 'utf8' }), '');
  });
});
