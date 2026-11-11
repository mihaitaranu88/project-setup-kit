# Item catalog

Fields:
- **applies-when**: if false, the item is not asked.
- **depends-on**: ask those items first; their answers change this one.
- **detect**: signals that the item is already configured (see also `detection.md`).
- **recommend**: default recommendation and the reason to give.
- **sub-questions**: asked only after a yes.
- **writes**: templates (relative to `templates/`) and target paths. `.ai-kit/` is the folder in the project that holds the kit's scripts and config.
- **rule**: what gets appended to `AGENTS.md`.
- **ci**: the CI counterpart, if the item has a local part.
- **guide**: file in `guides/` to walk through.

Workflow placeholders (`{{NODE_VERSION}}`, `{{USES_PNPM}}`, `if: "{{…}}"` switches, build env placeholders, gitleaks version) are explained in `templates/ci/github/README.md`; read it before writing any workflow for any item.

The kit's scripts read one config file: `.ai-kit/config.json` (template `checks/config.json` holds every section's defaults). Never copy the whole template: each item adds only its own sections with `kit.mjs config add <section>...` and adjusts values with `kit.mjs config set <section> '<json>'`.

Layout in the project: `.ai-kit/config.json`, `.ai-kit/hooks/` (always with `hook-io.mjs`), `.ai-kit/scripts/` (always with `lib.mjs`). The first item that installs a hook or a script also copies its shared file. Scripts need Node 20+ and no dependencies. Add `.ai-kit/**` to the project's linter ignores in the same step (vendored tooling, not project code).

Copy templates with the kit's installer instead of retyping them: `node <skill-dir>/scripts/kit.mjs install <template> <dest> --item <id>` (it refuses to overwrite, so merge existing files by hand), then `node <skill-dir>/scripts/kit.mjs record <path>... --item <id> [--merged]` for files you wrote or merged. Both keep `.ai-kit.json` `files` up to date with hashes. `<skill-dir>` is this skill's folder; ask the user once to allow `node <skill-dir>/scripts/kit.mjs` so it does not prompt every time.

Files the AI tool itself protects (Claude Code asks before writing `.claude/**`, `.mcp.json`, git hooks and similar): the user approves each prompt. If a write is refused (headless runs, a "no"), follow `troubleshooting.md`, "Protected paths".

---

## A. Agent foundation

### 1 · AGENTS.md + tool entry files + questionnaire
- applies-when: always
- detect: `AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md`, `.cursor/rules/`, `.cursorrules`
- recommend: yes — one source of rules every AI tool reads.
- writes: `agents/AGENTS.md.tmpl` → `AGENTS.md`; `agents/CLAUDE.md` → `CLAUDE.md` (Claude); `agents/copilot-instructions.md` → `.github/copilot-instructions.md` (Copilot); `agents/cursor-agents.mdc` → `.cursor/rules/agents.mdc` (Cursor)
- notes: when `AGENTS.md` already exists, add only the `ai-kit` blocks (at the end); do not add the template's title or the "Team notes" footer — those are for a new file.
- notes: blocks managed by other tools (marker pairs such as `<!-- convex-ai-start -->…<!-- convex-ai-end -->` or `<!-- BEGIN:nextjs-agent-rules -->…`) belong to those tools: never move, merge or delete them, even when the same block is in both `AGENTS.md` and `CLAUDE.md`; only make sure `CLAUDE.md` contains `@AGENTS.md`.
- notes: the kit owns only the blocks between `<!-- ai-kit:begin <section> -->` and `<!-- ai-kit:end <section> -->`; everything outside is the team's and is never rewritten. If an `AGENTS.md` without markers exists, keep it and append the kit's blocks at the end. If both `AGENTS.md` and `CLAUDE.md` exist with different content, propose merging into `AGENTS.md` and making `CLAUDE.md` import it; do it only on consent. Run `questionnaire.md` (flow.md, "Item 1").

