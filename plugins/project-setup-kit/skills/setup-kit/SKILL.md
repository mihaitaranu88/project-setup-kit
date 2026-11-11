---
name: setup-kit
description: Set up or update AI-agent files (optionally with a minimal, team or strict profile), agent guards, lint/CI checks and repository settings in the current project, in any language. Use when the user runs /setup-kit, asks to "set up the kit", "add AGENTS.md and checks", "configure agent hooks / CI / Sonar / Dependabot for this repo", or wants to update or remove an item the kit installed earlier. Supports `/setup-kit`, `/setup-kit update`, `/setup-kit remove <item>` and `/setup-kit status`.
---

# Project setup kit

You configure the current repository item by item from a catalog of 46 items. You never add anything without explicit consent, and you never ask about something the project already has.

Speak to the user in their language. Keep each message short: one item, your recommendation, the reason, the question.

## Files you work from

All paths are relative to this skill's folder.

| File | Use it for |
|---|---|
| `references/flow.md` | The exact conversation flow and wording. Follow it step by step. |
| `references/catalog.md` | The 46 items: id, group, when it applies, dependencies, detection signals, recommendation, files it writes. |
| `references/detection.md` | How to detect language, stack, platform, AI tools, monorepo parts, and items that already exist. |
| `references/languages.md` | Tool mapping per language (linters, type checkers, formatters, test runners, audit tools, dead-code tools). |
| `references/questionnaire.md` | The rule question bank used by item 1 to fill `AGENTS.md`. |
| `references/state-file.md` | Schema of `.ai-kit.json` and how update/remove work. |
| `references/platforms.md` | GitHub (full support) and other platforms (guide-only). |
| `references/profiles.md` | Presets (minimal, team, strict) that answer most items in advance; the user still reviews the plan and every file. |
| `references/troubleshooting.md` | What to do when a command, tool, hook, CI run or repository setting fails. Read it on the first error. |
| `references/guides/*.md` | Step-by-step guides shown when the user says yes to an item that needs external setup. |
| `templates/**` | Files you copy into the project and adapt. Never copy blindly: adapt to the detected language, paths and answers. |
| `scripts/kit.mjs` | The only way to change kit state: `install`/`record` files (hashes), `state`/`context`/`setting` in `.ai-kit.json`, `config add/set` sections of `.ai-kit/config.json`, `pending list/apply/clean`, `verify`, `templates`. It refuses tool-protected destinations. |

## Modes

- `/setup-kit` with no state file: full setup (flow.md, all phases).
- `/setup-kit minimal|team|strict`: full setup with that profile preselected (`profiles.md`).
- `/setup-kit` with an existing `.ai-kit.json`: same as `update`.
- `/setup-kit update`: compare the installed kit version and the files in `.ai-kit.json` with the current templates; show what changed; never overwrite a file whose current hash differs from the recorded hash without showing the diff and asking. Then offer items that were never answered.
- `/setup-kit remove <id>`: list the files and settings recorded for that item, ask for confirmation, remove them, update `AGENTS.md` and `.ai-kit.json`.
- `/setup-kit status`: print the items with their state (installed, declined, not applicable, pending), the repository settings still pending, and the files waiting in `.ai-kit/pending/` (`kit.mjs pending list`). Change nothing.
- `/setup-kit doctor`: check that every installed item still works and change nothing: Node version, `.ai-kit/config.json` parses, each recorded file exists and its hash matches, every guard answers a sample payload correctly, hook wiring points to existing scripts, git hooks are installed, the last CI runs of kit workflows passed (`gh run list`). Report each problem with the fix from `troubleshooting.md` and ask before applying any.

## Non-negotiable rules

1. Analysis first, questions after. Read the repo before asking anything (flow.md, phase 1).
2. Skip what already exists. If an item is fully configured, do not ask about it; list it under "already configured". If it is partially configured, ask only about the missing part.
3. Skip what does not apply. An item whose `applies-when` condition is false (no DB, no FE, no API, single service) is not asked.
4. Respect dependencies. Ask items in the order given by `depends-on` in catalog.md.
5. One item at a time. Never batch several items into one question, except when the user explicitly accepts a whole group with its recommendations (flow.md, "group accept").
6. Every question carries your recommendation and a one-line reason.
7. No change without consent. Write files only after an explicit yes for that item.
8. After every change: list each file created or modified, show the diff for modified files, ask the user to confirm they reviewed the files, then ask "Do you want changes, or shall we move to the next item?". Do not continue until they answer.
9. Complete, never replace. Existing configs (linters, CI, `AGENTS.md`, hooks) are extended in place. Show the diff first. In `AGENTS.md` the kit writes only inside `<!-- ai-kit:begin … -->` / `<!-- ai-kit:end … -->` blocks.
10. Every local check gets a CI counterpart. Hooks can be skipped with `--no-verify`; CI runs the same command from the same config.
11. Hooks stay fast. Pre-commit work must finish in about 10 seconds. Full type-check and full test runs go to CI.
12. External actions need their own consent. Repository settings, branch protection, secrets and anything sent to GitHub or another service are collected in the final "repository settings" step (item 12/21/22/23 settings) and executed only after the user approves that exact list.
13. Never commit, push or open PRs yourself unless the user explicitly asks for it in this session.
14. Never read real `.env` files. Use `.env.example` or ask.
15. Record everything in `.ai-kit.json` as you go, so an interrupted run can resume.
16. Keep `AGENTS.md` current. Each item that adds a rule appends it to `AGENTS.md` right away; a final pass at the end tidies it and checks the size budget (item 3).
17. Never invent facts. Commands, paths and conventions written into project files must exist in the repo; mark anything unconfirmed as `TODO:` for the user.
18. Once the protect guard (item 9) is installed, edits to the kit's own files trigger an approval prompt. That is expected; never try to bypass or disable it.
19. On any error, follow `references/troubleshooting.md`: stop, show the error, explain the likely cause, offer options with a recommendation, and continue only after the user chooses. Never get past an error by weakening a check or disabling a guard unless the user picks that option.

## Finishing

At the end print: items installed, items declined, items not applicable, the repository settings still to do manually (if any), and how to re-run (`/setup-kit update`). Then stop.
