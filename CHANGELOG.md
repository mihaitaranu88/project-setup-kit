# Changelog

## 0.4.0

Five new items in a new group, **I. Supply chain and agent environments** (51 items in total):

- **47 · New-dependency check.** AI agents sometimes invent package names, and attackers register them ("slopsquatting"). A `deps-guard` hook looks at install commands (`npm install <pkg>`, `pnpm add`, `pip install`, `uv add`, `poetry add`, `composer require`, `cargo add`, `go get`) and asks before installing a package that the registry does not know, that was published in the last 14 days, or that has very few downloads. A CI job (`new-deps.mjs`) does the same for every dependency added to `package.json`, `pyproject.toml`, `requirements*.txt`, `composer.json`, `Cargo.toml`, `go.mod` or `pom.xml`. It checks npm, PyPI, Packagist, crates.io, the Go module proxy and Maven Central, has an allow list for private packages, and never blocks when the registry cannot be reached.
- **48 · GitHub Actions hardening.** `kit.mjs pin-actions` pins every action to its commit SHA (resolved with `git ls-remote`, the tag kept as a note); a `workflow-security.yml` workflow runs actionlint and zizmor; Dependabot keeps the pins up to date.
- **49 · Ready environment for cloud agents.** One `.ai-kit/agent-setup.sh` installs the project from the lockfiles, and each tool calls it: `copilot-setup-steps.yml` for the Copilot coding agent, `.cursor/environment.json` for Cursor background agents, a `SessionStart` hook guarded by `CLAUDE_CODE_REMOTE` for Claude Code on the web, the setup-script setting for Codex, and an optional dev container.
- **50 · One verify command.** `verify.mjs` runs the project's lint, type-check, test and build steps from `.ai-kit/config.json`, reports every failure, and is what the agent rule, the stop hook and (optionally) CI call, so they cannot drift apart.
- **51 · Container and infrastructure scanning.** hadolint for Dockerfiles and `trivy config` for Docker, compose, Kubernetes, Helm and Terraform, only when the repository has them.

Improved items:

- 35: MCP servers are pinned to exact versions instead of `@latest`, database servers stay read-only, and `AGENTS.md` gets a rule that text from issues, logs, web pages and tool results is data, not instructions.
- 43: optional lock-safety lint for migrations (squawk for Postgres, strong_migrations for Rails, django-migration-linter).
- 46: optional smoke test on the preview with the project's existing Playwright or Cypress tests.
- `AGENTS.md` template: a "Verify before saying done" command first, and placement rules instead of a folder tour.

Workflow templates:

- Every template is now rendered and checked with actionlint and zizmor in the kit's CI. This found and fixed five script-injection patterns (`${{ github.base_ref }}` inside `run:`, now passed through `env:`), checkouts that kept the git token on disk (`persist-credentials: false`), and a preview workflow with write permission on every job.
- The kit's own workflows are pinned to SHAs, scanned the same way, and updated by Dependabot.

Detection: TypeScript is recognized from a `typescript` dependency, `.ts` files or `<script lang="ts">`, not only from `tsconfig.json`.

## 0.3.0

- `AGENTS.md` keeps only what an agent cannot learn from the code: the questionnaire now skips answers that restate the stack, the folder layout or commands already in the manifest, and rules a check already explains. Research on context files (ETH Zurich, 2026) found that restating the codebase does not help agents and sometimes hurts.
- More AI tools: `npx … install-skill` copies the guided setup into `.agents/skills/setup-kit/`, the shared Agent Skills folder, and supports `--tool codex|gemini|opencode` besides Copilot and Cursor. Running it again updates the copy; a copy from 0.2.0 in `.ai-kit/setup-kit/` is moved and its prompt repointed.
- Update notice: with the Claude Code plugin, a session that starts in a project set up with an older kit, or with files waiting in `.ai-kit/pending/`, shows one line saying so. Turn it off with `"settings": { "sessionNotice": false }`.
- Rules generators: when Ruler or rulesync is used, the kit writes its rules into their source files instead of the generated `AGENTS.md`/`CLAUDE.md`, which the next generator run would overwrite.
- Clearer catalog rules, found by the new evaluation: lockfile drift (item 19) applies to package managers with a local install folder even before the lockfile is committed and never to Go, Maven, Gradle, Cargo or .NET; env validation (item 20) applies to every backend and to a frontend only when its code reads env variables; one frontend plus one API is not "several services".
- Guards: a corpus test of 67 real commands (blocked and allowed) for the git, danger and env guards. It fixed two wrong results: `grep "DROP TABLE" migrations/` no longer asks for approval, and `sudo rm -r` on a system path now does. Quoted git commands (`grep "git push"`) stay blocked on purpose: a missed push costs more than a false alarm.
- The docs consistency check ignores files git ignores, such as the kit's own copy in `.agents/skills/`.
- Evaluation moved to `claude plugin eval`: 11 cases generated from the fixtures (`npm run build-evals`), each run 3 times with and without the plugin. Besides the analysis of the 7 fixture projects it checks behavior: the first turn asks one thing with a recommendation, a plain request asks before writing, `status` changes nothing, `remove` asks before deleting. Baseline: 11/11 cases pass, score 0.98 with the plugin, mean gain +0.22 over no plugin. `npm run check` fails when the cases are out of date.
- One-step install line for Claude Code 2.1.275+: `/plugin install project-setup-kit --marketplace mihaitaranu88/project-setup-kit`.

