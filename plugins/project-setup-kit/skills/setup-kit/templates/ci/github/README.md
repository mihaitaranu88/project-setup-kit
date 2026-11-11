# GitHub workflows

- `ci.yml` is the shell. Insert one job per part from `ci.<language>.yml` (node, python, php, go, java). Java: keep only the Maven or the Gradle steps and remove the `if` lines; prefer the wrapper (`mvnw`/`gradlew`) and add it if missing (ask first). Static checks (Checkstyle, PMD, SpotBugs, Error Prone) run inside `verify`/`check` once they are configured in the build file. The `dependency-submission` step lets the dependency review (item 28) see Gradle dependencies; Maven needs the GitHub dependency graph enabled in the repo settings. For other languages write the job from `references/languages.md` in the same shape: checkout, setup, install from lockfile, lint, type-check, test, build.
- `if: "{{…}}"` lines are template switches, not real conditions (GitHub treats any non-empty string as true). Always delete the line; when the switch is off, delete the whole step with it.
- `{{NODE_VERSION}}`: take it from `.nvmrc` / `.node-version` (then use `node-version-file` instead), `engines.node`, `volta.node`, or the major version developers run locally (`node --version`); for a new project with none of these, use the current Node LTS major (22) and write it to `.nvmrc` too. Never hard-code a version the project does not use.
- `{{USES_PNPM}}`: keep the `pnpm/action-setup` step and drop the `if` line when the project uses pnpm (it reads the version from `packageManager`); delete the step otherwise. setup-node's `cache: pnpm` fails without it.
- `{{AUDIT_COMMAND}}`: `pnpm audit --audit-level=high --prod`, `npm audit --audit-level=high --omit=dev`, `composer audit`, `pip-audit`, `govulncheck ./...`. If the audit is red on day one, show the findings and ask whether the job starts as required or as a warning (`continue-on-error: true`) until they are fixed.
- `dependency-review`: needs the GitHub dependency graph; on private repos it also needs GitHub Code Security. If that is not available, delete the job and keep `audit`; for item 30 use a license tool instead (`npx license-checker-rseidelsohn --onlyAllow "<list>"`, `pip-licenses --allow-only`, `composer licenses`).
- `{{GITLEAKS_VERSION}}`: the kit's pinned default is `v8.28.0`; write it and list "verify the gitleaks version" in Phase 4, where external calls are allowed (`gh api repos/gitleaks/gitleaks/releases/latest --jq .tag_name`).
- Builds that read env variables at build time (Next.js, Vite with a validated env module) need placeholder values in CI: add an `env:` block on the build step with obviously fake values (`https://example.invalid`, `ci-placeholder-not-a-secret`), never real keys.
- `{{IS_NODE}}` in `security.yml`: keep the Node setup steps only for JS projects; other ecosystems need their own setup step before the audit command.
- `pr-conventions.yml` `branch` job: keep it only if item 38 is installed.
- `ci.node.yml` precheck step: keep it only if item 15 installed `precheck.mjs`; it runs on pull requests only (it needs a base branch).
- `{{FRONTEND_PATH}}` at the repo root: use `.` for `directory` and drop the `paths:` filter (or list the real source folders); `./**` is not a valid filter.
- `{{BUILD_ENV_PLACEHOLDERS}}`: one entry per variable the build validates, with an obviously fake value; the size-limit action runs the build too, so it needs the same `env:` block. Remove the block when the build reads no env.
- `bundle-size.yml`: also write `ci/.size-limit.json` to the frontend folder as `.size-limit.json` and add the dev dependencies `size-limit` and `@size-limit/preset-app` (or `@size-limit/file` for static output). Current size-limit needs Node 22+; with an older Node pin `size-limit@11`.
- PR conventions skip bot PRs (Dependabot, Renovate); the branch check exempts `dependabot/*` and `renovate/*`.
- Replace every `{{…}}` with the project's real values. Drop steps whose item was declined (for example the dead-code step when item 24 is "no"; replace `if: "{{ITEM_24}}"` by removing the step or the `if`).
- Pin third-party actions to a full commit SHA with the version as a trailing note when the user agrees (safer against tag hijacking). The versions written here are the current major tags (an exact version where the action publishes no major tag, such as `astral-sh/setup-uv` and `actions/dependency-review-action`); item 48 resolves them to SHAs with `kit.mjs pin-actions`. Before writing a workflow, check that each major is still the latest (`git ls-remote --tags https://github.com/<owner>/<action>`) and read the release notes of any newer major before using it.
- Every workflow sets the minimum `permissions` it needs. Keep it that way.

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
