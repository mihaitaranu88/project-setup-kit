---
type: llm
---

The project was set up with kit 0.3.0 and every one of items 1–46 already has an answer in .ai-kit.json.
PASS if the final message (1) treats this as an update from 0.3.0, (2) names at least two of the items added in 0.4.0 (new-dependency check, GitHub Actions hardening, cloud agent environment, one verify command, container scanning), (3) mentions an update for the existing CI workflow (newer action versions or its security fixes such as persist-credentials), and (4) asks the user before changing anything.
FAIL if it starts the questionnaire again, asks about items that already have an answer as if they were new, or says it already changed files.