### 2 · Automatic check for every rule that can be checked
- applies-when: always
- depends-on: 1
- recommend: yes — a rule only in text is a suggestion; a check is a rule.
- writes: depends on the answers; uses `lint/*`, `checks/*`, `guards/*`, `ci/github/ci.yml`
- notes: for each questionnaire answer with an `Enforce:` mechanism available for this language, propose the concrete check (rule name + where it runs). Ask once for the whole list. Item 2 decides *which* rules; the files that carry them are installed by their own items: lint rules by item 15, precheck rules (`precheck.lineChecks` / `diffChecks` in `.ai-kit/config.json`) by item 15, guards by items 9–10, CI by item 21. Rules without a mechanism stay text-only; say so.

### 3 · Size budget for always-loaded instructions
- applies-when: always
- depends-on: 1
- detect: an existing token or size budget for instruction files
- recommend: yes, as a warning — everything in `AGENTS.md` is paid on every session and long files are followed worse.
- sub-questions: budget (default 6000 estimated tokens, range 5000–8000); which files count (default: `AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md`, always-on Cursor rules)
- writes: `checks/prefix-budget.mjs` → `.ai-kit/scripts/prefix-budget.mjs`; budget in `.ai-kit/config.json` under `prefixBudget`
- ci: `ci/github/agent-files.yml` (keep only the steps of installed items: the size step for 3, the consistency step for 4)
- rule: "Keep always-loaded instructions under the budget in `.ai-kit/config.json`; move detail into skills or linked files."

### 4 · Consistency check for agent docs
- applies-when: the project has agent roles, commands or skills (items 32–34) or plans to
- depends-on: 1
- recommend: yes — facts copied in two places drift; only the copy under review gets fixed.
- writes: `checks/agent-docs-consistency.mjs` → `.ai-kit/scripts/agent-docs-consistency.mjs`
- ci: `ci/github/agent-files.yml`
- notes: checks that every role/command/skill file is mentioned in `AGENTS.md`, every one mentioned exists, and every relative link in agent files resolves. In the same step, write the `agent-files` roster block in `AGENTS.md` for everything that already exists — including skills installed by vendors (e.g. `npx convex ai-files install`, `.agents/skills/`) — so the check passes on day one.

### 5 · Docs updated in the same PR
- applies-when: always
- recommend: yes — stale docs make the agent wrong in the next session.
- writes: rule only; adds a checklist line to the PR template (item 40) and a review point to item 22 if installed
- rule: "When you add or change a command, environment variable, config or project rule, update `README`, `AGENTS.md` and `<env example file>` in the same change." Use the project's real example file name (e.g. `.env.local.example`) here, in the PR template and in the commands.

### 6 · Team memory in git (+ architecture decisions)
- applies-when: always (recommended for teams)
- detect: `docs/adr/`, `docs/decisions/`, `docs/ai-memory/`, `.github/memory/`
- recommend: yes for teams, optional solo — agents start from the same facts; decisions keep their reasons.
- writes: `memory/README.md` → `docs/ai-memory/README.md`; `memory/_decision.md`, `memory/_lesson.md` → same folder; empty `decisions/`, `lessons/`, `debt/`, `incidents/` folders with a `.gitkeep`
- rule: "Before large changes, read `docs/ai-memory/`. Propose a new entry (decision, lesson, debt, incident) when you learn something durable; never write one without approval. Every entry names its source."
- notes: the questionnaire's general best-practice answers (category "Project facts") are written here; the checkable ones also go to item 2.

### 7 · Plan before code for large tasks
- applies-when: always
- recommend: yes — correcting a plan is cheaper than correcting 500 lines.
- sub-questions: what counts as large (default: more than 5 files, a new module, a schema change, or a public API change); where plans live (default `docs/plans/`, or chat only). If plans go to a folder, create it with a `.gitkeep` in the same step so links to it resolve.
- rule: "For large tasks (<threshold>), first write a short plan — what changes, which files, how it is tested — and wait for approval."

### 8 · Bug fix starts with a failing test
- applies-when: the project has tests or will have them
- recommend: yes — proves the fix works and that the bug stays fixed.
- rule: "For every bug: first write a test that fails because of the bug, then fix it. Frontend: a component test if the project has a component test runner; if it does not, propose adding one or verify in a browser and say so. Purely visual bugs (CSS, layout): verify in a browser and state explicitly that no test was written."

