# Guide: frontend previews (item 46)

The workflow runs only when every changed file is under the frontend path, builds against the shared dev backend, posts one comment with the link and deletes the preview when the PR closes.

## Cloudflare Pages (free tier)

1. (user) Create a Pages project (Direct Upload) in the Cloudflare dashboard; note the project name.
2. (user) Create an API token with "Cloudflare Pages: Edit"; save as secret `PREVIEW_DEPLOY_TOKEN`; add `CLOUDFLARE_ACCOUNT_ID` as a repository variable.
3. Deploy command: `npx wrangler pages deploy <build dir> --project-name <name> --branch "$PREVIEW_NAME"`, then write `url=https://$PREVIEW_NAME.<name>.pages.dev` to `$GITHUB_OUTPUT`. Token variable: `CLOUDFLARE_API_TOKEN`.
4. Cleanup: previews expire on their own; leave the cleanup job out or delete deployments through the API.

## Netlify

Token variable `NETLIFY_AUTH_TOKEN`, site id as a variable. Deploy: `npx netlify deploy --dir <build dir> --alias "$PREVIEW_NAME" --json`, read `deploy_url` from the JSON into the `url` output.

## Vercel

The Vercel GitHub integration creates previews for every PR on its own. To limit them to frontend-only PRs, set the project's "Ignored Build Step" to a command that exits 0 when no frontend file changed. No workflow needed.

## Own server or bucket

Upload the build to `<bucket>/pr-<n>/` (e.g. `aws s3 sync`, `rsync`) behind a static host; the cleanup job deletes the folder. Cost is storage only.

Ask the user for the API base URL variable name and the shared dev backend URL; the backend must allow the preview origin (CORS).
