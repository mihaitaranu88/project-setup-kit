# Profiles

A profile answers most items in advance so the user does not go through 51 questions. It never skips consent: the agent shows the whole plan once, the user changes what they want, and every item still ends with the usual file review.

| Profile | For | Questionnaire |
|---|---|---|
| `minimal` | solo projects, prototypes, first try of the kit | quick (★) |
| `team` | shared repositories with pull requests and reviews | quick (★), full on request |
| `strict` | production code, regulated or client work, many contributors | full |
| `custom` | anything else: the normal one-by-one flow | asked at item 1 |

Legend: `yes` = install with the recommended defaults · `no` = skip (recorded as `declined`, offered again by `update --all`) · `ask` = still asked one by one (it costs money, needs an account, or depends on a choice only the user can make). Items that do not apply or already exist are skipped whatever the profile says.

| # | Item | minimal | team | strict |
|---|---|---|---|---|
| 1 | `AGENTS.md` + questionnaire | yes | yes | yes |
| 2 | Checks for checkable rules | yes | yes | yes |
| 3 | Instruction size budget | yes | yes | yes |
| 4 | Agent docs consistency | no | yes | yes |
| 5 | Docs updated in the same PR | yes | yes | yes |
| 6 | Team memory + decisions | no | yes | yes |
| 7 | Plan before code | no | yes | yes |
| 8 | Bug fix starts with a failing test | yes | yes | yes |
| 9 | Git, destructive and self-protection guards | yes | yes | yes, with the `installs` pack |
| 10 | `.env` guard | yes | yes | yes |
| 11 | Safe-command allowlist | yes | yes | yes |
| 12 | CODEOWNERS for agent files | no | yes | yes |
| 13 | Pre-commit on staged files | yes | yes | yes |
| 14 | Strict types | ask | yes | yes |
| 15 | Anti "AI slop" lint + precheck | yes | yes | yes, with typed rules |
| 16 | Lint ratchet + warning budget | ask | yes | yes |
| 17 | Accessibility lint | no | yes | yes |
| 18 | `.editorconfig` + `.gitattributes` | yes | yes | yes |
| 19 | Lockfile drift warning | no | yes | yes |
| 20 | Env validation at startup | no | yes | yes |
| 21 | Base CI as required check | yes | yes | yes |
| 22 | AI review on PRs | no | ask | ask |
| 23 | Sonar / coverage + duplication | no | ask | yes (coverage + duplication without Sonar; Sonar asked) |
| 24 | Dead-code detection | no | yes | yes |
| 25 | Large-PR warning | no | yes | yes |
| 26 | Bundle size | no | ask | yes |
| 27 | Secret scanning | yes | yes | yes |
| 28 | Vulnerable dependencies | yes | yes | yes, as a required check |
| 29 | Dependabot / Renovate | yes | yes | yes |
| 30 | License check | no | ask | yes |
| 31 | Task app connection | ask | ask | ask |
| 32 | Slash commands | no | yes | yes |
| 33 | Agent roles | no | yes | yes |
| 34 | Domain skills | no | ask | ask |
| 35 | Shared `.mcp.json` | no | ask | ask |
| 36 | Post-edit and stop checks | yes | yes | yes |
| 37 | Worktree per task | no | no | ask |
| 38 | Branch names | no | yes | yes |
| 39 | Commit and PR title format | no | yes | yes |
| 40 | PR template + required sections | no | yes | yes |
| 41 | Automatic releases | no | ask | ask |
| 42 | Remote database guard | yes | yes | yes |
| 43 | Migration checks | yes | yes | yes |
| 44 | Endpoint protection report | no | yes | yes |
| 45 | OpenAPI + contract check | no | ask | ask |
| 46 | Frontend previews | no | ask | ask |
| 47 | New-dependency check | yes | yes | yes, deny mode and `failOnWarn` |
| 48 | GitHub Actions hardening | no | yes | yes |
| 49 | Cloud agent environment | ask | ask | ask |
| 50 | One verify command | yes | yes | yes |
| 51 | Container and infrastructure scanning | no | yes | yes |

`strict` also sets: the prefix budget check to `--strict` in CI, the warning budget as a required check, and `dangerGuard.mode` stays `ask` (never weaker).

## How the agent uses a profile

1. After Phase 2, offer: "Pick a profile: minimal, team, strict, or custom (one by one)", with a recommendation from the context (solo → minimal, team → team, client/production → strict).
2. Build the plan: for every remaining item take the profile's answer. Show it grouped as "Will install (N)", "Will ask (N)", "Will skip (N)". Ask: "Change anything?" and apply the changes.
3. Go through "Will install" like a group accept: no question per item, but the file review after each item is still mandatory.
4. Ask the "Will ask" items one by one as usual.
5. Record the skipped ones with `kit.mjs state <id> declined --note "profile <name>"` and the profile with `kit.mjs context '{"profile":"<name>"}'`.
