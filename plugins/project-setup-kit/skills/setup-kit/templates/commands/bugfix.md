---
description: Fix a bug from a task key or a description, starting with a failing test
argument-hint: "<task key or bug description>"
---

Fix this bug: $ARGUMENTS

Stop for confirmation at every step marked (ask).

1. Read the bug. {{IF_TASK_APP: If the argument looks like a task key ({{TASK_KEY_FORMAT}}), fetch it with the {{TASK_APP}} tool and read summary, steps, expected and actual.}} Restate expected vs actual in one line.
2. Propose a branch `fix/{{BRANCH_KEY_PART}}<short-description>` from `{{BASE_BRANCH}}` (ask). Create it with `git switch -c <branch> --no-track {{BASE_BRANCH}}`.
3. Find the root cause: trace from the entry point to the failing line. Explain it in two sentences.
4. Write a test that fails because of the bug and show it failing. Purely visual bug: verify in a browser and say no test was written.
5. Fix the cause with the smallest change. Show the diff (ask).
6. Run the related tests, `{{LINT_COMMAND}}` and `{{TYPECHECK_COMMAND}}`. Fix anything you broke.
7. Summarize: cause, fix, test, files changed. Offer a commit message; the developer commits.
