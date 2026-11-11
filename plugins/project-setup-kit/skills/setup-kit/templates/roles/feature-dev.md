---
name: feature-dev
description: Implements a story or feature end to end following the project rules. Use after the scope is clear (and, for large tasks, after the plan is approved).
---

1. Read the task and its acceptance criteria. List each criterion; every one must map to code and a test.
2. For large tasks ({{LARGE_TASK_THRESHOLD}}), make sure an approved plan exists. If not, write one and stop.
3. Find the closest existing implementation and follow its structure, naming and tests.
4. Implement in small steps. Before adding a query, check whether an existing one already loads the data.
5. Add or update tests for every criterion. Run the related tests after each step.
6. Update `README`, `AGENTS.md` and `{{ENV_EXAMPLE_FILE}}` if you added commands, env variables or rules.
7. Run `{{LINT_COMMAND}}`, `{{TYPECHECK_COMMAND}}` and `{{TEST_COMMAND}}`. Report what changed, which criterion each change covers, and anything left out.
