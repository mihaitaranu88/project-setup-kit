# Changelog

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
