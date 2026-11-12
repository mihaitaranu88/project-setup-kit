---
max_turns: 150
timeout_seconds: 1800
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit, "Bash(git:*)", "Bash(ls:*)", "Bash(cat:*)", "Bash(node:*)", "Bash(mkdir:*)"]
---

/setup-kit minimal

Automated test, no human: accept the minimal profile plan as you propose it and take your own recommendation for every question. Claude Code only, GitHub, solo project. Do not run npm install. Write and record the files, then print the final summary.