## 0.2.0

- Profiles: `/setup-kit minimal|team|strict` answers most of the 46 items in advance; the plan is shown once for changes, paid or account-bound items are still asked, and every item keeps its file review.
- Copilot and Cursor: `npx github:mihaitaranu88/project-setup-kit install-skill --tool copilot|cursor` copies the guided setup into `.ai-kit/setup-kit/` with a `/setup-kit` prompt for the tool; `… guards --tool claude|copilot|cursor` installs only the agent guards, merging existing hook settings.
- Windows: file paths in hook and ratchet commands are quoted for the platform; the worktree helper is now a Node script (`worktree.mjs new|remove`); danger-guard also recognizes broad `Remove-Item -Recurse`, `rd /s` and `rmdir /s` deletes.
- Skill evaluation: `npm run eval` and a manual/tag-triggered GitHub workflow run the skill's analysis on every fixture with Claude Code and compare it with `expected.json`.
- Plugin icon.
- CI runs on Linux, Windows and macOS with Node 20 and 22; it found and fixed two Windows bugs (file quoting in the lint ratchet, backslashes in the Copilot/Cursor prompt).
- Skill evaluation baseline: all 7 fixture projects (TypeScript, Python, PHP, Go, Java, a monorepo and an empty folder) match their expected analysis.
- Contributing guide, CI badge, repository topics.

## 0.1.0 — first public release

- `/setup-kit` skill: analyzes the repository, asks a few context questions, then goes through 46 items in 8 groups one at a time, each with a recommendation and a reason. Nothing is written without consent; every change is listed for review before the next item. Repository settings (branch protection, required checks, secrets) are collected into one final step.
- Modes: `update` (offers changed templates with diffs, never overwrites files you changed), `status`, `doctor` (checks that installed items still work), `remove <id>`.
- New projects: in a folder without code, offers to create the skeleton with the framework's official generator, or to set up only what does not need code and finish the rest on the next run.
- `AGENTS.md` built from the code plus a rule questionnaire (quick mode of about 30 questions, or full). The kit writes only inside its own markers and never touches blocks managed by other tools; unverified facts become `TODO:` lines.
- Agent guards for Claude Code, GitHub Copilot and Cursor (experimental): git commands, destructive commands (broad recursive deletes, history loss, `--no-verify`, database drops, infrastructure deletes, `curl | sh`, optional dependency installs), `.env` reads and staging, and edits to the agent's own guards, hook settings, CI and lockfiles. Lint and related tests after every edit, and a check before the agent stops.
- Language-agnostic checks with no dependencies: precheck on the diff, lint ratchet on changed lines, warning budget, instruction size budget, agent-docs consistency, branch names, commit messages, lockfile drift, remote database guard, migration checks (including Flyway and Liquibase).
- GitHub workflow templates: CI per language (Node, Python, PHP, Go, Java), AI review with a security pass, Sonar or coverage and duplication checks, security (gitleaks, audit, dependency review, licenses), PR conventions, PR size, bundle size, migrations, releases and frontend previews.
- `scripts/kit.mjs` keeps `.ai-kit.json` correct (installs templates with hashes, item states, settings, config sections, pending files for non-interactive runs, guard tests).
- Troubleshooting guide: on any error the agent stops, shows it, explains the likely cause and offers options; checks are never weakened to get past an error.
- Tested end to end on a Next.js + Convex + pnpm project and an empty folder; about 200 tests for the scripts.
