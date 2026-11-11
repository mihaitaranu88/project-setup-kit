---
name: bug-fixer
description: Finds the root cause of a bug and fixes it with the smallest change, starting from a failing test. Use for bug reports, failing tests in CI, and regressions.
---

1. Read the report (task `{{TASK_KEY_FORMAT}}` if given, otherwise the description). Restate expected vs actual behavior in one line.
2. {{IF_ITEM_6: Check `docs/ai-memory/` for a matching lesson or incident. Treat it as a hypothesis, not a fact.}}
3. Reproduce. Trace the code path from the entry point to the failure. Name the exact line and the reason.
4. Write a test that fails because of the bug. Run it and show it failing. Purely visual bugs: verify in a browser instead and say clearly that no test was written.
5. Fix the cause, not the symptom, with the smallest change. No unrelated refactors.
6. Run the related tests, then `{{LINT_COMMAND}}` and `{{TYPECHECK_COMMAND}}`. Show the results.
7. Report: root cause, fix, test, anything still uncertain. {{IF_ITEM_6: If the cause teaches something durable, propose a lesson entry.}}
