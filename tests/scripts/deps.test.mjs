import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const TEMPLATES = '../../plugins/project-setup-kit/skills/setup-kit/templates';
const { assessPackage, checkPackages, findInstalledPackages, isAllowed, lookupPackage, resolveDependencyPolicy } = await import(`${TEMPLATES}/guards/package-registry.mjs`);
const { checkDepsCall } = await import(`${TEMPLATES}/guards/deps-guard.mjs`);
const { findNewDependencies, manifestFor } = await import(`${TEMPLATES}/checks/new-deps.mjs`);

const NOW = Date.parse('2026-11-11T00:00:00Z');

function fakeRegistry(packages) {
  return async url => {
    const npmMeta = url.match(/^https:\/\/registry\.npmjs\.org\/(.+)$/);
    const npmDownloads = url.match(/^https:\/\/api\.npmjs\.org\/downloads\/point\/last-week\/(.+)$/);
    const name = decodeURIComponent((npmMeta ?? npmDownloads ?? [])[1] ?? '');
    const pkg = packages[name];
    if (!pkg) return new Response('{}', { status: 404 });
    if (npmDownloads) return Response.json({ downloads: pkg.downloads });
    return Response.json({ time: { created: pkg.created } });
  };
}

const REGISTRY = fakeRegistry({
  react: { created: '2011-10-26T00:00:00Z', downloads: 25_000_000 },
  'brand-new-helper': { created: '2026-11-08T00:00:00Z', downloads: 3 },
  '@acme/ui': { created: '2020-01-01T00:00:00Z', downloads: 10 },
});

describe('install command parsing', () => {
  const cases = [
    ['npm install react', [['npm', 'react']]],
    ['npm i -D @types/node@22 vitest', [['npm', '@types/node'], ['npm', 'vitest']]],
    ['pnpm add --filter web zod@^3', [['npm', 'zod']]],
    ['yarn add lodash', [['npm', 'lodash']]],
    ['bun add hono', [['npm', 'hono']]],
    ['npm install', []],
    ['npm ci', []],
    ['npm install ./local-pkg ../other file:../x github:user/repo user/repo https://x.test/a.tgz', []],
    ['pip install requests==2.32.0 "fastapi[standard]>=0.115"', [['pypi', 'requests'], ['pypi', 'fastapi']]],
    ['python -m pip install -r requirements.txt', []],
    ['pip install -e .', []],
    ['uv add httpx', [['pypi', 'httpx']]],
    ['uv pip install pydantic-settings', [['pypi', 'pydantic-settings']]],
    ['poetry add -G dev pytest', [['pypi', 'pytest']]],
    ['composer require laravel/sanctum:^4.0', [['packagist', 'laravel/sanctum']]],
    ['cargo add serde --features derive', [['crates', 'serde']]],
    ['go get github.com/spf13/cobra@v1.8.0', [['go', 'github.com/spf13/cobra']]],
    ['go install ./...', []],
    ['cd web && npm install react && npm test', [['npm', 'react']]],
    ['echo npm install react', []],
    ['git commit -m "npm install react"', []],
  ];
  for (const [command, expected] of cases) {
    it(`should find ${expected.length} package(s) in: ${command}`, () => {
      assert.deepEqual(findInstalledPackages(command).map(pkg => [pkg.ecosystem, pkg.name]), expected);
    });
  }
});

describe('registry assessment', () => {
  const policy = resolveDependencyPolicy({});

  it('should block a package the registry does not know', async () => {
    const info = await lookupPackage('npm', 'react-codeshift', { fetchImpl: REGISTRY });
    assert.equal(assessPackage(info, policy, NOW).level, 'block');
  });

  it('should warn about a package published days ago with few downloads', async () => {
    const info = await lookupPackage('npm', 'brand-new-helper', { fetchImpl: REGISTRY });
    const result = assessPackage(info, policy, NOW);
    assert.equal(result.level, 'warn');
    assert.match(result.reasons.join(' '), /3 days ago.*only 3 downloads/);
  });

  it('should accept an established package', async () => {
    assert.equal(assessPackage(await lookupPackage('npm', 'react', { fetchImpl: REGISTRY }), policy, NOW).level, 'ok');
  });

  it('should report unknown instead of blocking when the registry cannot be reached', async () => {
    const offline = async () => {
      throw new Error('getaddrinfo ENOTFOUND');
    };
    const result = assessPackage(await lookupPackage('npm', 'react', { fetchImpl: offline }), policy, NOW);
    assert.equal(result.level, 'unknown');
  });

  it('should skip packages on the allow list, such as a private scope', async () => {
    const scoped = { ...policy, allow: ['@acme/*'] };
    assert.equal(isAllowed('@acme/ui', scoped), true);
    assert.deepEqual(await checkPackages([{ ecosystem: 'npm', name: '@acme/ui' }], scoped, { fetchImpl: REGISTRY, now: NOW }), []);
  });
});

