# Guide: AI review on PRs (item 22)

Ask which provider, then follow only that section. Wait for the user at each step marked (user).

## Claude with an API key (pay per use)

1. (user) Create a key at console.anthropic.com → API Keys. Set a monthly spend limit there.
2. (user) Repository → Settings → Secrets and variables → Actions → New repository secret: `ANTHROPIC_API_KEY`. Or: `gh secret set ANTHROPIC_API_KEY` and paste when asked. Never paste the key into the chat.
3. Install the Claude GitHub app on the repo: https://github.com/apps/claude (or run `/install-github-app` in Claude Code, which also does steps 2–4).
4. Write `.github/workflows/ai-review.yml` from the template (input `anthropic_api_key`).

## Claude with a Pro/Max subscription

1. (user) Run `claude setup-token` locally; it prints a long-lived token.
2. (user) Save it as secret `CLAUDE_CODE_OAUTH_TOKEN` (`gh secret set CLAUDE_CODE_OAUTH_TOKEN`).
3. Install the Claude GitHub app (as above).
4. In the workflow replace `anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}` with `claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}`.

## GitHub Copilot

Needs a Copilot plan that includes code review. (user) Repository → Settings → Rules → Rulesets → new branch ruleset → "Automatically request Copilot code review". No workflow file is needed; put review rules in `.github/copilot-instructions.md` (it points to `AGENTS.md`).

## CodeRabbit

Free for public repositories, paid for private ones. (user) Install the CodeRabbit app from GitHub Marketplace on the repo. Add `.coderabbit.yaml` with `reviews.path_instructions` pointing to the rules in `AGENTS.md`.

## Tuning (all Claude variants)

- Repository variables: `AI_REVIEW_ENABLED=false` pauses reviews; `AI_REVIEW_DEBOUNCE_SECONDS` (default 120) waits after a push so several quick pushes cost one review.
- Sensitive paths for the security pass: set `{{SENSITIVE_PATHS_REGEX}}` in the workflow, e.g. `(auth|permission|security|guard|policy|middleware|repositor|sql|upload|crypto|secret)`.
- The review is advisory. Do not make it a required check.
