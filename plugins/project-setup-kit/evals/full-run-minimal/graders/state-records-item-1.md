---
type: regex
pattern: '"1"\s*:\s*\{(?:[^{}]|\{[^{}]*\})*"state"\s*:\s*"installed"'
target: {source: file, path: .ai-kit.json}
---