## B. Agent safety

### 9 · Guards for git, destructive commands and the agent's own config
- applies-when: always
- depends-on: 1 (questionnaire answer "may the agent commit / push / merge / rewrite history?")
- detect: existing PreToolUse/preToolUse hooks that deny git or destructive commands; `permissions.deny` entries; tools such as destructive_command_guard, cc-safe-setup, agent-guard
- recommend: yes — a text rule can be ignored, a hook cannot; and an agent that can edit its own hooks can switch them off.
- sub-questions: (a) git commands to block (from the questionnaire); (b) destructive packs to guard (default all: filesystem, git history, hook bypass such as `--no-verify`/`HUSKY=0`, database drops/resets, infrastructure deletes, piping downloads into a shell); (c) protect the agent's own guard config, CI workflows, git hooks and lockfiles (default yes); (d) on a hit: ask the developer (default) or deny outright (for unattended runs)
- writes: `guards/hook-io.mjs`, `guards/git-guard.mjs`, `guards/danger-guard.mjs`, `guards/protect-guard.mjs` → `.ai-kit/hooks/`; hook wiring per tool from `tool-config/<tool>/`; `gitGuard`, `dangerGuard`, `protectFiles` in `.ai-kit/config.json`
- notes: the `installs` pack (agent adds or installs dependencies) is off by default; turn it on when the questionnaire says the agent may not install dependencies. The filesystem pack only catches recursive deletes of broad targets (`/`, `~`, `.`, `..`, `*`); deleting a named folder such as `rm -rf dist` or `rm -rf src` is allowed on purpose, because agents clean build output all the time — say so when the user asks how strict it is, and add `extraPatterns` for folders that must never be deleted. git-guard denies; danger-guard and protect-guard ask by default. Patterns inside quotes are ignored for shell packs (`grep "rm -rf"` is fine) except when the command runs an inline script (`bash -c`, `python -c`), and the database pack always scans quoted SQL. Projects that need deeper coverage can add an external guard (e.g. destructive_command_guard) instead of danger-guard; say so if the user asks for more. Once protect-guard is installed, later `/setup-kit update` runs will trigger approval prompts for the kit's own files — tell the user this is expected.

### 10 · Env-file guard for agents
- applies-when: always
- detect: hook that denies `.env` access; `permissions.deny` with `Read(.env*)`
- recommend: yes — secrets never reach the model, and never get staged by a broad `git add`.
- sub-questions: which env files are safe templates (default `.env.example`, `.env.sample`, `.env.template`)
- notes: also denies `git add .` / `-A` / `--all` / `commit -a` while an env file in the repo root is not git-ignored. If such a file exists during setup, propose adding it to `.gitignore`.
- notes: build the allowlist from the repo, not only the defaults: add every env file that is committed (`git ls-files '.env*' '**/.env*'`) and whose name contains `example`, `sample`, `template` or `dist` (e.g. `.env.local.example`). If an example file exists but is git-ignored by a broad `.env*` rule, say so and propose a `!.env*.example` exception in `.gitignore`.
- writes: `guards/env-guard.mjs`, `guards/env-guard-allowlist.txt` → `.ai-kit/hooks/`; hook wiring per tool

### 11 · Allowlist of safe commands
- applies-when: the tool supports permission lists (Claude Code: yes)
- depends-on: 9, 10
- recommend: yes — fewer permission prompts for commands that cannot hurt.
- writes: `permissions.allow` in `.claude/settings.json` (from `tool-config/claude/settings.json`), built from the detected commands: test, lint, type-check, build, format check, `git status`, `git diff`, `git log`, `git show`
- notes: deny entries stay in items 9/10. Never allow install scripts, network tools, deploy commands or anything that writes outside the repo.

### 12 · CODEOWNERS for agent files
- applies-when: team
- detect: `.github/CODEOWNERS`, `CODEOWNERS`, `docs/CODEOWNERS`
- recommend: yes for teams — changes to agent rules and guards need an owner's review.
- sub-questions: owners (GitHub users or `org/team`; default: the user logged into `gh`)
- writes: `github/CODEOWNERS` → `.github/CODEOWNERS` (merge if present)
- settings: "Require review from Code Owners" (Phase 4)
- guide: `github-settings.md`

