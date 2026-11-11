# `.ai-kit.json`

Committed at the repo root. It is the kit's memory of this project: what was asked, what was answered, which files belong to which item.

```json
{
  "kitVersion": "0.3.0",
  "updatedAt": "2026-11-10",
  "context": {
    "aiTools": ["claude", "copilot"],
    "platform": "github",
    "projectAge": "existing",
    "team": true,
    "node": true,
    "newProject": false,
    "plannedStack": null,
    "parts": [
      { "path": "web", "language": "typescript", "packageManager": "npm", "frontend": true },
      { "path": "api", "language": "php", "packageManager": "composer", "api": true, "db": true }
    ]
  },
  "items": {
    "1": { "state": "installed", "answers": { "agentMayCommit": false }, "files": ["AGENTS.md", "CLAUDE.md"] },
    "21": { "state": "installed", "files": [".github/workflows/ci.yml"] },
    "24": { "state": "installed", "files": [".github/workflows/ci.yml", "knip.json"] },
    "6": { "state": "declined", "date": "2026-11-10" },
    "23": { "state": "existing", "note": "sonar-project.properties found" },
    "46": { "state": "not-applicable", "reason": "no frontend" }
  },
  "files": {
    "AGENTS.md": { "hash": "merged", "items": ["1"] },
    "CLAUDE.md": { "hash": "sha256:…", "items": ["1"] },
    ".github/workflows/ci.yml": { "hash": "sha256:…", "items": ["21", "24"] },
    "knip.json": { "hash": "sha256:…", "items": ["24"] }
  },
  "settings": {
    "done": ["required-check:ci"],
    "pending": ["secret:SONAR_TOKEN"]
  }
}
```

States: `installed`, `declined`, `existing`, `partial` (with `missing`), `not-applicable`, `pending` (asked but not finished, or postponed with a `note` such as "no code yet" in a new project).

## Hashes

Each item lists its paths in `items.<id>.files`. The top-level `files` map holds one entry per path: the SHA-256 right after the kit last wrote it, and every item that touched it (shared files such as `ci.yml`, `security.yml` or `.ai-kit/config.json`). For files the kit only merged into (an existing ESLint config, a team-written `AGENTS.md`) the hash is `"merged"`. Use `scripts/kit.mjs install` / `record` to keep this map correct instead of editing it by hand; `kit.mjs verify` lists files that changed since.

## Update

1. Compare `kitVersion` with the plugin version. List the items whose templates changed since then (`CHANGELOG.md` of the kit).
2. For each changed item: if the current file hash equals the recorded hash, the user has not touched it — propose the new version with a diff. If it differs, show both diffs (kit change and user change) and ask how to merge. Never overwrite silently.
   For `AGENTS.md` (and any file with `ai-kit:begin/end` markers) update only the content between the markers; text outside them is the team's. If the markers were removed, append the new blocks at the end instead of rewriting the file.
3. Offer items that are `pending`, never asked, or newly added to the catalog. If `context.newProject` is true and the folder now has code, run Phase 1 again first, compare with `plannedStack`, and replace the `TODO:` lines in `AGENTS.md` with the real commands.
4. Items `declined` are not asked again unless the user runs `/setup-kit update --all`.

## Remove

`/setup-kit remove <id>`: show the files and settings recorded for the item. A file shared with another installed item is not deleted: remove only this item's part (show the diff). On confirmation delete files owned only by this item, revert merged blocks (show the diff), remove the item's rule from `AGENTS.md`, update `files`, and set the state to `declined`.

## Session notice

With the Claude Code plugin, a `SessionStart` hook reads `.ai-kit.json` when a session starts and tells the user, in one or two lines, when the installed kit is newer than `kitVersion` or when files wait in `.ai-kit/pending/`. It never changes anything and says nothing for projects without `.ai-kit.json`. Set `"settings": { "sessionNotice": false }` to turn it off for a project.
