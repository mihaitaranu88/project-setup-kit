# Conversation flow

Follow the phases in order. Translate the wording to the user's language; keep the meaning.

## Phase 0 — mode

1. If `.ai-kit.json` exists at the repo root, read it. Switch to update mode (SKILL.md, "Modes") unless the user asked for `remove` or `status`.
2. If the run is non-interactive (headless `claude -p`, CI, or the user said nobody will answer prompts), say up front that writes to tool-protected paths (`.claude/**`, `.mcp.json`, hook manager configs) will be staged in `.ai-kit/pending/` (see `troubleshooting.md`) and finished by the developer with `kit.mjs pending apply`.
3. If the working tree has uncommitted changes, say so and ask whether to continue. The kit's changes should be easy to review as their own diff.

## Phase 0b — new project (only when the folder has no code yet)

If detection finds no manifest and no source files (an empty folder, or only `README`, `LICENSE`, `.gitignore`, docs), say so and offer:

```
This folder has no code yet, so the kit cannot see the real commands, framework or layout.
Recommendation: create the project skeleton first, then run the kit on it — every command and CI job will be real.
1. Create the skeleton now (I propose the official command for your stack and run it only after you approve)
2. Continue with the stack you plan to use (items that need real code stay pending until the next run)
3. Stop here
```

Whichever option: if the folder is not a git repository, offer `git init` first (with the base branch name the user wants, default `main`).

