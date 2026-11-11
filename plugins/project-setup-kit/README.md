# project-setup-kit

Adds AI-agent files, agent guards, lint and CI checks to any repository, in any language. Run `/setup-kit`: the agent analyzes the project, skips what is already configured or does not apply, then goes through the remaining items one at a time. Each question comes with a recommendation and a reason, nothing is written without your consent, and after every change you review the files before moving on. Repository settings such as branch protection and secrets are collected into one final step that runs only after you approve it.

Answers are stored in `.ai-kit.json`, so `/setup-kit update`, `/setup-kit remove <id>` and `/setup-kit status` work later without asking again.

Requirements: Node.js 20+ for the guard and check scripts. Full documentation: see the repository README.
