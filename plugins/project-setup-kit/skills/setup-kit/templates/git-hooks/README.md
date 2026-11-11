# Git hooks

Pick the manager the project already uses. If none:

| Team | Use | Install |
|---|---|---|
| Any language, mixed stacks | lefthook (`lefthook.yml`) | `npx lefthook install`, `brew install lefthook`, or `go install github.com/evilmartians/lefthook@latest`, then `lefthook install` |
| Python-first | pre-commit framework (`.pre-commit-config.yaml`) | `pipx install pre-commit && pre-commit install --hook-type pre-commit --hook-type commit-msg --hook-type pre-push` |
| JS/TS only | husky + lint-staged | write the `.husky/*` files first, then `pnpm exec husky` / `npx husky` (do not use `husky init`: it writes a default `npm test` pre-commit and switches `core.hooksPath` before the real hooks exist) |

Install order for lefthook: write `lefthook.yml` first, then run `lefthook install` (without a config it writes an example file of its own). In JS projects add `"prepare": "lefthook install"` to `package.json` scripts so every clone gets the hooks — but only once `lefthook.yml` is in place: while it is still pending, any `pnpm install`/`add` would run `prepare`, lefthook would write its own default config, and `pending apply` would then skip the real one. In staged runs, list adding `prepare` as a follow-up step after `pending apply`. pnpm 10 blocks dependency install scripts: either keep the `prepare` script, or allow lefthook with `pnpm approve-builds` / `"pnpm": { "onlyBuiltDependencies": ["lefthook"] }` (same timing).

The pre-commit commands run in sequence (`parallel: false`, `piped: true`): fixers that re-stage files (`stage_fixed`) must finish before precheck and the ratchet read the staged diff.

Pre-commit content for every stack: the linter/formatter on staged files, `gitleaks git --pre-commit --staged`, and `node .ai-kit/scripts/precheck.mjs --staged` when item 15 installed it. Pre-push: branch name and lockfile drift.

Every item adds its commands to the one manager the project uses; never install a second manager.

Husky equivalents:

- `.husky/pre-commit`: `npx lint-staged` and `gitleaks git --pre-commit --staged --redact --no-banner`
- `.husky/commit-msg`: `node .ai-kit/scripts/commit-msg.mjs "$1"`
- `.husky/pre-push`: `node .ai-kit/scripts/branch-name.mjs && node .ai-kit/scripts/lockfile-check.mjs`
- precheck (item 15) in `.husky/pre-commit`: `node .ai-kit/scripts/precheck.mjs --staged`

lint-staged (`.lintstagedrc.mjs`) — keep it fast; no project-wide `tsc` here, that runs in CI:

```js
export default {
  '*.{ts,tsx,js,jsx,mjs,cjs}': ['eslint --fix --cache'],
  '*.{ts,tsx,js,jsx,json,css,scss,md,yml,yaml}': ['prettier --write'],
};
```

Replace every `{{…}}` placeholder with the project's commands, globs and pinned tool versions. Remove commands for items the user declined.
