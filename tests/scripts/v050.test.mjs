import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const SKILL = '../../plugins/project-setup-kit/skills/setup-kit';
const { findInstalledPackages, lookupPackage, readPrivateRegistries } = await import(`${SKILL}/templates/guards/package-registry.mjs`);
const { findNewDependencies } = await import(`${SKILL}/templates/checks/new-deps.mjs`);
const { selectSteps } = await import(`${SKILL}/templates/checks/verify.mjs`);
const { addConfigSections, findUnpinnedActions, listPending, pinWorkflowText } = await import(`${SKILL}/scripts/kit.mjs`);
const { goLatest } = await import(`${SKILL}/scripts/outdated.mjs`);

const names = command => findInstalledPackages(command).map(pkg => `${pkg.ecosystem}:${pkg.name}${pkg.privateSource ? ' (private)' : ''}`);

function tempDir(files = {}) {
  const root = mkdtempSync(join(tmpdir(), 'kit-v050-'));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

describe('install commands that used to give false results', () => {
  const cases = [
    ['pip install --trusted-host pypi.corp.example.com requests', ['pypi:requests']],
    ['pip install --timeout 60 --retries 3 requests', ['pypi:requests']],
    ['cargo add tokio --target x86_64-pc-windows-msvc', ['crates:tokio']],
    ['npm install lodash > install.log 2>&1', ['npm:lodash']],
    ['npm install lodash 2> err.txt', ['npm:lodash']],
    ['cd web\nnpm install leftpad', ['npm:leftpad']],
    ['npm i legacy@npm:lodash@4', ['npm:lodash']],
    ['composer require monolog/monolog=^2', ['packagist:monolog/monolog']],
    ['composer require "monolog/monolog ^2"', ['packagist:monolog/monolog']],
    ['pnpm add -w typescript', ['npm:typescript']],
    ['pnpm --filter web add zod', ['npm:zod']],
    ['yarn global add serve', ['npm:serve']],
    ['pip install -i https://pypi.corp/simple internal-lib', ['pypi:internal-lib (private)']],
    ['npm install --registry https://npm.corp internal-lib', ['npm:internal-lib (private)']],
    ['go install golang.org/x/tools/cmd/goimports@latest', ['go:golang.org/x/tools/cmd/goimports']],
  ];
  for (const [command, expected] of cases) it(`should read: ${JSON.stringify(command)}`, () => assert.deepEqual(names(command), expected));
});

describe('Go packages inside a module', () => {
  it('should find the module that holds a package path', async () => {
    const known = new Set(['golang.org/x/tools', 'github.com/golangci/golangci-lint/v2']);
    const fetchImpl = async url => {
      const module = url.match(/proxy\.golang\.org\/(.+?)\/@/)[1];
      if (!known.has(module)) return new Response('', { status: 410 });
      if (url.endsWith('/@v/list')) return new Response('v1.0.0\n');
      return Response.json({ Version: 'v1.0.0', Time: '2020-01-01T00:00:00Z' });
    };
    const tools = await lookupPackage('go', 'golang.org/x/tools/cmd/goimports', { fetchImpl });
    assert.equal(tools.exists, true);
    assert.equal(tools.module, 'golang.org/x/tools');
    const lint = await lookupPackage('go', 'github.com/golangci/golangci-lint/v2/cmd/golangci-lint', { fetchImpl });
    assert.equal(lint.module, 'github.com/golangci/golangci-lint/v2');
    assert.equal((await lookupPackage('go', 'github.com/nobody/nothing/cmd/x', { fetchImpl })).exists, false);
  });

  it('should report the latest version of a nested module, not of its parent', async () => {
    const fetchImpl = async url => (url.includes('/x/tools/gopls/@latest') ? Response.json({ Version: 'v0.24.0' }) : url.includes('/x/tools/@latest') ? Response.json({ Version: 'v0.52.0' }) : new Response('', { status: 404 }));
    assert.equal(await goLatest('golang.org/x/tools/gopls', fetchImpl), 'v0.24.0');
    assert.equal(await goLatest('golang.org/x/tools/cmd/deadcode', fetchImpl), 'v0.52.0');
  });
});

describe('private registries outside the project files', () => {
  it('should read the user npmrc, yarn npmScopes, NuGet.config in any casing, Maven repositories and go env', () => {
    const root = tempDir({
      '.yarnrc.yml': 'npmScopes:\n  acme:\n    npmRegistryServer: "https://npm.acme.test"\n',
      'NuGet.config': '<configuration><packageSources><add key="corp" value="https://nuget.corp.test/v3/index.json" /></packageSources></configuration>',
      'pom.xml': '<project><repositories><repository><url>https://maven.corp.test</url></repository></repositories></project>',
    });
    const home = tempDir({ '.npmrc': '@corp:registry=https://npm.corp.test/\n' });
    const result = readPrivateRegistries(root, { home, env: {}, readGoEnv: () => ['github.com/corp', ''] });
    assert.deepEqual(result.allow.sort(), ['@acme/*', '@corp/*', 'github.com/corp*']);
    assert.deepEqual(result.ecosystems.sort(), ['maven', 'nuget']);
  });
});

describe('manifest parsing that used to flag local packages', () => {
  it('should skip Poetry path and git dependencies, include-group entries and direct references', () => {
    const pyproject = '[dependency-groups]\ndev = [{include-group = "test"}, "ruff"]\ntest = ["pytest"]\n\n[tool.poetry.dependencies]\npython = "^3.12"\nmylib = { path = "../mylib" }\nother = { git = "https://example.test/other.git" }\nhttpx = "^0.28"\n';
    assert.deepEqual(findNewDependencies([{ path: 'pyproject.toml', before: '', after: pyproject }]).map(dep => dep.name), ['ruff', 'pytest', 'httpx']);
    const requirements = 'mypkg @ git+https://github.com/me/mypkg.git\ngit+https://github.com/me/other.git#egg=other\nrequests==2.32.0\n';
    assert.deepEqual(findNewDependencies([{ path: 'requirements.txt', before: '', after: requirements }]).map(dep => dep.name), ['requests']);
  });

  it('should skip jsr and catalog specs in package.json and sibling Maven modules', () => {
    const pkg = JSON.stringify({ dependencies: { '@std/path': 'jsr:^1.0.0', react: 'catalog:', zod: '^3' } });
    assert.deepEqual(findNewDependencies([{ path: 'package.json', before: '{}', after: pkg }]).map(dep => dep.name), ['zod']);
    const pom = '<project><groupId>com.acme.shop</groupId><artifactId>shop-api</artifactId><dependencies><dependency><groupId>com.acme.shop</groupId><artifactId>shop-core</artifactId></dependency><dependency><groupId>org.slf4j</groupId><artifactId>slf4j-api</artifactId></dependency></dependencies></project>';
    assert.deepEqual(findNewDependencies([{ path: 'api/pom.xml', before: '', after: pom }]).map(dep => dep.name), ['org.slf4j:slf4j-api']);
  });
});

describe('kit.mjs fixes from the end-to-end run', () => {
  it('should pin actions in workflows with Windows line endings and keep trailing directives', () => {
    const text = 'steps:\r\n  - uses: actions/checkout@v7 # zizmor: ignore[artipacked]\r\n';
    assert.equal(findUnpinnedActions(text).length, 1);
    const pinned = pinWorkflowText(text, () => 'a'.repeat(40)).text;
    assert.equal(pinned, `steps:\r\n  - uses: actions/checkout@${'a'.repeat(40)} # v7 zizmor: ignore[artipacked]\r\n`);
  });

  it('should not copy the template notes into the project config', () => {
    const defaults = { postEdit: { rules: [{ glob: '*.ts', commands: ['x'] }], note: 'for the agent' } };
    assert.deepEqual(addConfigSections({}, defaults, ['postEdit']), { postEdit: { rules: [{ glob: '*.ts', commands: ['x'] }] } });
  });

  it('should list only *.pending files as pending', () => {
    const root = tempDir({ '.ai-kit/pending/dot-claude/settings.json.pending': '{}', '.ai-kit/pending/scratch.txt': 'x' });
    assert.deepEqual(listPending(root).map(entry => entry.target), ['.claude/settings.json']);
  });

  it('should run only the fast verify steps for the stop check, or all when none is marked', () => {
    const settings = { steps: [{ name: 'lint', run: 'l', fast: true }, { name: 'build', run: 'b' }] };
    assert.deepEqual(selectSteps(settings, null, true).map(step => step.name), ['lint']);
    assert.deepEqual(selectSteps({ steps: [{ name: 'build', run: 'b' }] }, null, true).map(step => step.name), ['build']);
  });
});
