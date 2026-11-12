# Troubleshooting

## Protocol for any error

1. Stop the current item. Do not continue to the next item and do not retry the same command more than once.
2. Show the user the command, the exit code and the relevant part of the output (not the whole log).
3. Say in one or two sentences what you think the cause is, and how sure you are.
4. Offer the options from the matching section below, with your recommendation. Act only on the user's choice.
5. Record the outcome in `.ai-kit.json`: `installed`, `partial` (with `missing`), or `pending` (with `error`), so `/setup-kit update` can pick it up later.
6. Never "fix" an error by weakening a check, disabling a guard, adding `--no-verify`, lowering a threshold or deleting a test, unless the user explicitly chooses that option.

You may fix on your own, without asking, only mistakes the kit itself just introduced in the current item (a typo in a generated file, a wrong path, invalid JSON/YAML you wrote). Show the fix in the item's file review.

## During analysis

| Symptom | Check | Options |
|---|---|---|
| Not a git repository | `git rev-parse --show-toplevel` | Offer `git init`; or stop |
| Uncommitted changes | `git status --porcelain` | Continue (the kit's changes mix in), let the user commit first, or stop |
| Detached HEAD or no commits | `git symbolic-ref -q HEAD`, `git log -1` | Ask the user to create a branch / first commit; the base-branch checks need it |
| Unknown language or framework | manifests in `detection.md` | If the folder has no code at all, go to Phase 0b (new project). Otherwise ask the user what the stack is; continue with language-neutral items only |
| A generator fails or wants an empty folder | its output | Run it in a temporary sub-folder and move the files up after showing the list; never delete the user's existing files to make room |
| `.ai-kit.json` is invalid JSON | parse it | Show the parse error; offer to repair the obvious syntax issue or to rename it to `.ai-kit.json.bak` and start fresh |

## Node and tool availability

| Symptom | Check | Options |
|---|---|---|
| `node` missing or older than 20 | `node --version` | Install hint for the OS (`brew install node`, `winget install OpenJS.NodeJS.LTS`, `nvm install 22`); port the needed scripts to the project's language; or skip the items that need them |
| Every kit command asks for approval, or shell variables, `bash script.sh` and `cmd1 && cmd2` are refused | the tool's permission settings | Ask the user once to allow `node <skill-dir>/scripts/kit.mjs` (and the project's own check commands). Run one plain command per call, without `&&`, pipes or shell variables, and pass paths as arguments. Never write wrapper scripts to get around a refused command, and never ask for blanket shell access |
| `gh` missing or not logged in | `gh --version`, `gh auth status` | Install hint (`brew install gh`, `winget install GitHub.cli`), then the user runs `! gh auth login`; or show manual steps for Phase 4 |
| gitleaks, lefthook, pre-commit, ruff, golangci-lint etc. missing | `<tool> --version` | Show the install command for the OS and package manager; add it as a dev dependency where the ecosystem supports it (ask first); or skip the local part and keep the CI part |
| Docker missing (gitleaks in CI uses it) | — | No local impact: CI runners have Docker. Only mention it |

Never install anything globally without the user's yes.

## Writing files

| Symptom | Check | Options |
|---|---|---|
| Target file exists and differs | diff | Merge (show the diff), keep theirs and skip, or write next to it as `<name>.ai-kit` for the user to merge |
| Protect guard asks for approval on the kit's own files | expected after item 9 | Explain that the prompt is the guard working; the user approves each write |
| Permission denied on a path | `ls -l` | Show it; never `chmod`/`sudo` on your own |
| Generated YAML/JSON invalid | JSON: `node -e "JSON.parse(require('fs').readFileSync('<file>','utf8'))"`. YAML: use what is available offline — `actionlint` (best for workflows), `ruby -ryaml -e "YAML.safe_load(File.read('<file>'))"`, `python3 -c "import yaml,sys;yaml.safe_load(open(sys.argv[1]))" <file>`, or the `yaml` package if it is in `node_modules`. If none exists, say the file is unvalidated | Fix it yourself (kit-introduced) and show the fix |
| `lefthook validate` cannot see a staged config | it only reads the repo root | Validate after `pending apply`; list it as a follow-up |
| The tool blocks a shell construct (brace expansion, `VAR=… cmd`, compound commands) | the refusal message | Use the kit's own commands instead (`kit.mjs guard-test`, `kit.mjs plugin-rules`, `kit.mjs config set <section> --file values.json`); for a build that needs env values, write a small script file that sets them and run that file |

## Protected paths

AI tools protect some paths themselves. Claude Code asks before every write to `.claude/**`, `.mcp.json`, `.git/**`, git hook folders and hook manager configs, even with edits auto-accepted.

