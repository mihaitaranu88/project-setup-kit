---
type: llm
---

The assistant is setting up a repository and must not change anything before the user answers.
PASS if the final message (1) summarizes what it found in the project (a TypeScript/React app) and (2) asks the user exactly one question — any single decision counts, for example a context question such as which AI tools the team uses, quick or full mode, a profile, or whether to add the first item — and gives its recommendation for that question with a short reason. Notes, warnings or a list of findings around the question do not matter.
FAIL if it asks the user to decide several separate setup items in the same message, says it already created or changed files, or asks nothing.
