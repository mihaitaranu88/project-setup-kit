---
description: Implement a story end to end from a task key or a description
argument-hint: "<task key or story description>"
---

Implement: $ARGUMENTS

Stop for confirmation at every step marked (ask).

1. Read the story. {{IF_TASK_APP: If the argument looks like a task key ({{TASK_KEY_FORMAT}}), fetch it with the {{TASK_APP}} tool.}} List the acceptance criteria as a checklist.
2. Propose a branch `feat/{{BRANCH_KEY_PART}}<short-description>` from `{{BASE_BRANCH}}` (ask). Create it with `git switch -c <branch> --no-track {{BASE_BRANCH}}`.
3. If the task is large ({{LARGE_TASK_THRESHOLD}}), write a short plan — what changes, which files, how it is tested — and wait (ask).
4. Implement following the closest existing example in the repo. Add tests for every criterion.
5. Update `README`, `AGENTS.md`, `{{ENV_EXAMPLE_FILE}}` if commands, env variables or rules changed.
6. Run `{{LINT_COMMAND}}`, `{{TYPECHECK_COMMAND}}`, `{{TEST_COMMAND}}`.
7. Report each criterion with where it is implemented and tested. Offer a commit message; the developer commits.
