# Project memory

Durable facts that every developer's agent should know. Short, sourced, and kept current.

| Folder | What goes in | Template |
|---|---|---|
| `decisions/` | Architecture and tooling decisions: what, why, alternatives rejected | `_decision.md` |
| `lessons/` | Things learned the hard way: pitfalls, rules that came from bugs | `_lesson.md` |
| `debt/` | Known technical debt and what would fix it | `_lesson.md` (use "Debt" as type) |
| `incidents/` | What broke, root cause, what changed after | `_lesson.md` (use "Incident" as type) |

## Rules

- One fact per file, named `YYYY-MM-DD-short-slug.md`.
- Every entry names its source: PR, ticket, file, or person/role.
- Agents propose new entries and never write one without approval.
- When a fact changes, edit the entry and add a line `Superseded: <date> — <what changed>`; when it stops being true, delete the file in the same PR that makes it false.
- No secrets, customer names or personal data.