## C. Local code quality

### 13 · Pre-commit checks on staged files
- applies-when: always
- detect: husky, lefthook, pre-commit framework, lint-staged, `core.hooksPath`
- recommend: yes — catches mistakes before they leave the machine; stays under ~10 s.
- writes: hook manager config: extend the existing one. If none, recommend lefthook (`git-hooks/lefthook.yml`, any language, one file for every hook the kit needs); offer the pre-commit framework for Python-first teams and husky + lint-staged only if the team already knows it. Whatever manager is chosen, items 19, 27, 38 and 39 add their commands to that same manager (`git-hooks/README.md` has the husky and pre-commit equivalents of every lefthook entry).
- notes: only staged files; lint + format + fast type-check of staged files where the tool supports it. Full type-check goes to CI (item 21).
- ci: item 21

### 14 · Strict type checking
- applies-when: the language has a type checker (TS, Python, PHP, Go is already strict, Java/C# compiler warnings)
- recommend: yes — the cheapest safety net for AI-written code. New project: strict now. Existing project with new type errors: enable strict for new folders only, or let item 16 hold the errors to changed lines once it is installed.
- writes: `tsconfig` `strict: true`; mypy/pyright strict; PHPStan level; see `languages.md`

### 15 · Anti "AI slop" lint rules
- applies-when: always
- recommend: yes — catches the escape hatches agents reach for.
- writes: `lint/eslint-ai-slop.config.mjs`, `lint/ruff-ai-slop.toml`, `lint/golangci-ai-slop.yml`, `lint/phpstan-ai-slop.neon` (merge into the existing config); optional `lint/eslint-rules/no-barrel-exports.mjs`; `checks/precheck.mjs` → `.ai-kit/scripts/` for the rules no linter covers (comments when the team bans them, focused/skipped tests, debug statements, TODO without ticket, new source without test, tooling change without docs)
- notes: double type assertions through `unknown`/`any`, lint-disable without a reason, blanket type-ignore, direct wall-clock reads, string-built SQL / unescaped LIKE, debug prints, pure barrel files, hard-coded UI text (if i18n). Pick only the ones matching the questionnaire answers.

### 16 · Lint ratchet + warning budget
- applies-when: existing project (Phase 2), even if lint is clean today: items 2, 15 and 17 add rules that create warnings on old code
- depends-on: 2, 15
- detect: `--max-warnings`, baseline files (`phpstan-baseline.neon`, `.ruff-baseline`, `.eslint-baseline`), betterer
- recommend: yes for existing projects — strict on new lines, no red wall on old debt.
- writes: `checks/lint-ratchet.mjs`, `checks/warning-budget.mjs` → `.ai-kit/scripts/`; `ratchet` and `warningBudget` in `.ai-kit/config.json`
- ci: `ci/github/lint-ratchet.yml`
- notes: put in the ratchet the rules the project keeps at `warn` because of old code (typically the ones items 15 and 17 added as warnings); rules already at `error` do not need it. Rules that report on a function's first line (`complexity`, `max-lines-per-function`) only catch new functions. The ratchet runs any linter that prints `path:line:` and keeps only findings on changed lines: against the base branch in CI, `--staged` in pre-commit, `--working` in the stop check (item 36). The warning budget is a number that may only go down. ESLint 9 needs the `eslint-formatter-unix` dev dependency for `--format unix`.

### 17 · Accessibility lint (frontend)
- applies-when: frontend with UI components
- notes: if a framework config already registers the plugin (`eslint-config-next` registers `jsx-a11y`), enable the extra rules by name instead of importing the plugin again; with pnpm's strict layout the plugin is not importable from the project. Get the exact list from the installed plugin instead of typing it: `node <skill-dir>/scripts/kit.mjs plugin-rules eslint-plugin-jsx-a11y --via eslint-config-next`.
- recommend: yes — free at runtime, catches missing labels and alt texts.
- writes: lint plugin per framework (`languages.md`, "Accessibility")

### 18 · `.editorconfig` + `.gitattributes`
- applies-when: always
- detect: `.editorconfig`, `.gitattributes` with `eol`
- recommend: yes — no diffs caused by tabs or Windows/Mac line endings.
- writes: `repo/.editorconfig`, `repo/.gitattributes` (adapt indent to the detected style)

### 19 · Lockfile drift warning on push
- applies-when: the project has a lockfile
- recommend: yes, as a warning — tests with stale dependencies give false results.
- writes: `checks/lockfile-check.mjs` → `.ai-kit/scripts/`; pre-push hook entry (pnpm marker: `node_modules/.pnpm/lock.yaml`)
- notes: warning only, never blocks.

### 20 · Environment variables validated at startup
- applies-when: an application (not a library) that reads environment variables
- detect: zod/envalid/t3-env schema, pydantic-settings, Laravel config validation, viper with required keys
- recommend: yes — fails at startup with a clear message, not at the first request in production.
- writes: guidance + code in the project's language from `env-validation/README.md`; keep `.env.example` in sync
- rule: "Every new environment variable is added to the env schema and to `<env example file>`."
- notes: validate at production build/start, not in development, when the app already handles missing variables in dev on purpose (e.g. a setup screen); keep whatever comments the project's example file uses — the no-comments rule applies to code, not to env example files.

## D. CI on pull requests

### 21 · Base CI on PRs as a required check
- applies-when: GitHub (other platforms: guide)
- detect: workflows that run lint/test/build on `pull_request`
- recommend: yes — the only check nobody can skip.
- writes: assemble `.github/workflows/ci.yml` by hand from the `ci/github/ci.yml` shell plus one job per part (do not `kit.mjs install` the shell alone; write the finished file, then `kit.mjs record` it) from `ci/github/ci.node.yml`, `ci/github/ci.python.yml`, `ci/github/ci.php.yml`, `ci/github/ci.go.yml` or `ci/github/ci.java.yml`, adapted to language and package manager
- settings: mark the job as required (Phase 4)

### 22 · AI review on PRs (+ security pass)
- applies-when: GitHub
- detect: claude-code-action, CodeRabbit config, Copilot review workflow
- recommend: yes if the team has a paid AI plan or API budget — one sticky comment, re-run on push with debounce.
- sub-questions: which provider (Claude via API key, Claude via subscription token, Copilot, CodeRabbit); extra security pass only on sensitive paths (default yes; paths default: auth, permissions, SQL/repositories, uploads, crypto, secrets)
- writes: `ci/github/ai-review.yml` → `.github/workflows/ai-review.yml`
- guide: `ai-review.md`
- settings: secret (Phase 4)

### 23 · SonarQube / SonarCloud (quality, coverage, duplication)
- applies-when: GitHub or another supported CI
- detect: `sonar-project.properties`, sonar steps in CI
- recommend: yes for commercial/team projects; SonarCloud is free for public repos.
- sub-questions if yes: SonarCloud or self-hosted; coverage threshold on new code (default 80%)
- sub-questions if no: (a) coverage threshold on new code in CI (default 80%)? (b) duplicate-code detection with jscpd as a warning on new code?
- writes: `ci/github/sonar.yml`, `ci/sonar-project.properties`; or `ci/github/coverage.yml` and `ci/github/duplication.yml`
- guide: `sonar.md`
- settings: `SONAR_TOKEN` secret, quality gate as required check (Phase 4)

### 24 · Dead-code detection
- applies-when: a tool exists for the language (`languages.md`)
- recommend: yes, as a warning — agents leave old code behind after refactors.
- writes: a job step in `ci.yml` (warning, `continue-on-error: true`); for knip also `ci/knip.json` → `knip.json` with the framework entry points, `.ai-kit/**` ignored and the kit's own dev dependencies in `ignoreDependencies`
- notes: run knip once locally and add to `ignoreDependencies` only what it wrongly reports (tools used only from config or CSS: e.g. Tailwind 4 imported with `@import "tailwindcss"`, size-limit presets). If it says a package is unlisted (e.g. `postcss` used by a config), propose adding it to devDependencies instead of ignoring it.

### 25 · Large-PR warning
- applies-when: GitHub
- recommend: yes — large PRs get shallow reviews.
- sub-questions: limit (default 400 changed lines, excluding lockfiles, generated files and snapshots)
- writes: `ci/github/pr-size.yml`

### 26 · Frontend bundle-size check
- applies-when: frontend that ships JS to the browser
- recommend: yes, as a warning — agents add heavy libraries easily.
- writes: `ci/github/bundle-size.yml` + `ci/.size-limit.json` → `<frontend>/.size-limit.json`
- notes: measure the limit from a local build when it runs; otherwise write a provisional limit, mark it `TODO: set from the first CI run`, and expect the first PR's comparison to fail because the base branch has no size-limit config yet (the job is a warning, so it does not block).

## E. Security and dependencies

### 27 · Secret scanning (gitleaks) on commit and in CI
- applies-when: always
- detect: gitleaks/trufflehog config, GitHub push protection
- recommend: yes — a leaked key costs more than any setup.
- writes: pre-commit entry; `ci/github/security.yml` (job `secrets`)
- settings: enable GitHub secret scanning + push protection where available (Phase 4)

### 28 · Vulnerable dependency check on PRs
- applies-when: GitHub
- recommend: yes — stops vulnerable dependencies added in this PR; item 29 only fixes old ones.
- writes: `ci/github/security.yml`: job `audit` (the ecosystem's audit command, works everywhere) and job `dependency-review` (needs the GitHub dependency graph; private repos also need GitHub Code Security). Default: public repo → keep both; private repo → keep only `audit` and offer dependency review in Phase 4 once `gh` can check the plan.

### 29 · Automatic dependency updates
- applies-when: GitHub
- detect: `.github/dependabot.yml`, `renovate.json`, `.github/renovate.json`
- recommend: yes, Dependabot — free; group minor updates weekly, security updates immediately.
- sub-questions: Dependabot or Renovate
- writes: `github/dependabot.yml` or `github/renovate.json`

### 30 · License check on dependencies
- applies-when: always asked; recommendation depends on the answer
- recommend: yes for commercial/client closed-source projects, no for personal ones.
- sub-questions: allowed licenses (default for closed source: MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, 0BSD, Unlicense, CC0-1.0, Zlib, Python-2.0, MPL-2.0 if the team accepts file-level copyleft); everything else (GPL, AGPL, SSPL, unknown) fails
- writes: `allow-licenses` in the `dependency-review` job of `ci/github/security.yml` (an allow list is safer than a deny list: unknown licenses fail too); without dependency review, a license tool job (`ci/github/README.md`)

## F. Agent tooling

### 31 · Task app + connection
- applies-when: always
- detect: `.mcp.json` entries for Jira/Linear/GitHub; branch names with task keys in `git log`
- recommend: connect it if the team uses one — commands can read the task directly.
- sub-questions: which app (Jira, Linear, GitHub Issues, Trello, none; default none when nobody knows); task key prefix (e.g. `PROJ`)
- notes: with no task app, items 38 and 39 and the TODO rule drop the task key: branch pattern `^(feat|fix|chore|docs|refactor|test)/[a-z0-9]+(-[a-z0-9]+)*$`, commit scope optional, and TODOs need an issue link or are not allowed (ask which)
- writes: entry in `.mcp.json` (item 35)
- guide: `task-apps.md`

### 32 · Slash commands (`/bugfix`, `/feature`, `/ship`, `/address-review-findings`)
- applies-when: always
- depends-on: 31
- recommend: yes — the same work done the same way every time.
- writes: `commands/*.md` → `.claude/commands/` (Claude), `.github/prompts/*.prompt.md` (Copilot), `.cursor/commands/` (Cursor)
- notes: with a task app the commands take a task key; without, a text description. Fill in the project's real test/lint/build commands and base branch.

### 33 · Agent roles
- applies-when: always
- recommend: yes — architect, bug-fixer, feature-dev, QA and reviewer with focused instructions.
- writes: `roles/*.md` → `.claude/agents/` (Claude), `.github/agents/*.agent.md` (Copilot). Resolve every `{{IF_ITEM_n: …}}` block: keep its text only if item n is installed (e.g. drop the `docs/ai-memory/` steps when item 6 was declined).
- notes: before installing, search the user's installed plugins/skills and public skill marketplaces for skills matching each role and the project's language; propose them, install only on consent.

### 34 · Domain skills
- applies-when: always
- recommend: propose only what fits the detected project
- notes: propose a list such as: migrations (if DB), unit-test patterns, cross-service debugging (only if several services), CI/CD, OpenAPI (if API), messaging (if a broker is used), onboarding. Each accepted skill is written from `skills/SKILL.md.tmpl` → `.claude/skills/<name>/SKILL.md` with real paths and commands from this repo.

### 35 · Shared `.mcp.json`
- applies-when: the team uses an MCP-capable tool
- detect: `.mcp.json`, `.vscode/mcp.json`, `.cursor/mcp.json`
- recommend: yes — same tools for everyone; secrets stay in environment variables.
- writes: `repo/.mcp.json` (merge). The template has two ready entries: library docs (`@upstash/context7-mcp`) and browser (`@playwright/mcp`, only if FE). Add others only from the vendor's own docs or `<tool> --help` output, never from memory: read-only local DB (if DB), task app (item 31), backend-as-a-service (e.g. `npx convex mcp start --help`).
- notes: backend-as-a-service MCP servers (Convex, Supabase, Firebase) can usually write data, run functions and read deployment environment variables — which hands server secrets to the model. Disable their env tools (e.g. Convex `envGet`/`envList`) in the server's tool filter. Offer them only pointed at a development deployment, never production, and say that the shell guards (item 9) do not see MCP calls, so Claude Code's own MCP permission prompts are the only check.

### 36 · Post-edit hook + check before the agent stops
- applies-when: Claude Code (PostToolUse, Stop) or another tool with post-edit hooks
- recommend: yes — the agent fixes its own errors before saying it is done.
- sub-questions: also run a check when the agent tries to finish (default yes: the per-file rules on every changed file, `precheck.mjs --working`, plus optional project commands such as the type-check); timeout (default 300 s)
- writes: `guards/post-edit-check.mjs`, `guards/stop-check.mjs` → `.ai-kit/hooks/`; `postEdit` and `stopCheck` in `.ai-kit/config.json`; hook wiring
- notes: post-edit runs only the edited file and its related tests (e.g. `jest --findRelatedTests`, `vitest related`, `pytest <matching test file>`, `go test ./<pkg>`); errors go back to the agent. The stop check runs on uncommitted changes, blocks the stop once with the failures (exit 2), and lets the agent stop on the next attempt (`stop_hook_active`), so it never loops.

### 37 · Git worktree per task
- applies-when: always asked
- recommend: only if the user often runs several agents at once.
- writes: `worktree/new-worktree.sh` → `.ai-kit/scripts/new-worktree.sh`
- notes: copies `.env*` that are git-ignored, installs dependencies, prints the path; `--remove` cleans up.

## G. Git and PR conventions

### 38 · Branch-name check on push
- applies-when: always asked
- detect: branch regex in existing hooks
- sub-questions: allowed prefixes (default feat, fix, chore, docs, refactor, test); task key (from item 31, or none); key when there is no task (default `<KEY>-0`); exempt branches (default main, master, develop, dev, release/*)
- writes: `checks/branch-name.mjs` → `.ai-kit/scripts/`; pattern in `.ai-kit/config.json`; pre-push entry
- ci: optional `branch` job in `ci/github/pr-conventions.yml` (uses the same script, so the pattern lives in one place)

### 39 · PR title + commit message format
- applies-when: always asked
- depends-on: 38
- sub-questions: style (Conventional Commits `type(KEY-1): subject`; plain sentence with no prefix; `KEY-1 subject`); reuse prefixes and key from 38
- writes: `checks/commit-msg.mjs` → `.ai-kit/scripts/` + commit-msg hook; `ci/github/pr-conventions.yml` (title job)

### 40 · PR template + required sections check
- applies-when: GitHub
- detect: `.github/pull_request_template.md`, `.github/PULL_REQUEST_TEMPLATE/`
- recommend: yes — a template alone is never enforced; the check is.
- writes: `github/pull_request_template.md`; `ci/github/pr-conventions.yml` (body job)

### 41 · Automatic releases
- applies-when: versioned deliverable (library, mobile app, shipped product)
- depends-on: 39 (needs Conventional Commits)
- recommend: release-please — a release PR you approve.
- writes: `ci/github/release.yml`, `release-please-config.json`, `.release-please-manifest.json`

## H. Project-specific (asked only when the project has it)

### 42 · Remote database guard
- applies-when: DB + migrations/seeds run from developer machines
- recommend: yes — nobody migrates the shared database by mistake.
- sub-questions: env variables holding the DB host (detected); local hosts (default localhost, 127.0.0.1, ::1, host.docker.internal, compose service names); override variable (default `ALLOW_REMOTE_DB=1`)
- writes: `checks/guard-remote-db.mjs` → `.ai-kit/scripts/`; wired before migrate/reset/seed commands (npm `pre*` scripts, Makefile, composer scripts, wrapper)

### 43 · Migration checks in CI
- applies-when: DB + migrations
- recommend: yes — every migration reversible and in order.
- writes: `checks/migration-check.mjs` → `.ai-kit/scripts/`; `migrations` in `.ai-kit/config.json`; `ci/github/migrations.yml`
- notes: checks new migration files only: down/rollback present (pattern per framework), timestamp order, registration in an order file only when the framework uses one. Adapt `timestampPattern` to the framework (Laravel `^(\d{4}_\d{2}_\d{2}_\d{6})`, Alembic/TypeORM/Knex `^(\d{8,17})`, golang-migrate sequential `^(\d+)`, Flyway `^V(\d+(?:[._]\d+)*)__`); versions are compared segment by segment, so Flyway `V1.10` is newer than `V1.9`. Alembic revisions without a timestamp prefix: drop the order check and rely on `alembic heads` having one head.
  - Flyway: `downRequired: false` (Flyway has no down by design; undo migrations are a paid feature), `ignorePattern: "^(R|U)[0-9]*__"` (repeatable and undo scripts have no order), `dirs: ["src/main/resources/db/migration"]`, `filePattern: "\\.(sql|java)$"`.
  - Liquibase: `filePattern: "\\.(xml|ya?ml|sql)$"`, `downPattern: "<rollback|rollback:|--rollback"`, `orderCheck: false` (Liquibase orders by the master changelog, not file names) and `orderFile` set to the master changelog so every new changelog must be included in it.
  - EF Core / Rails / Django generate reversible migrations; keep `downRequired` true only where the framework writes an explicit down method.

### 44 · Endpoint protection report
- applies-when: HTTP API, or backend-as-a-service functions callable from clients (Convex `query`/`mutation`/`action` vs `internal*`, Supabase RPC + row-level security, Firebase callable functions + security rules)
- recommend: yes for APIs with auth — shows at a glance what is unprotected.
- writes: a generator script in the project's language (decorator scan or the framework's route list, e.g. `php artisan route:list --json`, `rails routes`, Django `show_urls`) → `docs/endpoint-protection.md`; CI job that fails when the file is stale

### 45 · OpenAPI + FE↔BE contract check
- applies-when: HTTP API
- notes: analyze first — is there an OpenAPI spec? Would it help? It helps when FE and BE use different languages, the API is public, or docs are needed. If both are TypeScript in one repo, recommend shared types instead.
- writes (if yes): spec generation step, client type generation, CI job that fails when the spec or generated types are stale; optional pre-commit regeneration when DTO files change

### 46 · PR previews for frontend-only PRs
- applies-when: frontend
- recommend: yes if hosting is free or cheap — reviewers click a link instead of running the branch.
- sub-questions: hosting (Vercel, Netlify, Cloudflare Pages, own server/bucket)
- detect: Vercel/Netlify/Cloudflare Git integrations create previews on their own (`vercel.json`, `.vercel/`, `netlify.toml`, `wrangler.toml`, deploy docs); ask the user whether the integration is connected before adding a workflow
- writes: `ci/github/preview-fe.yml` (runs only when the PR touches only frontend paths; uses the shared dev backend)
- guide: `preview.md`
