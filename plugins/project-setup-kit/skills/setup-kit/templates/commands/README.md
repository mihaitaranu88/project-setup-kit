# Commands (item 32) and roles (item 33)

| Tool | Commands go to | Roles go to | Notes |
|---|---|---|---|
| Claude Code | `.claude/commands/<name>.md` | `.claude/agents/<name>.md` | Use as is; `$ARGUMENTS` is supported. |
| GitHub Copilot | `.github/prompts/<name>.prompt.md` | `.github/agents/<name>.agent.md` | Rename frontmatter: commands keep `description`; replace `$ARGUMENTS` with `${input:args}`. |
| Cursor | `.cursor/commands/<name>.md` | — | Plain markdown; remove the frontmatter. |

Before writing: replace every `{{…}}` with the project's real commands, base branch, task key format and thresholds. Remove `{{IF_TASK_APP: …}}` blocks when there is no task app (item 31 = none), otherwise keep their content. Same for `{{IF_ITEM_n: …}}`: keep the content only when item n is installed. `{{ENV_EXAMPLE_FILE}}` is the project's real example env file name. `{{BRANCH_KEY_PART}}` is `<key>-` with a task app and empty without one. When removing a block leaves a numbered step empty, delete the step and renumber the list.

The commands never commit, push, merge or post comments on their own. They prepare the exact commands and wait for the developer, which matches the git guard (item 9).
