#!/usr/bin/env bash
set -euo pipefail
bash "$(dirname "$0")/../lib/prepare.sh" ts-app
cat > .ai-kit.json <<'JSON'
{
  "kitVersion": "0.2.0",
  "updatedAt": "2026-11-01",
  "context": {
    "aiTools": [
      "claude"
    ],
    "platform": "github",
    "projectAge": "existing",
    "team": true,
    "parts": [
      {
        "path": ".",
        "language": "typescript",
        "packageManager": "npm",
        "frontend": true
      }
    ]
  },
  "items": {
    "1": {
      "state": "installed",
      "files": [
        "AGENTS.md",
        "CLAUDE.md"
      ]
    },
    "6": {
      "state": "declined",
      "date": "2026-11-01"
    },
    "21": {
      "state": "installed",
      "files": [
        ".github/workflows/ci.yml"
      ]
    },
    "46": {
      "state": "not-applicable",
      "reason": "no backend split"
    }
  },
  "files": {
    "AGENTS.md": {
      "hash": "merged",
      "items": [
        "1"
      ]
    },
    "CLAUDE.md": {
      "hash": "sha256:0",
      "items": [
        "1"
      ]
    },
    ".github/workflows/ci.yml": {
      "hash": "sha256:0",
      "items": [
        "21"
      ]
    }
  },
  "settings": {
    "done": [
      "required-check:ci"
    ],
    "pending": [
      "secret:SONAR_TOKEN"
    ]
  }
}
JSON
mkdir -p .github/workflows
printf 'name: CI\non: pull_request\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n' > .github/workflows/ci.yml
printf '# Rules\n' > AGENTS.md
printf '@AGENTS.md\n' > CLAUDE.md
node -e 'const fs=require("fs"),c=require("crypto");const s=JSON.parse(fs.readFileSync(".ai-kit.json","utf8"));for(const f of Object.keys(s.files)){if(s.files[f].hash!=="merged")s.files[f].hash="sha256:"+c.createHash("sha256").update(fs.readFileSync(f)).digest("hex");}fs.writeFileSync(".ai-kit.json",JSON.stringify(s,null,2)+"\n")'
git add -A
git -c user.email=eval@example.invalid -c user.name=kit-eval commit -q -m kit
