---
max_turns: 40
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, "Bash(git:*)", "Bash(ls:*)", "Bash(cat:*)", "Bash(node:*)"]
---

/setup-kit

Automated evaluation, no human. Do Phase 0 and Phase 1 only (Phase 0b for an empty folder: report it, do not choose an option). Write nothing.
Then print exactly one JSON object in a ```json fenced block, with this shape and nothing else after it:
{"mode": "existing" | "new-project",
 "parts": [{"path": "<folder>", "language": "<typescript|javascript|python|php|go|java|kotlin|csharp|ruby|rust|...>"}],
 "has": {"frontend": bool, "api": bool, "db": bool, "severalServices": bool, "versionedReleases": bool},
 "alreadyConfigured": [<item ids>],
 "notApplicable": [<item ids>]}