describe('deps-guard', () => {
  const call = command => ({ host: 'claude', commands: [command] });

  it('should ask before installing a package that does not exist', async () => {
    const decision = await checkDepsCall(call('npm install react-codeshift'), {}, { fetchImpl: REGISTRY, now: NOW });
    assert.equal(decision.decision, 'ask');
    assert.match(decision.reason, /react-codeshift \(npm\) does not exist/);
  });

  it('should deny when the project chose deny mode', async () => {
    const decision = await checkDepsCall(call('npm install brand-new-helper'), { dependencyCheck: { mode: 'deny' } }, { fetchImpl: REGISTRY, now: NOW });
    assert.equal(decision.decision, 'deny');
  });

  it('should stay silent for established packages and for commands that install nothing new', async () => {
    assert.equal(await checkDepsCall(call('npm install react'), {}, { fetchImpl: REGISTRY, now: NOW }), null);
    assert.equal(await checkDepsCall(call('npm ci && npm test'), {}, { fetchImpl: REGISTRY, now: NOW }), null);
  });
});

describe('new dependencies in manifests', () => {
  it('should find packages added to package.json and ignore local and workspace ones', () => {
    const before = JSON.stringify({ dependencies: { react: '^19.0.0' } });
    const after = JSON.stringify({ dependencies: { react: '^19.0.0', zod: '^3', ui: 'workspace:*', local: 'file:../x', alias: 'npm:@scope/real@^1' }, devDependencies: { vitest: '^3' } });
    assert.deepEqual(findNewDependencies([{ path: 'web/package.json', before, after }]).map(dep => dep.name), ['zod', '@scope/real', 'vitest']);
  });

  it('should read pyproject dependencies, optional groups and poetry tables', () => {
    const after = '[project]\nname = "app"\ndependencies = [\n  "fastapi>=0.115",\n  "SQLAlchemy[asyncio]~=2.0",\n]\n\n[project.optional-dependencies]\ndev = ["pytest"]\n\n[tool.poetry.group.dev.dependencies]\nruff = "^0.7"\npython = "^3.12"\n';
    assert.deepEqual(findNewDependencies([{ path: 'pyproject.toml', before: '', after }]).map(dep => dep.name), ['fastapi', 'sqlalchemy', 'pytest', 'ruff']);
  });

  it('should read requirements files, composer, Cargo, go.mod and pom.xml', () => {
    const changes = [
      { path: 'requirements-dev.txt', before: 'requests\n', after: 'requests\n# comment\n-r base.txt\nhttpx==0.27\n' },
      { path: 'composer.json', before: '{}', after: JSON.stringify({ require: { php: '^8.3', 'ext-json': '*', 'laravel/framework': '^11' } }) },
      { path: 'Cargo.toml', before: '', after: '[dependencies]\nserde = { version = "1", features = ["derive"] }\nlocal = { path = "../local" }\nshared = { workspace = true }\nrenamed = { package = "real-crate", version = "1" }\n' },
      { path: 'go.mod', before: 'module x\n', after: 'module x\n\nrequire (\n\tgithub.com/spf13/cobra v1.8.0\n\tgithub.com/acme/local v0.0.0\n)\n\nrequire golang.org/x/sync v0.8.0\n\nreplace github.com/acme/local => ../local\n' },
      { path: 'pom.xml', before: '', after: '<dependencies><dependency><groupId>org.springframework</groupId><artifactId>spring-core</artifactId></dependency><dependency><groupId>${project.groupId}</groupId><artifactId>x</artifactId></dependency></dependencies>' },
    ];
    assert.deepEqual(findNewDependencies(changes).map(dep => `${dep.ecosystem}:${dep.name}`), [
      'pypi:httpx',
      'packagist:laravel/framework',
      'crates:serde',
      'crates:real-crate',
      'go:github.com/spf13/cobra',
      'go:golang.org/x/sync',
      'maven:org.springframework:spring-core',
    ]);
  });

  it('should recognize manifest files by name only', () => {
    assert.equal(manifestFor('api/requirements.in').ecosystem, 'pypi');
    assert.equal(manifestFor('docs/package.json.md'), null);
  });
});
