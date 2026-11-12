---
type: llm
---

The project was set up with kit 0.3.0; items 1 and 21 are installed and every other item already has an answer in .ai-kit.json.
PASS if the final message (1) treats this as an update from 0.3.0 to a newer kit, (2) proposes at least one concrete change from the newer versions: either an update to the existing CI workflow (newer action versions or security fixes such as persist-credentials) or one of the items added in 0.4.0 (new-dependency check, GitHub Actions hardening, cloud agent environment, one verify command, container scanning), and (3) asks the user before changing anything. Presenting one change at a time is correct.
FAIL if it starts the questionnaire again, re-asks items that already have an answer as if they were new, or says it already changed files.
