---
description: Check the branch is ready and prepare the PR
---

1. Run `git status` and `git branch --show-current`. Stop if the tree is dirty or the branch is `{{BASE_BRANCH}}`.
2. Run the same checks as CI: `{{LINT_COMMAND}}`, `{{TYPECHECK_COMMAND}}`, `{{TEST_COMMAND}}`, `{{BUILD_COMMAND}}`. On failure show the output and offer to fix.
3. Show `git diff --stat {{BASE_BRANCH}}...HEAD` and `git log --oneline {{BASE_BRANCH}}..HEAD`.
4. Draft the PR title ({{PR_TITLE_RULE}}) and body from `.github/pull_request_template.md`, filled in from the diff and the task.
5. Give the developer the exact commands to push and open the PR (`git push -u origin <branch>`, `gh pr create --draft --title … --body-file …`). Run them only if the developer explicitly asks you to in this session.
