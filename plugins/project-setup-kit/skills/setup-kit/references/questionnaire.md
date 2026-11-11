# Questionnaire (item 1)

Two modes. Ask the user which one:

- **Quick** (default for solo projects and first runs): only the questions marked ★ — about 30, enough for a useful `AGENTS.md` and the main checks.
- **Full**: every question that applies to the stack, one category at a time.

The user can switch to full for any single category.

Used to fill `AGENTS.md`. Go one category at a time. Show only the questions that apply to the detected stack (skip frontend questions without a frontend, DB questions without a DB, and so on). Pre-fill each question with the recommendation, or with what the code already shows (say "inferred from <file>"). The user changes only what differs.

Each line: `Q: question | Default recommendation: answer — why | Enforce: mechanism per language, or "AGENTS.md only"`.

Precedence when answers overlap: a ban on code comments does not cover tool directives — a lint/type disable with a specific rule and a reason (`// eslint-disable-next-line rule -- reason`) is a directive, not a comment, and is allowed where the lint-disable answer allows it. Rules that mention a task key apply only if item 31 found a task app.

Write each answer into `AGENTS.md` as a short imperative rule. Answers with an `Enforce:` mechanism available for this language go to item 2. Durable project facts (category 0, and any answer that records a decision rather than a style rule) also go to `docs/ai-memory/` if item 6 is installed.

## 0. Project facts
- ★ Q: Which folders or files are the canonical reference implementations the agent should copy? | Default recommendation: list 2–5 paths — agents copy the nearest example | Enforce: AGENTS.md only
- Q: Domain glossary: which terms does the project use and what do they mean? | Default recommendation: a short table — one name per concept | Enforce: AGENTS.md only (or `docs/ai-memory/glossary.md`)
- Q: Which environments exist (local, dev, staging, prod) and who deploys to each? | Default recommendation: list them — the agent must never target shared environments | Enforce: item 42 for DB
- Q: Known pitfalls or past incidents the agent should know about? | Default recommendation: list them with sources | Enforce: `docs/ai-memory/` (item 6)
- Q: Large repo: per-directory `AGENTS.md` files for area-specific rules? | Default recommendation: yes for large repos | Enforce: AGENTS.md only

## 1. Agent behavior & communication
- Q: May the agent write code only after an explicit "implement" instruction (otherwise discuss/analyse)? | Default recommendation: team choice; yes for teams that plan first — code written before scope is agreed gets reverted | Enforce: AGENTS.md only
- Q: Max length of chat replies? | Default recommendation: short; answer first, no intro, no closing summary or "anything else?" | Enforce: AGENTS.md only
- Q: Should output length match task size (one fact once, empty sections omitted)? | Default recommendation: yes | Enforce: AGENTS.md only
- Q: Should the agent offer unrequested extras (commit messages, recommendations, next steps)? | Default recommendation: no — only when asked | Enforce: AGENTS.md only
- Q: Format for replies to review comments? | Default recommendation: one plain sentence, no defensive evidence lists | Enforce: AGENTS.md only
- Q: Should copy-paste text (commit messages, ticket bodies) avoid hard line wraps? | Default recommendation: yes — one line per paragraph | Enforce: AGENTS.md only
- Q: Ticket descriptions in future tense, without line numbers or code identifiers? | Default recommendation: yes — a ticket says what should happen | Enforce: AGENTS.md only
- Q: User-story format? | Default recommendation: Summary / Description (+ why) / Acceptance Criteria, grounded in the real code | Enforce: AGENTS.md only (template file)
- Q: Must the agent search existing tickets/docs before creating new ones? | Default recommendation: yes | Enforce: AGENTS.md only
- Q: Should the agent check team memory before planning and only propose (never auto-write) new entries? | Default recommendation: yes | Enforce: AGENTS.md only
- Q: Delegate to parallel subagents only for 3+ independent substantial units? | Default recommendation: yes; otherwise run parallel tool calls | Enforce: AGENTS.md only
- Q: Retry limits in agent prompts stated as literal numbers ("max 3")? | Default recommendation: yes — vague limits get stretched | Enforce: AGENTS.md only
- Q: Should the agent use a session scratch directory instead of `/tmp` or the repo? | Default recommendation: yes | Enforce: AGENTS.md only (a `/tmp` hook would block everything when the repo itself lives under `/tmp`)
- Q: A kill-switch env var that stops all autonomous agent loops? | Default recommendation: yes, if autonomous loops exist | Enforce: check at every loop entry point
- ★ Q: May the agent install dependencies or tools on its own initiative? | Default recommendation: no — installs are the developer's decision | Enforce: item 9 `installs` pack in `dangerGuard.packs`

