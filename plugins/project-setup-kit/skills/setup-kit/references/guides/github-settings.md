# Guide: repository settings (Phase 4)

Collect all settings first, show the list, and run nothing until the user approves the exact list. Secrets are always typed by the user.

## Check access

`gh auth status` and `gh api repos/{owner}/{repo} --jq .permissions.admin` must be `true` to change protection. If not, print the manual steps for an admin.

## Required checks + code owners (ruleset, preferred)

```sh
gh api repos/{owner}/{repo}/rulesets -X POST --input ruleset.json
```

`ruleset.json`:

```json
{
  "name": "protect-{{BASE_BRANCH}}",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["refs/heads/{{BASE_BRANCH}}"], "exclude": [] } },
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": {{APPROVALS}},
        "require_code_owner_review": {{CODE_OWNER_REVIEW}},
        "dismiss_stale_reviews_on_push": true,
        "require_last_push_approval": false,
        "required_review_thread_resolution": true
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": false,
        "required_status_checks": [{{REQUIRED_CHECK_CONTEXTS}}]
      }
    }
  ]
}
```

Solo repositories: set `required_approving_review_count` to `0` and `require_code_owner_review` to `false` (GitHub does not let you approve your own PR, so any other value blocks every merge); keep required status checks.

`REQUIRED_CHECK_CONTEXTS` are the job names as they appear on a PR, e.g. `{ "context": "node" }`. Run the workflows once on a PR first so the names exist. Never add the AI review as required.

Manual path: Settings → Rules → Rulesets → New branch ruleset, same options.

## Secrets

`gh secret set <NAME>` prompts for the value. Names used by the kit: `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN` (22), `SONAR_TOKEN` (23), `PREVIEW_DEPLOY_TOKEN` (46).

## Variables

`gh variable set AI_REVIEW_ENABLED --body true`, `gh variable set AI_REVIEW_DEBOUNCE_SECONDS --body 120`.

## Security features

- Secret scanning + push protection: Settings → Code security → enable both (free on public repos; private repos need GitHub Secret Protection).
- Dependabot alerts and security updates: same page.

Record each done setting in `.ai-kit.json` under `settings.done`, the rest under `settings.pending`.
