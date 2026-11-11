---
description: Go through unresolved PR review comments, propose fixes, apply the approved ones
argument-hint: "[PR number]"
---

PR: $ARGUMENTS (if empty, use `gh pr view --json number -q .number` for the current branch).

1. Fetch unresolved review threads and comments:
   `gh api graphql -f query='query($o:String!,$r:String!,$n:Int!){repository(owner:$o,name:$r){pullRequest(number:$n){reviewThreads(first:100){nodes{isResolved isOutdated path line comments(first:20){nodes{author{login} body url}}}}}}}' -F o=<owner> -F r=<repo> -F n=<pr>`
   plus `gh pr view <pr> --comments` for PR-level comments. Skip resolved threads.
2. For each finding, in order of severity: quote it in one line, read the code, then say if it is valid. If valid, propose the minimal fix. If not, draft a one-sentence reply explaining why.
3. Show the full list and wait for the developer to approve which fixes to apply.
4. Apply only the approved fixes. Run the related tests, `{{LINT_COMMAND}}` and `{{TYPECHECK_COMMAND}}`.
5. Print the reply text for each thread (one short sentence each). Post replies or resolve threads only if the developer asks.