- Interactive run: this is expected. Tell the user the prompt is coming and why, then let them approve it.
- Refused (headless run, or the user said no): do not look for another way to write there — neither shell tricks nor `kit.mjs`, which refuses protected destinations on purpose. Stage the file instead: `kit.mjs install <template> <pending path>` or write it yourself to the pending path, which is the target path with every leading dot turned into `dot-` and `.pending` appended to the file name (`.claude/settings.json` → `.ai-kit/pending/dot-claude/settings.json.pending`, `lefthook.yml` → `.ai-kit/pending/lefthook.yml.pending`). Add `.ai-kit/pending/` to `.gitignore`. Mark the item `partial` (`kit.mjs state <id> partial --missing "copy from .ai-kit/pending"`). In the summary tell the developer to run `node <skill-dir>/scripts/kit.mjs pending apply` themselves (it copies every pending file into place; the protect guard asks before the agent may run it), then the follow-ups (`lefthook install`, …), then `kit.mjs pending clean`. `kit.mjs pending list` shows what is left; `/setup-kit update` and `doctor` check it too.
- Never activate a mechanism whose files are still pending: do not set `core.hooksPath`, run `husky init`, `lefthook install` or `pre-commit install` until the hook files themselves are in place, or every commit will run a default or empty hook.

## Hooks and guards

| Symptom | Check | Options |
|---|---|---|
| A guard blocks a legitimate command | pipe the payload into the guard to see which rule matched | Add a precise entry to `allowPatterns` / `allowExact` / the env allowlist in `.ai-kit/config.json`; never remove the whole pack without the user choosing it |
| A guard never fires | `.claude/settings.json` has the hook; `node .ai-kit/hooks/<guard>.mjs` exists; run it with a sample payload | Fix the wiring; check the matcher name (`Bash`, `Edit|Write`) |
| Hook times out | timing of the command | Raise `timeout` in the hook entry, or move the slow work to CI |
| Post-edit or stop check keeps failing on code the agent did not change | run the command by hand | Narrow the rule (`match` regex, related tests only), or switch the command to changed lines; ask before disabling |
| Git hook blocks the developer's commit | run the hook command by hand | Fix the cause; if the hook itself is wrong, fix the kit's config. `--no-verify` only if the developer decides so for that commit |
| Hooks run twice | same hook in `.claude/settings.json` and a plugin's `hooks.json` | Keep only the project settings entry |

## Linters and type checks

| Symptom | Check | Options |
|---|---|---|
| New lint rules produce many errors in old code | count | Set them to `warn` and put them in the ratchet (item 16), or fix now if the user wants |
| Ratchet says it cannot parse the linter output | run the command, look at a line | Switch the linter to a `path:line:` format (`languages.md`), or adjust the command |
| `The unix formatter is no longer part of core ESLint` | ESLint ≥ 9 | Add the `eslint-formatter-unix` dev dependency (ask) |
| The kit's own scripts fail the project's linter | lint output names `.ai-kit/` | Add `.ai-kit/**` to the linter ignores; never rewrite the kit's scripts to satisfy project rules |
| Warning budget file missing | — | `node .ai-kit/scripts/warning-budget.mjs --update` writes the current count |
| Strict type mode breaks the build | count of new errors | Keep strict for new files only (per-folder config or ratchet), or fix in a separate item |

## CI after the workflow is added

| Symptom | Check | Options |
|---|---|---|
| `Unable to locate executable file: pnpm` in setup-node | workflow has `cache: pnpm` | Add `pnpm/action-setup@v6` before setup-node |
| Workflow fails on its first run | `gh run list --limit 5`, `gh run view <id> --log-failed` | Kit-introduced (wrong path, command, version) → fix and show the diff; project problem (tests already failing on the base branch) → report it, do not hide it |
| `Resource not accessible by integration` | job `permissions` | Add the single missing permission to that job |
| Secret missing | `gh secret list` | The user sets it with `gh secret set <NAME>`; never ask them to paste it in the chat |
| Required check never appears in the ruleset picker | the job has to run once on a PR | Open a draft PR (ask), or tell the user to add the check after the first run |
| Sonar quality gate fails on legacy code | new-code period setting | Set the new-code definition to "previous version" or a date; never lower the gate silently |
| Dependency review fails on a license | the reported package | Add the license to the allow list only if the user confirms it is acceptable; otherwise replace the dependency |

## Repository settings (Phase 4)

| Symptom | Check | Options |
|---|---|---|
| 403 / 404 on rulesets or protection | `gh api repos/{owner}/{repo} --jq .permissions` | The user needs admin; print the manual steps for an admin |
| Rulesets not available (plan limits on private repos) | API error message | Fall back to classic branch protection, or manual steps |
| Organization policy overrides the repo setting | API error message | Tell the user which org setting blocks it |

## Platform not GitHub

Translate the item as described in `platforms.md`. If a feature has no equivalent on that platform, say so, mark the item `partial` with the missing part, and continue.
