# Agent environments (item 49)

Cloud agents start on an empty machine. One script, `.ai-kit/agent-setup.sh`, installs the project; every tool calls it, so local, CI and cloud agents get the same setup.

`{{SETUP_COMMANDS}}`: the install commands for every part, from the lockfile, never resolving new versions. Use what CI already runs (item 21). Examples:

| Stack | Commands |
|---|---|
| npm | `npm ci` |
| pnpm | `corepack enable && pnpm install --frozen-lockfile` |
| yarn | `corepack enable && yarn install --immutable` |
| uv | `uv sync --frozen` |
| poetry | `poetry install --no-interaction --sync` |
| composer | `composer install --no-interaction --prefer-dist` |
| Go | `go mod download` |
| Maven | `./mvnw -q -DskipTests dependency:go-offline` |
| Gradle | `./gradlew --no-daemon dependencies > /dev/null` |

Monorepo: one line per part, `(cd <part> && <command>)`. Add tool installs the project needs (for example `pipx install pre-commit`) only when they are not part of the image. Never put secrets in the script; cloud agents read them from the tool's own secret settings.

`{{VERIFY_COMMAND}}`: the single verify command from item 50, or the project's test command.

| Tool | File | How it runs the script |
|---|---|---|
| GitHub Copilot coding agent | `copilot-setup-steps.yml` → `.github/workflows/copilot-setup-steps.yml` | The job must be called `copilot-setup-steps`; it runs before the agent starts. Add the language setup actions the project needs (setup-python, setup-go, setup-java, setup-php) with the same versions as CI. |
| Cursor background agents | `cursor-environment.json` → `.cursor/environment.json` | `install` runs on every new agent machine. |
| Claude Code on the web | `claude-web-session-start.json` → merged into `.claude/settings.json` | A `SessionStart` hook that runs only when `CLAUDE_CODE_REMOTE` is `true`, so local sessions are not slowed down. The hook does not run in multi-repo sessions; there, tell the user to put `bash .ai-kit/agent-setup.sh` in the cloud environment's **Setup script** setting instead. |
| OpenAI Codex (cloud) | none | Tell the user to set the environment's setup script to `bash .ai-kit/agent-setup.sh` in the Codex environment settings. |
| Dev containers / Codespaces (optional) | `devcontainer.json` → `.devcontainer/devcontainer.json` | `postCreateCommand`. `{{DEVCONTAINER_IMAGE}}` is `typescript-node:22`, `python:3.12`, `php:8.3`, `go:1.23`, `java:21` (match the project's versions); `{{DEVCONTAINER_FEATURES}}` adds the other languages of a monorepo, or `{}`. |
