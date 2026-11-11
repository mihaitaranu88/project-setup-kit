#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
{{SETUP_COMMANDS}}
echo "Agent environment ready. Verify with: {{VERIFY_COMMAND}}"
