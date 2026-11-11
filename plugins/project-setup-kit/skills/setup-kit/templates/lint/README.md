# Lint templates (item 15)

Where it goes: copy `eslint-ai-slop.config.mjs` (and `eslint-rules/`) to the repo root next to `eslint.config.*`, then import it and spread it at the end of the exported array (`...aiSlopConfig`). For other linters merge the snippet into the existing config file.

Merge into the project's existing config; never replace it. Keep only the rules that match the questionnaire answers (for example drop the wall-clock rule if the team said no to an injected clock).

| File | Merge into | Needs |
|---|---|---|
| `eslint-ai-slop.config.mjs` | `eslint.config.*` (spread the exported array at the end) | `typescript-eslint`; copy `eslint-rules/no-barrel-exports.mjs` next to it (`.mjs` so Node does not warn about the module type) |
| `ruff-ai-slop.toml` | `[tool.ruff.lint]` in `pyproject.toml` or `ruff.toml` | ruff |
| `golangci-ai-slop.yml` | `.golangci.yml` | golangci-lint v2 (for v1 move `settings` to `linters-settings` and `exclusions.rules` to `issues.exclude-rules`) |
| `phpstan-ai-slop.neon` | `phpstan.neon` | `phpstan/phpstan-strict-rules`, `spaze/phpstan-disallowed-calls` (ask before adding dev dependencies) |

Typed rules (`no-floating-promises`, `no-misused-promises`) are in the separate `typedRulesConfig` export because they need type information (`parserOptions.projectService`). Add it only when every linted `.ts` file belongs to a tsconfig, or put the files outside one (scripts, config files) in that config's `ignores` — otherwise ESLint errors on them and the stop check blocks.

ESLint flat config: a later `no-restricted-syntax` entry replaces earlier ones for the same files. If the project already sets it, merge the selectors into one list instead of adding a second entry.

Tests: `no-explicit-any` and the other type rules apply to tests too (the questionnaire default is "tests included"); only `no-console` and the restricted-syntax rules are relaxed in test files. Change that only if the user answered differently.

The kit's own folder `.ai-kit/` must be in the project's lint ignores (`ignores: ['.ai-kit/**']` in ESLint flat config, `extend-exclude` in ruff, `excludePaths` in PHPStan): its scripts are vendored tooling, not project code, and would otherwise fail the project's own rules and the ratchet on the setup PR.

ESLint 9 removed the built-in `unix` formatter that the ratchet and warning budget parse. Add the `eslint-formatter-unix` dev dependency (ask first), or keep ESLint 8.

Wall-clock rules need an allowed place where the clock is implemented: add that file to `ignores`/exclusions.

For existing projects with many violations, set new rules to `warn` and add them to the lint ratchet (item 16) so they block only on changed lines.
