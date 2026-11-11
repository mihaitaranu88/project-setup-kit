# Contributing

Issues and pull requests are welcome.

## Setup

Node.js 20 or newer. No dependencies to install.

```sh
npm run check   # consistency check + script tests (runs on Linux, Windows and macOS in CI)
npm run eval    # runs the skill's analysis on every fixture with Claude Code (uses tokens)
```

## Where things live

| Path | What |
|---|---|
| `plugins/project-setup-kit/skills/setup-kit/SKILL.md` | Entry point the agent reads |
| `…/references/` | Flow, catalog of the 46 items, detection, languages, questionnaire, profiles, troubleshooting, guides |
| `…/templates/` | Files copied into projects: guards, check scripts, CI workflows, lint configs, roles, commands |
| `…/scripts/kit.mjs` | The kit's own state tool (`.ai-kit.json`, config sections, pending files, guard tests) |
| `bin/cli.mjs` | `npx` entry for Copilot/Cursor users and guard-only installs |
| `tests/fixtures/` | Small projects with the analysis each should produce (`expected.json`) |

## Changing the kit

- A new item or a changed rule goes into `references/catalog.md`, `references/profiles.md` and, if the user needs a step-by-step, a guide. `npm run check` fails when the catalog, profiles or templates disagree.
- Scripts copied into projects (`templates/guards`, `templates/checks`) must stay dependency-free, run on Node 20+ and work on Windows; add a test in `tests/scripts/`.
- Keep the user-facing behavior: one item at a time, a recommendation with a reason, nothing written without consent, never weaken a check to get past an error.
- Add an entry to `CHANGELOG.md`; `/setup-kit update` reads it to explain what changed.