## 2. Git & branching
- ★ Q: May the agent run `git commit` / `push` / `merge` / `rebase` / `reset`? | Default recommendation: no; it hands over commands or messages, a human commits | Enforce: item 9 (git guard)
- Q: If pushing is allowed, only through a wrapper that refuses protected branches, force pushes and hook bypass? | Default recommendation: yes | Enforce: safe-push script + git guard allowing only that command
- Q: Protected branches the agent must never commit to? | Default recommendation: main, master, develop, release/* | Enforce: git guard + branch protection
- Q: New branches created with `--no-track` from the base branch? | Default recommendation: yes — otherwise a bare `git push` targets the base | Enforce: AGENTS.md only
- ★ Q: Branch naming pattern? | Default recommendation: `<type>/<KEY>-<n>-<kebab-description>` | Enforce: item 38
- Q: Ban `git stash` for looking at another ref (use worktrees)? | Default recommendation: yes | Enforce: git guard deny list
- Q: Revert unrelated lockfile churn before staging? | Default recommendation: yes, unless the task changes dependencies | Enforce: AGENTS.md + review
- Q: AI attribution trailers (Co-Authored-By) in commits and PRs? | Default recommendation: team choice — ask | Enforce: commit-msg hook (item 39) rejects the trailer if "no"
- Q: Stacked PRs: rebase children after the parent squash-merges, never merge; land bottom-up? | Default recommendation: yes | Enforce: AGENTS.md only

## 3. PR & review process
- ★ Q: PR title style? | Default recommendation: pick one: Conventional Commits, or a plain sentence; never a branch name | Enforce: item 39
- Q: Merge strategy? | Default recommendation: squash; the title becomes the commit | Enforce: repository settings
- Q: WIP shown as Draft PR, not labels? | Default recommendation: yes | Enforce: AGENTS.md only
- Q: Required approvals and code owners? | Default recommendation: 1–2, code owner on sensitive paths | Enforce: branch protection + item 12
- Q: Review severity scale? | Default recommendation: Critical (blocks: security, data loss, correctness, breaking API) / Important / Suggestion | Enforce: AGENTS.md + item 22 prompt
- Q: Review comment style: file:line, why it matters, concrete fix? | Default recommendation: yes | Enforce: AGENTS.md only
- Q: One concern per PR? | Default recommendation: yes | Enforce: item 25 (size warning)
- Q: Breaking contract changes and rollout order written in the PR body? | Default recommendation: yes | Enforce: PR template checkbox (item 40)
- Q: Deterministic precheck on the diff before AI or human review (secrets, focused tests, debugger, unjustified lint-disable, new source without test, tooling change without doc change)? | Default recommendation: yes | Enforce: CI job + pre-commit
- Q: Deterministic gates block; AI review is advisory only? | Default recommendation: yes | Enforce: CI design

## 4. Code style & naming
- ★ Q: Casing per element (types, functions, constants, files)? | Default recommendation: the language idiom (PEP 8, PSR-12, Go, .NET, Java) | Enforce: TS `@typescript-eslint/naming-convention`; Py ruff `N`; PHP PHPCS; Go revive; Java Checkstyle; C# `.editorconfig` naming rules
- ★ Q: Functions and methods start with a verb (`buildTotal`, not `total`)? | Default recommendation: yes | Enforce: TS naming-convention regex; others AGENTS.md
- Q: Ban filler words in new names (`data`, `info`, `util`, `helper`, `manager`, `Impl`)? | Default recommendation: yes, new identifiers only | Enforce: `precheck.mjs` (item 15) on added lines
- Q: Ban new abbreviations (`Svc`, `Mgr`, `Ctrl`) unless domain-standard? | Default recommendation: yes | Enforce: naming lint regex
- Q: One name per concept across the codebase? | Default recommendation: yes | Enforce: AGENTS.md (glossary)
- Q: File names carry a role suffix matching the class (`*.service`, `*.repository`)? | Default recommendation: yes if the framework is layered | Enforce: TS eslint-plugin-check-file; Java/C# ArchUnit/NetArchTest
- Q: One top-level type per file, named after it? | Default recommendation: yes | Enforce: TS `max-classes-per-file`; C# SA1402; PHP PSR-4
- Q: `I` prefix on interfaces? | Default recommendation: follow the language (C# yes; TS/Java/PHP no) | Enforce: naming lint
- Q: Ban grab-bag `utils`/`helpers` files? | Default recommendation: yes; narrowly named single-purpose files only | Enforce: CI file-name denylist
- Q: Helpers as class statics or exported module functions? | Default recommendation: pick one per repo | Enforce: AGENTS.md only
- Q: Prefer extending an existing file over creating a new one? | Default recommendation: yes | Enforce: AGENTS.md only
- Q: Import ordering and grouping? | Default recommendation: yes | Enforce: TS `import/order`; ruff `I`; goimports; PHPCS; `dotnet format`
- Q: Path aliases instead of deep `../../..` imports? | Default recommendation: yes | Enforce: TS `no-restricted-imports`
- ★ Q: Ban barrel/index re-export files? | Default recommendation: yes for TS/JS | Enforce: `lint/eslint-rules/no-barrel-exports.mjs`
- Q: Named exports only (no default export)? | Default recommendation: yes for TS/JS, except files the framework requires as default exports (Next.js `page`/`layout`/`route` files, Convex `schema.ts`, config files) | Enforce: `import/no-default-export` with those globs ignored
- Q: Strict equality only? | Default recommendation: yes (JS/PHP) | Enforce: `eqeqeq: smart`; PHPStan strict rules
- Q: Lookup tables instead of long if/switch chains? | Default recommendation: yes for 5+ branches | Enforce: sonarjs `max-switch-cases`

## 5. Complexity & structure
- Q: Cognitive complexity limit per function? | Default recommendation: 15 | Enforce: eslint-plugin-sonarjs; Go gocognit; PHPMD; Sonar
- Q: Cyclomatic complexity limit? | Default recommendation: 10 | Enforce: TS `complexity`; ruff `C901`; gocyclo; PMD; CA1502
- Q: Max nesting depth? | Default recommendation: 4, early returns | Enforce: TS `max-depth`; Go nestif; Checkstyle NestedIfDepth
- ★ Q: Max function length? | Default recommendation: 60 lines (aim for 30) | Enforce: TS `max-lines-per-function`; Go funlen; Checkstyle MethodLength
- Q: Max file length? | Default recommendation: 300 lines | Enforce: TS `max-lines`; pylint too-many-lines; Checkstyle FileLength
- Q: Max parameters? | Default recommendation: 4, else an options object | Enforce: TS `max-params`; ruff `PLR0913`; revive argument-limit
- Q: Limits as errors in new code, warnings in legacy? | Default recommendation: yes | Enforce: per-glob lint overrides or item 16
- Q: YAGNI: no speculative fields, params or endpoints without a consumer? | Default recommendation: yes | Enforce: item 24 (dead code)
- Q: No duplicated logic? | Default recommendation: yes | Enforce: item 23 (Sonar or jscpd)
- Q: Changes to shared utilities keep the default path identical; new behavior is opt-in? | Default recommendation: yes — a changed default breaks every caller silently | Enforce: AGENTS.md + review
- Q: Never mutate inputs in place? | Default recommendation: yes | Enforce: TS `no-param-reassign`
- Q: No module-level mutable state? | Default recommendation: yes | Enforce: Go gochecknoglobals; review
- Q: Ban `eval` / dynamic code execution? | Default recommendation: yes | Enforce: TS `no-eval`; ruff `S307`; PHPStan disallowed-calls
- Q: Release resources deterministically (finally, `using`, `defer`, context managers)? | Default recommendation: yes | Enforce: Go bodyclose; CA2000; ruff `SIM115`

## 6. Comments & docs
- ★ Q: Code comments allowed? | Default recommendation: team choice: none (self-documenting code) / only "why" / free | Enforce: precheck on added comment lines (skip shebangs, pragmas, license headers)
- Q: Docblocks (JSDoc, docstrings, PHPDoc)? | Default recommendation: only on public API, or never — ask | Enforce: ruff `D`, CS1591, or precheck
- ★ Q: Ban commented-out code and TODOs without a ticket? | Default recommendation: yes | Enforce: ruff `ERA001`; precheck regex `TODO(?!.*[A-Z]+-\d+)`
- ★ Q: Lint-disable only with a reason? | Default recommendation: yes | Enforce: `eslint-comments/require-description`; ruff `PGH004`; nolintlint
- Q: A PR that changes a rule, tool or CI step updates `AGENTS.md`/docs in the same PR? | Default recommendation: yes | Enforce: item 5 + `precheck.mjs` toolingWithoutDocs
- Q: Architecture decisions recorded? | Default recommendation: yes | Enforce: item 6

## 7. Types
- ★ Q: Ban the escape-hatch type (`any` TS, `Any` Python, `interface{}`/`any` Go, `mixed` PHP, `dynamic`/`object` C#, raw `Object` Java), tests included? | Default recommendation: yes; use the real type from a similar file, or `unknown` + narrowing | Enforce: TS `no-explicit-any`; ruff `ANN401` + mypy `disallow_any_explicit`; Go forbidigo; PHPStan level 9+
- ★ Q: Ban double casts through the top type (`x as unknown as T`)? | Default recommendation: yes | Enforce: item 15
- Q: Ban unchecked casts of external strings to enums/unions? | Default recommendation: yes, validate first | Enforce: TS `consistent-type-assertions`
- Q: Ban non-null assertions and ignore pragmas without a reason? | Default recommendation: yes | Enforce: TS `no-non-null-assertion`, `ban-ts-comment`; mypy `warn_unused_ignores` + ruff `PGH003`
- Q: Explicit return types on exported functions? | Default recommendation: yes | Enforce: TS `explicit-module-boundary-types`; ruff `ANN201`
- ★ Q: Strict null checks? | Default recommendation: yes | Enforce: item 14
- Q: Exhaustive switch over unions/enums? | Default recommendation: yes | Enforce: TS `switch-exhaustiveness-check`; `assert_never`; Go exhaustive; CS8509 as error
- Q: Discriminated unions instead of objects full of optional fields? | Default recommendation: yes | Enforce: AGENTS.md only
- Q: Enums for status fields instead of magic strings/numbers? | Default recommendation: yes | Enforce: `no-magic-numbers`; ruff `PLR2004`
- Q: Type-only imports where supported? | Default recommendation: yes | Enforce: TS `consistent-type-imports`; ruff `TCH`
- Q: One definition per type; never re-declare generated types? | Default recommendation: yes | Enforce: AGENTS.md only
- Q: Readonly/immutable DTOs and value objects? | Default recommendation: yes | Enforce: TS `prefer-readonly`; frozen dataclasses; records

## 8. Error handling
- ★ Q: Ban empty or swallowing catch blocks? | Default recommendation: yes | Enforce: TS `no-empty`; ruff `S110`/`BLE001`; errcheck; PMD EmptyCatchBlock
- Q: Keep the cause when wrapping errors? | Default recommendation: yes | Enforce: TS `preserve-caught-error`; ruff `B904`; errorlint
- Q: Typed application errors in business code; transport errors only at the boundary? | Default recommendation: yes | Enforce: architecture test
- Q: Map errors to status codes in one global handler? | Default recommendation: yes | Enforce: AGENTS.md + architecture test
- Q: Unique error code on every thrown error? | Default recommendation: optional | Enforce: review
- Q: Error messages name things by human name, not internal id? | Default recommendation: yes | Enforce: AGENTS.md only
- Q: Never show stack traces or raw error JSON to users? | Default recommendation: yes | Enforce: global error boundary
- Q: Validate inputs early? | Default recommendation: yes | Enforce: AGENTS.md only
- Q: Guard parsing of external strings (JSON, numbers)? | Default recommendation: yes, with a typed fallback | Enforce: review

## 9. Async & concurrency
- ★ Q: Every promise/future/task awaited or explicitly discarded? | Default recommendation: yes | Enforce: TS `no-floating-promises`; ruff `RUF006`; CS4014 as error
- Q: Ban async callbacks inside forEach-style loops? | Default recommendation: yes | Enforce: TS `no-misused-promises`
- Q: Flag async functions that never await? | Default recommendation: yes | Enforce: TS `require-await`; ruff `RUF029`
- Q: Bound parallel fan-out over input-sized collections? | Default recommendation: yes | Enforce: review
- Q: Retries only for idempotent operations, capped, with backoff? | Default recommendation: yes | Enforce: AGENTS.md only
- Q: Idempotent retryable writes? | Default recommendation: yes | Enforce: unique constraints + review
- Q: No in-process scheduled jobs in horizontally scaled services? | Default recommendation: yes — every replica fires | Enforce: lint ban on cron imports in API packages

## 10. Testing
- ★ Q: Test naming convention? | Default recommendation: "should <behavior> when <condition>" | Enforce: TS `jest/valid-title` pattern; regex in CI
- Q: Arrange-Act-Assert, independent tests, no shared mutable state? | Default recommendation: yes | Enforce: random test order (pytest-randomly, `--randomize`)
- Q: Assertions must be falsifiable (no tautologies; assert the effect)? | Default recommendation: yes | Enforce: mutation testing on changed code (Stryker, mutmut, Infection, PIT)
- Q: Hermetic tests (no env, home config, network or order dependence)? | Default recommendation: yes | Enforce: clean env in CI; pytest-socket
- Q: Assert call arguments, not only "was called"? | Default recommendation: yes | Enforce: review
- Q: Ban weak matchers (`toBeTruthy` for specific values)? | Default recommendation: yes | Enforce: `jest/prefer-to-be`, `prefer-strict-equal`
- ★ Q: Ban focused/skipped tests and debugger statements in commits? | Default recommendation: yes | Enforce: `jest/no-focused-tests`; precheck regex (`.only`, `fit(`, `@pytest.mark.skip`, `t.Skip`, `debugger`, `breakpoint()`, `dd(`)
- Q: Test fixtures never look like credentials? | Default recommendation: yes | Enforce: item 27
- Q: Coverage minimum on changed lines? | Default recommendation: 80% | Enforce: item 23
- Q: Every new source file has a test? | Default recommendation: yes | Enforce: `precheck.mjs` newSourceWithoutTest
- Q: Mock boundaries only, never the unit under test? | Default recommendation: yes | Enforce: AGENTS.md only
- Q: Fake timers instead of sleeps? | Default recommendation: yes | Enforce: lint ban on sleep in tests
- Q: UI tests query by role/label/text? | Default recommendation: yes | Enforce: eslint-plugin-testing-library
- ★ Q: How should the agent run tests locally? | Default recommendation: only related tests, few workers; never the full suite at default parallelism | Enforce: AGENTS.md + item 36

## 11. Database & SQL
- ★ Q: Parameterized queries only? | Default recommendation: yes | Enforce: ruff `S608`; gosec G201/G202; CA2100; SpotBugs; item 15
- ★ Q: Escape LIKE wildcards in user input? | Default recommendation: yes | Enforce: item 15 + review
- Q: Ban schema auto-sync; explicit migrations only? | Default recommendation: yes | Enforce: precheck (`synchronize: true`, `ddl-auto=update`, `create_all()`)
- Q: Only the data-access layer imports the ORM or writes SQL? | Default recommendation: yes | Enforce: dependency-cruiser; import-linter; depguard; ArchUnit; NetArchTest; deptrac
- Q: Repositories obtained one way (e.g. from a unit of work)? | Default recommendation: yes if the project uses one | Enforce: same architecture tools
- Q: Check whether an existing query already loads the data before adding a DB call? | Default recommendation: yes | Enforce: AGENTS.md only
- Q: Ban N+1 (query inside a loop)? | Default recommendation: yes | Enforce: review; runtime N+1 detector
- Q: No in-memory filter/sort over unbounded sets? | Default recommendation: yes | Enforce: review
- Q: Server-capped page size? | Default recommendation: yes | Enforce: validation on limit params
- Q: Chunk bulk IN/inserts? | Default recommendation: yes | Enforce: helper + review
- Q: Guard empty lists before IN / NOT IN? | Default recommendation: yes | Enforce: review
- Q: Transactions roll back on error and release in finally? | Default recommendation: yes | Enforce: transaction helper
- Q: Consistent lock order across multi-table transactions? | Default recommendation: yes | Enforce: AGENTS.md only
- Q: Optimistic concurrency on contended rows? | Default recommendation: yes, 409 on stale | Enforce: review
- Q: Decimal columns mapped to decimal types, never float? | Default recommendation: yes | Enforce: custom lint + review
- Q: Index columns used in WHERE/JOIN? | Default recommendation: yes | Enforce: migration linter (squawk for Postgres)
- Q: Audit fields set by one central place? | Default recommendation: yes | Enforce: base entity + review
- Q: One owning service writes each table? | Default recommendation: yes for several services | Enforce: DB grants
- Q: Cache keys include identity + authorization scope? | Default recommendation: yes | Enforce: review

## 12. Migrations & seeds
- ★ Q: Every migration has up and down? | Default recommendation: yes | Enforce: item 43
- Q: Migrations ordered by strictly increasing timestamp? | Default recommendation: yes | Enforce: item 43
- Q: Seeds idempotent or full refresh (truncate + insert)? | Default recommendation: team choice — ask | Enforce: run seeds twice in CI if idempotent
- Q: Destructive DB scripts refuse non-local hosts without an override? | Default recommendation: yes | Enforce: item 42
- Q: Never hand-edit generated files; regenerate? | Default recommendation: yes | Enforce: CI drift check; hook denying edits under generated paths

## 13. API design
- Q: REST naming: plural nouns, no verbs in paths? | Default recommendation: yes | Enforce: Spectral
- Q: Correct HTTP semantics and status codes; never 200 with an error body? | Default recommendation: yes | Enforce: Spectral + review
- Q: Explicit API versioning; breaking change = new version? | Default recommendation: yes | Enforce: oasdiff in CI (item 45)
- Q: Thin controllers returning DTOs, never entities? | Default recommendation: yes | Enforce: architecture test
- Q: Separate create/update/response DTOs; updates hold only mutable fields? | Default recommendation: yes — prevents mass assignment | Enforce: review
- Q: Reject unknown input fields? | Default recommendation: yes | Enforce: global validation config
- Q: Responses expose only what consumers need? | Default recommendation: yes | Enforce: review
- Q: OpenAPI spec generated, committed and fresh? | Default recommendation: depends — item 45 | Enforce: item 45

## 14. Messaging / events (only if a broker is used)
- Q: Event names in past tense, `*Event` suffix? | Default recommendation: yes | Enforce: naming lint on contracts
- Q: Schemas evolve additively; breaking change = new event? | Default recommendation: yes | Enforce: schema diff in CI
- Q: Payloads carry ids + deltas, not full graphs? | Default recommendation: yes | Enforce: review
- Q: Publish through an outbox or inside the transaction? | Default recommendation: yes | Enforce: review
- Q: Idempotent consumers, dead-letter permanent failures, bounded retries? | Default recommendation: yes | Enforce: review

## 15. Security
- ★ Q: Secrets only from env/secret manager, never in code? | Default recommendation: yes | Enforce: item 27
- ★ Q: Agent blocked from reading `.env*` (allowlist for examples)? | Default recommendation: yes | Enforce: item 10
- Q: Validate all external input with a schema at the boundary? | Default recommendation: yes | Enforce: review / framework config
- ★ Q: Authorization on every read and write, scoped by the parent (IDOR)? | Default recommendation: yes | Enforce: authz tests + item 44
- Q: Never trust a child id from the body without checking its parent? | Default recommendation: yes | Enforce: review
- Q: No shell-string interpolation of user values? | Default recommendation: yes | Enforce: Semgrep; ruff `S602`; gosec G204
- Q: No raw HTML injection without a sanitizer? | Default recommendation: yes | Enforce: `react/no-danger`
- Q: No tokens/PII in client storage beyond what is needed? | Default recommendation: yes | Enforce: review
- ★ Q: Keep production credentials out of the agent's environment (no prod keys in shells or env files the agent can reach)? | Default recommendation: yes — a guard can be bypassed, a missing credential cannot | Enforce: AGENTS.md + item 10 + separate deploy identity
- Q: Which commands may the agent run only with approval (deploys, data migrations on shared envs, infra changes)? | Default recommendation: list them | Enforce: item 9 `dangerGuard.extraPatterns`
- Q: SAST (CodeQL or Semgrep) in CI? | Default recommendation: yes for public or commercial repos | Enforce: CI job

## 16. Dates, time and money
- ★ Q: Ban direct wall-clock reads in production code; inject a clock? | Default recommendation: yes, unless the framework has its own time model (Convex functions, Temporal workflows, Durable Objects) — then follow the framework | Enforce: item 15 (`languages.md`, "wall clock")
- Q: Read the clock once per request? | Default recommendation: yes | Enforce: AGENTS.md only
- ★ Q: Store and send UTC ISO-8601; local time only for display? | Default recommendation: yes | Enforce: review
- Q: All date work through one wrapper module? | Default recommendation: yes | Enforce: banned-import lint
- Q: Never split ISO strings to get a date? | Default recommendation: yes | Enforce: `precheck.mjs` `.split('T')`
- Q: Money uses a decimal type, never floats? | Default recommendation: yes | Enforce: review / custom lint

## 17. Frontend / UI
- Q: No raw HTTP calls in components? | Default recommendation: yes | Enforce: `no-restricted-imports`/globals outside the API folder
- Q: Styling through theme tokens only (no inline styles, hard-coded colors)? | Default recommendation: yes | Enforce: `react/forbid-dom-props` style; stylelint
- Q: Components hold hooks + markup; logic in hooks/utilities? | Default recommendation: yes | Enforce: `max-lines-per-function`
- Q: Stable list keys? | Default recommendation: yes | Enforce: `react/no-array-index-key`
- Q: Hooks rules + complete dependency arrays + effect cleanup? | Default recommendation: yes | Enforce: `react-hooks/rules-of-hooks`, `exhaustive-deps`
- Q: Derive during render instead of syncing state in effects? | Default recommendation: yes | Enforce: eslint-plugin-react-you-might-not-need-an-effect
- Q: Loading, error and empty states for every query? | Default recommendation: yes | Enforce: review
- Q: Disable submit while in flight; guard unsaved changes? | Default recommendation: yes | Enforce: review
- Q: One source of truth per state kind (server cache / form / UI / global store)? | Default recommendation: yes | Enforce: AGENTS.md only

## 18. i18n (only with i18n)
- Q: No hard-coded user-facing text? | Default recommendation: yes | Enforce: eslint-plugin-i18next or a custom rule
- Q: Interpolation and plurals instead of concatenation? | Default recommendation: yes | Enforce: review
- Q: Unused/missing/duplicate key check? | Default recommendation: yes | Enforce: i18n key-check script in CI

## 19. Accessibility (only with UI)
- Q: Semantic HTML, labelled inputs, aria-label on icon buttons? | Default recommendation: yes | Enforce: item 17; axe in tests
- Q: Keyboard-operable custom widgets, visible focus, AA contrast? | Default recommendation: yes | Enforce: axe / Lighthouse CI

## 20. Performance
- Q: Route-level code splitting? | Default recommendation: yes | Enforce: item 26
- Q: Import heavy libraries selectively? | Default recommendation: yes | Enforce: `no-restricted-imports`
- Q: Memoize only measured hot paths? | Default recommendation: yes | Enforce: AGENTS.md only
- Q: Virtualize long lists? | Default recommendation: yes above ~200 rows | Enforce: review

## 21. Observability / logging
- ★ Q: No print/console logging in production code; structured logger only? | Default recommendation: yes | Enforce: `no-console`; ruff `T20`; forbidigo `fmt.Print`; PHPStan disallowed `var_dump`
- Q: Correlation id through logs, calls and messages? | Default recommendation: yes | Enforce: middleware tests
- Q: Log identifiers, never payloads, tokens or PII? | Default recommendation: yes | Enforce: review / Semgrep
- Q: Every silent fallback logs a warning? | Default recommendation: yes | Enforce: review
- Q: Liveness never depends on external systems? | Default recommendation: yes | Enforce: review

## 22. Dependencies & config
- Q: Dependencies in sync with the lockfile before push? | Default recommendation: yes | Enforce: item 19
- Q: Wrap third-party libraries (PDF, Excel, HTTP) in an adapter? | Default recommendation: yes | Enforce: architecture test
- Q: New major library recorded as a decision? | Default recommendation: yes | Enforce: item 6
- ★ Q: New env variable added to `.env.example` and the startup schema? | Default recommendation: yes | Enforce: item 20
- Q: Files that must stay in sync (ports, service lists, compose, README tables)? | Default recommendation: list the groups | Enforce: consistency script in CI

## 23. Architecture & layering
- ★ Q: Strict layering (entry → service → repository), no skipped layers? (Backend-as-a-service projects: entry = the public function (query/mutation/action or route handler), service = plain helper modules, data access = the BaaS client calls; ask whether data calls may live only in helpers.) | Default recommendation: yes | Enforce: dependency-cruiser / import-linter / depguard / ArchUnit / NetArchTest / deptrac
- Q: DTOs only at the boundary; entities never leave the data layer? | Default recommendation: yes | Enforce: architecture tests
- Q: Workers and listeners as thin as controllers? | Default recommendation: yes | Enforce: architecture tests
- Q: Repositories hold no business rules? | Default recommendation: yes | Enforce: review
- Q: Constructor injection only? | Default recommendation: yes | Enforce: review
- Q: Named patterns (Factory, Strategy, Validator) instead of `*Manager`/`*Helper`? | Default recommendation: yes | Enforce: naming lint
- Q: Context objects (user, tenant) never nullable past the boundary? | Default recommendation: yes | Enforce: strict null types

## 24. CI quality gates
- Q: Lint warning budget that only goes down? | Default recommendation: yes for existing projects | Enforce: item 16
- Q: Lint ratchet on changed lines? | Default recommendation: yes for existing projects | Enforce: item 16
- Q: Check scripts fail closed when data is missing? | Default recommendation: yes | Enforce: script design
