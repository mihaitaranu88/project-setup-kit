# Contributing

Issues and pull requests are welcome.

## Setup

Node.js 20 or newer. No dependencies to install.

```sh
npm run check   # consistency check + script tests (runs on Linux, Windows and macOS in CI)
npm run eval         # claude plugin eval: every case 3 times with and without the plugin (uses tokens, ~$15)
npm run eval:quick   # one run per case, plugin only (~$3)
npm run eval:guards  # 7 guard scenarios in a real Claude Code session (~$1.20)
npm run lint-workflows  # actionlint + zizmor on the rendered workflow templates (needs Docker)
npm run freshness    # are the actions, images and MCP packages pinned in the templates still the latest?
npm run build-evals  # regenerate plugins/project-setup-kit/evals/ after editing tests/fixtures/*/expected.json
```

## Where things live

| Path | What |
|---|---|
| `plugins/project-setup-kit/skills/setup-kit/SKILL.md` | Entry point the agent reads |
| `…/references/` | Flow, catalog of the 51 items, detection, languages, questionnaire, profiles, troubleshooting, guides |
| `…/templates/` | Files copied into projects: guards, check scripts, CI workflows, lint configs, roles, commands |
| `…/scripts/kit.mjs` | The kit's own state tool (`.ai-kit.json`, config sections, pending files, guard tests) |
| `bin/cli.mjs` | `npx` entry for Copilot/Cursor users and guard-only installs |
| `tests/fixtures/` | Small projects with the analysis each should produce (`expected.json`) |

## Changing the kit

- A new item or a changed rule goes into `references/catalog.md`, `references/profiles.md` and, if the user needs a step-by-step, a guide. `npm run check` fails when the catalog, profiles or templates disagree.
- Scripts copied into projects (`templates/guards`, `templates/checks`) must stay dependency-free, run on Node 20+ and work on Windows; add a test in `tests/scripts/`.
- Keep the user-facing behavior: one item at a time, a recommendation with a reason, nothing written without consent, never weaken a check to get past an error.
- Add an entry to `CHANGELOG.md`; `/setup-kit update` reads it to explain what changed.
