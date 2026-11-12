# GitHub workflows

- `ci.yml` is the shell. Insert one job per part from `ci.<language>.yml` (node, python, php, go, java, dotnet, ruby, rust). Java: keep only the Maven or the Gradle steps and remove the `if` lines; prefer the wrapper (`mvnw`/`gradlew`) and add it if missing (ask first). Static checks (Checkstyle, PMD, SpotBugs, Error Prone) run inside `verify`/`check` once they are configured in the build file. The `dependency-submission` step lets the dependency review (item 28) see Gradle dependencies; Maven needs the GitHub dependency graph enabled in the repo settings. Kotlin uses `ci.java.yml` with Gradle (add ktlint/detekt tasks to `check`). .NET: without a `global.json` replace `global-json-file` by `dotnet-version` from the `TargetFramework`; `--locked-mode` needs `RestorePackagesWithLockFile` (offer to enable it, else drop the flag). Ruby: `{{TEST_COMMAND}}` is `bundle exec rspec` or `bin/rails test`; `bundler-audit` must be in the Gemfile's development group (offer to add it). Rust: `--locked` needs a committed `Cargo.lock` (applications commit it; for a library, ask). For other languages write the job from `references/languages.md` in the same shape: checkout, setup, install from lockfile, lint, type-check, test, build.
- `if: "{{…}}"` lines are template switches, not real conditions (GitHub treats any non-empty string as true). Always delete the line; when the switch is off, delete the whole step with it.
- `{{NODE_VERSION}}`: take it from `.nvmrc` / `.node-version` (then use `node-version-file` instead), `engines.node`, `volta.node`, or the major version developers run locally (`node --version`); for a new project with none of these, use the current Node LTS major (22) and write it to `.nvmrc` too. Never hard-code a version the project does not use.
- `{{USES_PNPM}}`: keep the `pnpm/action-setup` step and drop the `if` line when the project uses pnpm (it reads the version from `packageManager`); delete the step otherwise. setup-node's `cache: pnpm` fails without it.
- `{{AUDIT_COMMAND}}`: `pnpm audit --audit-level=high --prod`, `npm audit --audit-level=high --omit=dev`, `composer audit`, `pip-audit`, `govulncheck ./...`. If the audit is red on day one, show the findings and ask whether the job starts as required or as a warning (`continue-on-error: true`) until they are fixed.
- `dependency-review`: needs the GitHub dependency graph; on private repos it also needs GitHub Code Security. If that is not available, delete the job and keep `audit`; for item 30 use a license tool instead, with a pinned version: `npx license-checker-rseidelsohn@5.0.1 --onlyAllow "<list>"` (5.x needs Node 24 and npm 11 on the runner; with an older Node use `@4.4.2`), `pip-licenses --allow-only`, `composer licenses`. Next.js and sharp pull in `@img/sharp-libvips-*`, prebuilt binaries under LGPL-3.0 that are dynamically linked and fine for most closed-source apps: ask the user, and if accepted exclude them with `--excludePackagesStartingWith "@img/sharp-libvips"` instead of allowing LGPL everywhere.
- `{{GITLEAKS_VERSION}}`: the kit's pinned default is `v8.30.1`; write it, then `kit.mjs outdated` (Phase 5 and `doctor`) reports when a newer one exists.
- Builds that read env variables at build time (Next.js, Vite with a validated env module) need placeholder values in CI: add an `env:` block on the build step with obviously fake values (`https://example.invalid`, `ci-placeholder-not-a-secret`), never real keys.
- `{{IS_NODE}}` in `security.yml`: keep the Node setup steps only for JS projects; other ecosystems need their own setup step before the audit command.
- `pr-conventions.yml` `branch` job: keep it only if item 38 is installed.
- `ci.node.yml` precheck step: keep it only if item 15 installed `precheck.mjs`; it runs on pull requests only (it needs a base branch).
- `{{FRONTEND_PATH}}` at the repo root: use `.` for `directory` and drop the `paths:` filter (or list the real source folders); `./**` is not a valid filter.
- `{{BUILD_ENV_PLACEHOLDERS}}`: one entry per variable the build validates, with an obviously fake value; the size-limit action runs the build too, so it needs the same `env:` block. Remove the block when the build reads no env.
- `bundle-size.yml`: also write `ci/.size-limit.json` to the frontend folder as `.size-limit.json` and add the dev dependencies `size-limit` and `@size-limit/preset-app` (or `@size-limit/file` for static output). Current size-limit needs Node 22+ in the job that runs it, which is the `{{NODE_VERSION}}` the workflow sets up (the project's version, not the developer's machine); only when the project itself is on an older Node pin `size-limit@11`.
- PR conventions skip bot PRs (Dependabot, Renovate); the branch check exempts `dependabot/*` and `renovate/*`.
- Replace every `{{…}}` with the project's real values. Drop steps whose item was declined (for example the dead-code step when item 24 is "no"; replace `if: "{{ITEM_24}}"` by removing the step or the `if`).
- Pin third-party actions to a full commit SHA with the version as a trailing note when the user agrees (safer against tag hijacking). The versions written here are the current major tags (an exact version where the action publishes no major tag, such as `astral-sh/setup-uv` and `actions/dependency-review-action`); item 48 resolves them to SHAs with `kit.mjs pin-actions`. Before writing a workflow, check that each major is still the latest (`git ls-remote --tags https://github.com/<owner>/<action>`) and read the release notes of any newer major before using it.
- Every workflow sets the minimum `permissions` it needs. Keep it that way.
- Checkouts use `persist-credentials: false` so the token is not left in `.git/config` for later steps. The one exception is `bundle-size.yml`: `size-limit-action` runs `git fetch origin <base>` itself to measure the base branch, which needs the token on private repositories; its checkout sets `persist-credentials: true` with a `zizmor: ignore[artipacked]` directive on that line. Keep that exception for any other action that fetches with git on its own.

| File | Item |
|---|---|
| `ci.yml` + `ci.<language>.yml` | 21, 24 |
| `agent-files.yml` | 3, 4 |
| `lint-ratchet.yml` | 16 |
| `ai-review.yml` | 22 |
| `sonar.yml` | 23 (Sonar) |
| `coverage.yml`, `duplication.yml` | 23 (no Sonar) |
| `pr-size.yml` | 25 |
| `bundle-size.yml` | 26 |
| `security.yml` | 27, 28, 30 |
| `pr-conventions.yml` | 38, 39, 40 |
| `release.yml` | 41 |
| `migrations.yml` | 43 |
| `preview-fe.yml` | 46 |
