#!/usr/bin/env bash
set -euo pipefail
bash "$(dirname "$0")/../lib/prepare.sh" ts-app
cat > .ai-kit.json <<'JSON'
{
  "kitVersion": "0.3.0",
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
    "2": {
      "state": "declined"
    },
    "3": {
      "state": "declined"
    },
    "4": {
      "state": "declined"
    },
    "5": {
      "state": "declined"
    },
    "6": {
      "state": "declined"
    },
    "7": {
      "state": "declined"
    },
    "8": {
      "state": "declined"
    },
    "9": {
      "state": "declined"
    },
    "10": {
      "state": "declined"
    },
    "11": {
      "state": "declined"
    },
    "12": {
      "state": "declined"
    },
    "13": {
      "state": "declined"
    },
    "14": {
      "state": "declined"
    },
    "15": {
      "state": "declined"
    },
    "16": {
      "state": "declined"
    },
    "17": {
      "state": "declined"
    },
    "18": {
      "state": "declined"
    },
    "19": {
      "state": "declined"
    },
    "20": {
      "state": "not-applicable"
    },
    "21": {
      "state": "installed",
      "files": [
        ".github/workflows/ci.yml"
      ]
    },
    "22": {
      "state": "declined"
    },
    "23": {
      "state": "declined"
    },
    "24": {
      "state": "declined"
    },
    "25": {
      "state": "declined"
    },
    "26": {
      "state": "declined"
    },
    "27": {
      "state": "declined"
    },
    "28": {
      "state": "declined"
    },
    "29": {
      "state": "declined"
    },
    "30": {
      "state": "declined"
    },
    "31": {
      "state": "declined"
    },
    "32": {
      "state": "declined"
    },
    "33": {
      "state": "declined"
    },
    "34": {
      "state": "declined"
    },
    "35": {
      "state": "declined"
    },
    "36": {
      "state": "declined"
    },
    "37": {
      "state": "declined"
    },
    "38": {
      "state": "declined"
    },
    "39": {
      "state": "declined"
    },
    "40": {
      "state": "declined"
    },
    "41": {
      "state": "declined"
    },
    "42": {
      "state": "not-applicable"
    },
    "43": {
      "state": "not-applicable"
    },
    "44": {
      "state": "not-applicable"
    },
    "45": {
      "state": "not-applicable"
    },
    "46": {
      "state": "declined"
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
    "pending": []
  }
}
JSON
mkdir -p .github/workflows
printf 'name: CI\non:\n  pull_request:\npermissions:\n  contents: read\njobs:\n  web:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with:\n          node-version: 22\n          cache: npm\n      - run: npm ci\n      - run: npm test\n' > .github/workflows/ci.yml
printf '# Rules\n\n<!-- ai-kit:begin rules -->\n## Working rules\n\n- Never use any.\n<!-- ai-kit:end rules -->\n' > AGENTS.md
printf '@AGENTS.md\n' > CLAUDE.md
node -e 'const fs=require("fs"),c=require("crypto");const s=JSON.parse(fs.readFileSync(".ai-kit.json","utf8"));for(const f of Object.keys(s.files)){if(s.files[f].hash!=="merged")s.files[f].hash="sha256:"+c.createHash("sha256").update(fs.readFileSync(f)).digest("hex");}fs.writeFileSync(".ai-kit.json",JSON.stringify(s,null,2)+"\n")'
git add -A
git -c user.email=eval@example.invalid -c user.name=kit-eval commit -q -m kit
