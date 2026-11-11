# project-setup-kit

[![Test](https://github.com/mihaitaranu88/project-setup-kit/actions/workflows/test.yml/badge.svg)](https://github.com/mihaitaranu88/project-setup-kit/actions/workflows/test.yml) [![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Give any repository a solid setup for AI coding agents in one guided session.**

`/setup-kit` is a Claude Code plugin. It reads your project, asks only about what is missing, and adds the files, guards and checks that keep AI agents (and humans) on track: an `AGENTS.md` with your team's rules, hooks that stop dangerous commands, lint rules against typical AI mistakes, CI on pull requests, secret scanning, and more. It works with any language and adds nothing without your consent.

```
> /setup-kit

Analysis
- Parts: ./ — TypeScript + Next.js 16, Convex backend (pnpm)
- Git platform: GitHub · AI tools found: Claude Code
- Already configured (will not be asked): #14 strict TypeScript
- Not applicable: #41 releases · #42–43 no migrations · #45 no HTTP API

There are 38 things left to clarify. Let's start:

1/38 · #9 Guards for git, destructive commands and the agent's own config
Blocks git push/commit, `rm -rf ~`, `DROP TABLE`, `--no-verify` and edits to the agent's own hooks.
Recommendation: yes — your settings.local.json allows `git push *` with no guard.
Do you want it?
```

## Why

AI agents are fast and confident, and the mistakes they make are predictable: they push to the wrong branch, read `.env`, add `as unknown as T`, leave `.only` in a test, write a 900-line PR, or "fix" a failing check by disabling it. The usual answer is a long rules file the agent half follows.

This kit turns those rules into things that are checked automatically: hooks the agent cannot skip, lint rules on new lines, and CI jobs that block the merge. It sets them up for your stack, so you do not have to research forty tools.

## Install

In Claude Code 2.1.275 or later, one step:

```
/plugin install project-setup-kit --marketplace mihaitaranu88/project-setup-kit
```

In older versions:

```
/plugin marketplace add mihaitaranu88/project-setup-kit
/plugin install project-setup-kit@project-setup-kit
```

To try it from a local clone instead:

```
/plugin marketplace add /path/to/project-setup-kit
/plugin install project-setup-kit@project-setup-kit
```

Installing changes nothing in your projects. It only makes `/setup-kit` available everywhere.

**Another AI tool instead of Claude Code?** Copy the same guided setup into `.agents/skills/setup-kit/` (the shared Agent Skills folder, ignored by git) and run it from your tool:

```sh
npx github:mihaitaranu88/project-setup-kit install-skill --tool copilot    # then /setup-kit in Copilot Chat (agent mode)
npx github:mihaitaranu88/project-setup-kit install-skill --tool cursor     # then /setup-kit in Cursor
npx github:mihaitaranu88/project-setup-kit install-skill --tool gemini     # then /setup-kit in Gemini CLI
npx github:mihaitaranu88/project-setup-kit install-skill --tool codex      # then $setup-kit in Codex
npx github:mihaitaranu88/project-setup-kit install-skill --tool opencode   # then ask opencode to use the setup-kit skill
```

Run the same command again to update the copy.

Only want the guards, without a guided session?

```sh
npx github:mihaitaranu88/project-setup-kit guards --tool claude   # or copilot, cursor
```

## Run

Open a project in Claude Code and type:

```
/setup-kit
```

A session goes like this:

1. **Analysis.** The agent reads the repo: languages and parts (monorepos too), framework, git platform, AI tools in use, whether there is a database, an API or a frontend, and which items are already configured. Nothing is written yet.
2. **A few context questions.** Which AI tools you use, team or solo, new or existing project.
3. **One item at a time.** Each question comes with a recommendation and the reason. You can also accept a whole group with its recommendations.
4. **Review after every change.** The agent lists the files it created or changed, waits for you to check them, then asks: changes, or next item?
5. **Repository settings last.** Branch protection, required checks and secrets are collected in one list. They run only after you approve that exact list, and you type secrets yourself.

Your answers are saved in `.ai-kit.json`, so you can stop at any point and continue later.

**In a hurry?** Start with a profile and review the plan once instead of answering every item:

```
/setup-kit minimal   # solo projects and prototypes
/setup-kit team      # shared repos with PRs and reviews
/setup-kit strict    # production or client work
```

You still see the full list before anything is installed, and you still review the files after each item. Items that cost money or need an account (AI review, Sonar, previews) are always asked.

| Command | What it does |
|---|---|
| `/setup-kit` | Full setup, or an update if the project already has `.ai-kit.json` |
| `/setup-kit update` | Offers improved templates (with diffs) and items you have not answered yet; never overwrites files you changed |
| `/setup-kit status` | Shows the state of every item and changes nothing |
| `/setup-kit doctor` | Checks that everything still works (guards answer, hooks are wired, CI is green) and proposes fixes |
| `/setup-kit remove <id>` | Removes one item's files, rules and settings |

**Empty folder?** The kit offers to create the project skeleton with your framework's official generator first (`create-next-app`, `laravel new`, `uv init`, …), or to set up only what does not need code yet and finish the rest on the next run.

## What you can get

46 items in 8 groups. The agent asks only about the ones that fit your project.

| Group | Highlights |
|---|---|
| **Agent foundation** | `AGENTS.md` built from your code plus a questionnaire about your rules (quick mode: about 30 questions), a check for every rule that can be checked, a size budget for instructions, team memory for decisions |
| **Agent safety** | Hooks that block git push/commit, destructive commands (`rm -rf ~`, `DROP TABLE`, `terraform destroy`, `--no-verify`), reading `.env`, staging secrets, and edits to the agent's own guards |
| **Local quality** | Pre-commit on staged files, strict types, lint rules against AI shortcuts, a lint ratchet that is strict only on new lines, `.editorconfig` |
| **CI on PRs** | Lint, types, tests and build as a required check, AI review, SonarCloud or coverage and duplicate checks, dead code, PR size, bundle size |
| **Security** | Secret scanning (gitleaks), vulnerable dependencies, Dependabot, license checks |
| **Agent tooling** | Task app connection, slash commands (`/bugfix`, `/feature`, `/ship`, `/address-review-findings`), agent roles, skills, a shared `.mcp.json`, lint and tests after every edit and before the agent stops |
| **Conventions** | Branch names, commit and PR title format, PR template with required sections, automatic releases |
| **Only if you have it** | A guard against migrating a shared database by mistake, migration checks, a report of which endpoints are protected, OpenAPI contract checks, frontend previews |

<details>
<summary>All 46 items</summary>

| # | Item | # | Item |
|---|---|---|---|
| 1 | `AGENTS.md` + questionnaire | 24 | Dead-code detection |
| 2 | Checks for checkable rules | 25 | Large-PR warning |
| 3 | Instruction size budget | 26 | Bundle size |
| 4 | Agent docs consistency | 27 | Secret scanning |
| 5 | Docs updated in the same PR | 28 | Vulnerable dependencies |
| 6 | Team memory + decisions | 29 | Dependabot / Renovate |
| 7 | Plan before code | 30 | License check |
| 8 | Bug fix starts with a failing test | 31 | Task app connection |
| 9 | Git, destructive and self-protection guards | 32 | Slash commands |
| 10 | `.env` guard | 33 | Agent roles |
| 11 | Safe-command allowlist | 34 | Domain skills |
| 12 | CODEOWNERS for agent files | 35 | Shared `.mcp.json` |
| 13 | Pre-commit on staged files | 36 | Post-edit and stop checks |
| 14 | Strict types | 37 | Worktree per task |
| 15 | Anti "AI slop" lint + precheck | 38 | Branch names |
| 16 | Lint ratchet + warning budget | 39 | Commit and PR title format |
| 17 | Accessibility lint | 40 | PR template + required sections |
| 18 | `.editorconfig` + `.gitattributes` | 41 | Automatic releases |
| 19 | Lockfile drift warning | 42 | Remote database guard |
| 20 | Env validation at startup | 43 | Migration checks |
| 21 | Base CI as required check | 44 | Endpoint protection report |
| 22 | AI review on PRs | 45 | OpenAPI + contract check |
| 23 | SonarCloud / coverage + duplication | 46 | Frontend previews |

Conditions, dependencies and detection rules: [`references/catalog.md`](plugins/project-setup-kit/skills/setup-kit/references/catalog.md).

</details>

## How it behaves

- **Nothing without consent.** Every item is a yes/no with a recommendation, and every change is shown for review before the next one.
- **Your text stays yours.** In `AGENTS.md` the kit writes only between `<!-- ai-kit:begin -->` and `<!-- ai-kit:end -->` markers. Blocks managed by other tools (Next.js, Convex, …) are never touched.
- **No invented facts.** Commands and paths go in only if they exist in the repo; anything it cannot confirm becomes a visible `TODO:`.
- **Checks are never weakened to make an error go away.** On any failure the agent stops, shows the error and the likely cause, and offers options. It does not disable a guard or lower a threshold unless you choose that.
- **Local checks have a CI twin.** Git hooks can be skipped, so CI runs the same commands from the same config.
- **No commits, no pushes.** The agent prepares commands and messages; you commit.

## What it adds to a repo

```
AGENTS.md                 rules for every AI tool (CLAUDE.md imports it)
.ai-kit.json              what was asked, answered and installed
.ai-kit/config.json       settings for the guards and checks
.ai-kit/hooks/*.mjs       agent guards (git, destructive commands, .env, protected files, post-edit, stop)
.ai-kit/scripts/*.mjs     checks (ratchet, precheck, branch names, migrations, …)
```

Plus, only for the items you accept: hook wiring in `.claude/settings.json`, git hooks, lint config changes, `.github/workflows/*.yml`, PR template, CODEOWNERS, Dependabot, `.mcp.json`, roles, commands, skills and `docs/ai-memory/`. The guards and checks are small Node scripts with no dependencies.

## Requirements and support

| | |
|---|---|
| **Runs in** | Claude Code |
| **Languages** | Any. Tool mappings for TypeScript/JavaScript, Python, PHP, Go, Java/Kotlin, C#, Ruby, Rust; ready CI jobs for Node, Python, PHP, Go and Java (Maven/Gradle) |
| **Frameworks** | Detects the common ones, including backend-as-a-service (Convex, Supabase, Firebase), Flyway/Liquibase migrations and pnpm workspaces |
| **Git platforms** | GitHub: everything. GitLab, Bitbucket, Azure DevOps: local items work; CI is translated and shown before it is written |
| **AI tools** | Claude Code: everything (plugin). GitHub Copilot, Cursor, Gemini CLI, Codex and opencode: the same guided setup through `npx … install-skill`; guards for Copilot and Cursor (Cursor hooks are experimental). Tools that read `AGENTS.md` get the rules |
| **Operating systems** | macOS, Linux and Windows (scripts are Node; hook commands work in Git Bash and PowerShell) |
| **Needs** | Node.js 20+ on developer machines for the guards and checks. CI installs its own |

## FAQ

**Does it cost anything?** The kit is free and MIT licensed. Some optional items use paid services, and the kit says so when it asks: AI review needs an Anthropic API key or a Claude subscription, and SonarCloud and some GitHub security features are paid on private repositories.

**Will it change my code?** It changes configuration (lint configs, CI, hooks) and the files listed above, always with a diff first. It does not refactor your code. Findings about your code, such as vulnerable packages or unprotected endpoints, are reported, not fixed.

**I already have ESLint, husky, CI…** Good. Existing setups are detected and skipped, or extended in place when only part is missing.

**Can I run it without anyone answering prompts?** Yes, with `claude -p "/setup-kit"`. Claude Code then refuses writes to protected paths such as `.claude/` and `.mcp.json`, so those files are staged in `.ai-kit/pending/`. You finish them later with `node <plugin>/skills/setup-kit/scripts/kit.mjs pending apply`.

**How do I undo it?** `/setup-kit remove <id>` for one item, or revert the changed files with git.

## Related tools

If you need only one piece, these may be enough: [agents-md](https://github.com/eugeniughelbur/agents-md) and [agentsgen](https://pypi.org/project/agentsgen/) for `AGENTS.md`; [destructive_command_guard](https://github.com/Dicklesworthstone/destructive_command_guard), [cc-safe-setup](https://socket.dev/npm/package/cc-safe-setup) and [agent-guard](https://github.com/Tngc93/agent-guard) for guard hooks; [claude-code-showcase](https://github.com/ChrisWiles/claude-code-showcase) for a complete example setup.

This kit does three things they do not: it asks only about what is missing, it covers CI and repository settings, and it can be re-run, updated or undone item by item.

## Developing the kit

```sh
npm run check
```

This runs a consistency check (every template, guide and profile row exists, versions match, icon present) and about 210 tests for the guard, check and CLI scripts.

`npm run eval` runs the plugin's eval suite with `claude plugin eval` (it uses tokens). The cases in `plugins/project-setup-kit/evals/` are generated from `tests/fixtures/*/expected.json` and check the analysis of each fixture project, plus the behavior that matters most: the first turn asks one thing with a recommendation, a plain request asks before writing, `status` changes nothing and `remove` asks before deleting. Every case also runs without the plugin, so the report shows how much the kit adds. The **Skill evaluation** workflow does the same on GitHub: run it from the Actions tab, or it runs on every `v*` tag; it needs an `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN` secret. [`tests/EVAL.md`](tests/EVAL.md) covers the manual walk-through of the full flow.

## License

MIT
