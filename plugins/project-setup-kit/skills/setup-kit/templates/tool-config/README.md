# Wiring the guards per tool

All guards live in `.ai-kit/hooks/` and share `hook-io.mjs`, which reads each tool's payload and answers in that tool's format.

| Tool | Where | Template | Items |
|---|---|---|---|
| Claude Code | `.claude/settings.json` (merge; keep the user's keys) | `claude/settings.json` | 9 = PreToolUse git-guard, danger-guard, protect-guard · 10 = PreToolUse env-guard · 11 = `permissions.allow` · 36 = PostToolUse post-edit-check + Stop stop-check · 47 = PreToolUse deps-guard (Bash) |
| GitHub Copilot (CLI / coding agent) | `.github/hooks/*.json` | `copilot/*.json` | 9, 10, 47 |
| Cursor | `.cursor/hooks.json` | `cursor/hooks.json` | 9, 10, 47 (experimental: check the current Cursor hooks docs before installing) |

Decisions: git-guard and env-guard always deny. deps-guard asks only for a package the registry does not know, one published in the last days or one with very few downloads; when the registry cannot be reached it lets the command through (the CI check catches it later). danger-guard and protect-guard answer `ask` by default (Claude Code and Cursor show an approval prompt to the developer); Copilot has no ask, so they deny there. Set `mode: "deny"` in `.ai-kit/config.json` for unattended runs.

Keep only the entries for guards that are installed: a hook pointing at a missing script fails on every tool call. deps-guard (item 47) is listed in the templates but is installed only with item 47.

Install the hooks into the project's `.claude/settings.json`, not through a plugin's `hooks/hooks.json`: plugin-installed Stop hooks have had bugs with exit code 2, and the same hook in both places runs twice.

stop-check exits early when `stop_hook_active` is true, so it forces at most one extra round before the agent may stop.

Permission rules use the current syntax: `Bash(cmd)` for the exact command and `Bash(cmd *)` for the command with arguments (the older `Bash(cmd:*)` form is deprecated).

Copy only the blocks for the items the user accepted. Replace `{{…}}` placeholders in `permissions.allow` with the project's real commands and drop the lines that do not apply.

Never add `Read(.env*)` to `permissions.deny`: deny rules win over allow rules, so it would also block `.env.example`. The env guard handles the allowlist.

File paths in hook and ratchet commands are quoted for the platform (`'…'` on macOS/Linux, `"…"` on Windows). On Windows, Claude Code runs hook commands through Git Bash when it is installed; keep the `node "$CLAUDE_PROJECT_DIR/…"` form, which works in both.
