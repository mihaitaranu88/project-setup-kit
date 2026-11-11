# Platforms

## GitHub — full support

Workflows in `templates/ci/github/`. Repository settings through `gh` (see `guides/github-settings.md`).

## GitLab, Bitbucket, Azure DevOps — guide only (v0.x)

The local parts (AGENTS.md, guards, hooks, lint config, scripts in `.ai-kit/scripts/`) work the same everywhere. For CI items, translate the GitHub workflow into the platform's format, show the result to the user and ask before writing it.

| GitHub | GitLab | Bitbucket | Azure DevOps |
|---|---|---|---|
| `.github/workflows/*.yml` | `.gitlab-ci.yml` (jobs with `rules: - if: $CI_PIPELINE_SOURCE == "merge_request_event"`) | `bitbucket-pipelines.yml` (`pull-requests:`) | `azure-pipelines.yml` (`pr:` trigger) |
| required status check | "Pipelines must succeed" | "Minimum successful builds" merge check | branch policy "Build validation" |
| CODEOWNERS | `CODEOWNERS` + "Code owner approval" | reviewers via merge checks | "Automatically included reviewers" policy |
| Dependabot | Renovate | Renovate | Renovate or Dependabot for Azure |
| dependency-review-action | `dependency_scanning` template (Ultimate) or `npm audit`/`pip-audit` jobs | audit jobs | audit jobs |
| PR title/body via `github-script` | `$CI_MERGE_REQUEST_TITLE`, `$CI_MERGE_REQUEST_DESCRIPTION` in a job | Bitbucket API in a pipe | `System.PullRequest.*` variables + REST |

Mark every translated file in `.ai-kit.json` with `"translated": true` so updates know it was adapted by hand.
