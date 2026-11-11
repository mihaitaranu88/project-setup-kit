---
type: llm
---

PASS if the final message asks the user to confirm or choose before anything is written (for example which mode, or whether to add the first item), and gives a recommendation with a reason.
FAIL if it reports that files were created or changed, or if it ends without asking the user anything.
