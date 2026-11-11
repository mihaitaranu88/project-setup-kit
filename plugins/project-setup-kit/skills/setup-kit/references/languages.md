# Tools per language

Prefer what the project already uses. Propose a new tool only when nothing covers the need.

## Lint, format, types, tests

| Language | Lint | Format | Types (strict) | Related tests for one file |
|---|---|---|---|---|
| TypeScript / JS | ESLint (flat config), Biome | Prettier, Biome | `tsc --noEmit` with `strict: true` | `jest --findRelatedTests <f>`, `vitest related <f> --run` |
| Python | ruff | ruff format, black | mypy `--strict` or pyright `strict` | `pytest <tests/test_<name>.py>` (by naming convention) |
| PHP | PHP_CodeSniffer, PHP-CS-Fixer, Pint (Laravel) | same | PHPStan (level 8+, `phpstan-strict-rules`), Psalm | `phpunit --filter <Class>Test`, `pest <file>` |
| Go | golangci-lint | gofmt / gofumpt | compiler + `go vet` | `go test ./<package dir>` |
| Java / Kotlin | Checkstyle, PMD, ktlint, detekt | google-java-format, ktfmt | compiler `-Werror`, Error Prone, NullAway | `mvn -Dtest=<Class>Test test`, `gradle test --tests <Class>Test` |
| C# | .NET analyzers (`<AnalysisLevel>latest-all`) | `dotnet format` | `<Nullable>enable</Nullable>`, `<TreatWarningsAsErrors>` | `dotnet test --filter FullyQualifiedName~<Class>Tests` |
| Ruby | RuboCop | RuboCop | Sorbet, Steep | `rspec <spec file>` |
| Rust | clippy | rustfmt | compiler | `cargo test <module>` |

All linters above can print `path:line:` lines, which the lint ratchet (item 16) needs: `eslint -f unix`, `ruff check --output-format concise`, `phpstan --error-format raw`, `phpcs --report=emacs`, `golangci-lint run --out-format line-number` (v1) / `--output.text.path stdout` (v2), `rubocop --format emacs`, `cargo clippy --message-format short`. Java: Checkstyle's default `[WARN] path:line:col: message` lines, PMD `--format emacs`, and Maven compiler `[WARNING] path:[line,col] message` lines are all understood; run them on the changed files (`checkstyle -c <config> {files}`, `pmd check -d {files} -R <ruleset> -f emacs`), not through a full `mvn verify`, so the ratchet stays fast.

## Escape hatches (questionnaire "types" + item 15)

| Concept | TS | Python | PHP | Go | Java / C# |
|---|---|---|---|---|---|
| any-type | `any` → `@typescript-eslint/no-explicit-any` | `Any` → ruff `ANN401` | `mixed` → PHPStan `checkExplicitMixed` | `interface{}`/`any` → `forbidigo` or review | `Object`/`dynamic` → review |
| double assertion | `x as unknown as T` → `no-restricted-syntax` | `cast(T, cast(Any, x))` → review | — | — | — |
| blanket ignore | `@ts-ignore` → `@typescript-eslint/ban-ts-comment` | `# type: ignore` without code → ruff `PGH003` | `@phpstan-ignore-line` without id → `reportUnmatchedIgnoredErrors` | `//nolint` without linter/reason → `nolintlint` | `@SuppressWarnings` → review |
| lint disable without reason | `eslint-comments/require-description` | ruff `PGH004` (blanket noqa) | — | `nolintlint` `require-explanation` | — |
| debug print | `no-console` | ruff `T20` | `disallowed-calls` for `var_dump`, `dd`, `dump` | `forbidigo` `fmt.Print.*` | `System.out` → Checkstyle `Regexp` |
| wall clock | `no-restricted-syntax` `new Date()` without args, `Date.now()` | ruff `DTZ` (naive datetimes) | `disallowed-calls` for `time()`, `date()`, `new DateTime()` without args | `forbidigo` `time.Now` outside a clock package | `LocalDateTime.now()` → review / ArchUnit |
| SQL built from strings | `no-restricted-syntax` on template literals passed to `query`/`raw` | ruff `S608` | PHPStan `disallowed-calls` on raw query helpers | `gosec` `G201`/`G202` | SpotBugs `SQL_INJECTION` |

## Accessibility (item 17)

React: `eslint-plugin-jsx-a11y`. Vue: `eslint-plugin-vuejs-accessibility`. Angular: `@angular-eslint/template` accessibility rules. Svelte: built-in a11y warnings (`svelte-check`). Plain HTML: `html-validate`.

## Security and dependencies

| Language | Audit | Licenses | Dead code |
|---|---|---|---|
| JS / TS | `npm audit --audit-level=high`, `pnpm audit` | GitHub dependency-review, `license-checker` | knip |
| Python | `pip-audit` | dependency-review, `pip-licenses` | vulture |
| PHP | `composer audit` | dependency-review, `composer licenses` | `shipmonk/composer-dependency-analyser`, PHPStan dead-code extension |
| Go | `govulncheck ./...` | dependency-review, `go-licenses` | `deadcode ./...`, `staticcheck` U1000 |
| Java | OWASP dependency-check | dependency-review | PMD unused rules |
| C# | `dotnet list package --vulnerable` | dependency-review | IDE0051/IDE0052 analyzers |

Secrets: gitleaks for every language. Duplicate code (when Sonar is not used): jscpd for every language.

## Hook managers (item 13)

- Any language: lefthook (`lefthook.yml`), or plain `git config core.hooksPath .ai-kit/git-hooks`.
- Python-first teams: pre-commit framework (`.pre-commit-config.yaml`).
- JS-only teams: husky + lint-staged.

If one already exists, extend it.

## Env validation (item 20)

TS: zod schema parsed at startup (or `@t3-oss/env-core`, envalid). Python: pydantic-settings `BaseSettings`. PHP/Laravel: a config check in a service provider that throws on missing keys, or `vlucas/phpdotenv` `required()`. Go: a struct loaded with `caarlos0/env` and `required` tags. Java/Spring: `@ConfigurationProperties` + `@Validated`. C#: options pattern with `ValidateDataAnnotations().ValidateOnStart()`.