1. **Skeleton**: ask the planned stack (language, framework, package manager), propose the official generator (`references/detection.md`, "New project generators"), show the exact command, run it only on a yes, then continue with Phase 1 on the result.
2. **Planned stack**: record it with `kit.mjs context '{"newProject":true,"plannedStack":{...}}'`. Choose the hook manager now (item 13's recommendation, default lefthook) so later items have one place to add commands; its lint commands come after the skeleton.
   - Install now (they do not need code): 1 (rules from the questionnaire; commands and layout as `TODO:` lines), 2 (record which rules will become checks; install them later), 3, 5, 6, 7, 8, 9, 10, 11 (only git read commands; project commands after the skeleton), 12 (teams only), 18, 27, 31, 38, 39, 40.
   - Not applicable for a new project: 16 (no old code to ratchet).
   - Postpone with `kit.mjs state <id> pending --note "no code yet"`: 4, 13 (manager chosen, commands later), 14, 15, 17, 19–26, 28, 29 (Dependabot needs a manifest to watch), 30, 32–37, 41–47, 49, 50 (no commands yet), 51 (no infrastructure files yet). Item 48 can be done now for the workflows written in this run.
   Tell the user to run `/setup-kit update` after creating the skeleton; update asks the postponed items then.
3. **Stop**: write nothing.

## Phase 1 — analysis (no questions yet)

Run the checks in `detection.md` silently. Then show one short report:

```
Analysis
- Parts: <e.g. "web/ — TypeScript + React (npm)", "api/ — PHP 8.3 + Laravel (composer)">
- Git platform: <GitHub | GitLab | ... | unknown>
- AI tools found: <Claude Code (.claude/), Copilot (.github/copilot-instructions.md), Cursor (.cursor/) | none>
- Has: DB + migrations <yes/no>, HTTP API <yes/no>, frontend <yes/no>, several services <yes/no>, versioned releases <yes/no>
- Already configured (will not be asked): <item ids + names>
- Partially configured (only the missing part will be asked): <item id: what is missing>
- Not applicable (will not be asked): <item ids + reason>
```

## Phase 2 — context (always asked, before any item)

Also read `.claude/settings.local.json` and `.claude/settings.json` permissions during analysis and report risky allow rules (e.g. `git push *`, `rm *`, broad wildcards); item 9 will cover them.

Ask these one at a time, each with your recommendation from the analysis:

1. Which AI tools does the team use? (Claude Code, GitHub Copilot, Cursor, other). Files are generated for each chosen tool.
2. Which git platform? Full support is GitHub. For others, items that need CI or repository settings become guides only (see `platforms.md`).
3. New project or existing one with history? Existing projects get ratchets (item 16) instead of strict rules everywhere.
4. Solo or team? Team enables CODEOWNERS (12) and shared memory (6) recommendations.
5. Is Node.js 20+ available on developer machines and CI? The kit's guard and check scripts are Node scripts. If not, offer to port the needed scripts to the project's language, or skip those items.

6. Profile: minimal, team, strict, or custom (one by one)? See `profiles.md`; recommend from the answers above. A profile can also be passed as an argument: `/setup-kit minimal|team|strict`.

Store the answers in `.ai-kit.json` under `context`.

## Phase 3 — items

With a profile, follow `profiles.md` ("How the agent uses a profile") and then the per-item steps below for the items that are installed or asked. Without one (custom), go item by item.

Build the list: all catalog items, minus already configured, minus not applicable, ordered by group (A→H) and `depends-on`.

Say: "There are X things left to clarify. Let's start:" and begin.

### Group accept

When you reach the first item of a group, offer once:

"Group <letter> — <name> has N items. You can go through them one by one, or accept all with my recommendations (you still review the files after each item). How do you want to proceed?"

Group accept only skips the questions. It never skips the per-item file review in step 4 below.

### Per item

1. Ask, in this shape:

   ```
   <n>/<X> · #<id> <name>
   <one sentence: what it does>
   Recommendation: <yes | no | only if ...> — <one-line reason>
   Do you want it?
   ```

   If the user asks "why", "how", "what does it cost" or similar, answer briefly and ask again.
2. If the item has sub-questions (catalog `sub-questions`), ask them now, one at a time, each with a recommendation.
3. If the answer is yes and the item has a guide, walk through the guide step by step and wait for the user at each step that needs them (accounts, tokens, external settings).
4. Apply the change:
   - Copy and adapt the templates listed in the catalog. Adapt paths, language, package manager, commands, names and answers.
   - If a target file exists, merge into it. Show the diff before writing.
   - Append the item's rule (if any) to `AGENTS.md`.
   - Record the item in `.ai-kit.json` with the kit's script, never by hand: `kit.mjs install` / `kit.mjs record` for files, `kit.mjs state <id> <state> --answers '<json>'` for the state and answers, `kit.mjs context '<json>'` for Phase 2.
5. Report:

   ```
   Done: #<id> <name>
   Created: <path>, <path>
   Modified: <path> (diff shown above)
   Please review these files. Confirm when you have checked them.
   ```

6. After the confirmation: "Do you want changes, or shall we move to the next item?"
7. On "no" to the item: `kit.mjs state <id> declined`, write nothing else, move on. Items skipped by analysis get `existing` or `not-applicable` the same way.
8. If any step of the item fails (a command, an install, a check you just added, a guard test), stop and follow `troubleshooting.md` before doing anything else. Do not start the next item while the current one is broken.

## Item 1 — AGENTS.md and the questionnaire

1. Draft `AGENTS.md` from the code (template `templates/agents/AGENTS.md.tmpl`): stack, commands (install, dev, test, lint, build), folder layout, existing conventions you can observe (naming, test style, error handling, layering). Only verified facts: a command goes in only if it exists in the repo; anything you could not confirm is left as a visible `TODO:` line for the user, never guessed. Write the kit's content only inside `<!-- ai-kit:begin … -->` / `<!-- ai-kit:end … -->` blocks; never rewrite text outside them.
2. Create `CLAUDE.md` containing `@AGENTS.md` if Claude Code is used; for Copilot create `.github/copilot-instructions.md` that points to `AGENTS.md`; for Cursor add `.cursor/rules/agents.mdc` that points to `AGENTS.md`.
3. Ask quick (★ questions only, default for solo projects) or full. Then run the questionnaire from `questionnaire.md`, one category at a time. For each category show the questions that apply to the detected stack, each with your recommended answer pre-filled, and ask the user to change only what differs. Skip questions the code already answers clearly (say which ones you inferred, so the user can correct them).
4. Write the answers as short imperative rules in `AGENTS.md`. Every answer marked `Enforce:` with a mechanism available for this language becomes a check under item 2 — list them there.

## Phase 4 — repository settings

Collect every external setting the chosen items need (branch protection, required checks, CODEOWNERS review, secrets, Sonar project, app installs). Show them as one list with the exact `gh` commands or UI steps (`guides/github-settings.md`). Ask:

"These settings change the repository on <platform>. Shall I run the commands, show you the manual steps, or skip?"

Run commands only after a yes to that exact list. Secrets are always entered by the user, never by you. Record each setting with `kit.mjs setting done <name>` or `kit.mjs setting pending <name>`.

Decisions that need an external check are made here, not earlier: whether dependency review is available (private repo → GitHub Code Security), the current gitleaks version, rulesets availability on the plan. Earlier items use the safe default (no dependency-review job on private repos, pinned gitleaks version) and Phase 4 offers the upgrade.

## Phase 5 — final pass

1. Re-read `AGENTS.md`. Inside the kit's blocks: remove duplicates, group rules, keep it imperative and short. Outside the blocks: change nothing; if you see a conflict with a kit rule, point it out and ask.
2. Run the size check (item 3). If over budget, propose moving detail into skills or linked files.
3. Run every installed local check once (lint, hooks dry-run, kit scripts) and show the result. Fix only what the kit introduced; report anything else.
4. A CI step whose tool is not installed locally (Python tools without uv, Go without Go, a Docker-only linter) cannot run here, but existing code may fail it on the first PR. Run it in Docker when Docker is available (for example `docker run --rm -v "$PWD:/app" -w /app ghcr.io/astral-sh/uv:python3.12-bookworm-slim uv run ruff format --check .`). Otherwise list it under "check on the first PR" and say which existing files it is likely to flag.
5. Items whose files are still pending cannot be dry-run: list them under "verify after `kit.mjs pending apply`" instead of reporting them as failures.
6. Prove the guards work, with the user watching: run `node <skill-dir>/scripts/kit.mjs guard-test`. It sends sample tool calls (git push, `rm -rf ~/`, `--no-verify`, editing `.claude/settings.json`, reading `.env`) to every installed guard and prints each answer; it never runs the dangerous command itself. Do not pipe hand-written JSON into the hooks — the shell tools may refuse it.
7. Check pinned versions: `node <skill-dir>/scripts/kit.mjs outdated` (needs network; skip it offline and say so). The kit's templates carry the versions that were current at its release, so a newer one may exist already. Offer each MAJOR change only after reading its release notes, and minor ones as a single batch; after changing an action, run `pin-actions` again if item 48 is installed.
8. Print the summary described in SKILL.md, "Finishing".
