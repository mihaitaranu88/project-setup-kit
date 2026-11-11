#!/usr/bin/env bash
set -euo pipefail
fixture="$1"
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source_dir="$here/../../../../tests/fixtures/$fixture"
if [ ! -d "$source_dir" ]; then echo "fixture not found: $source_dir" >&2; exit 1; fi
cp -R "$source_dir/." .
rm -f expected.json
if [ "${2:-}" != "--no-git" ]; then
  git init -q -b main
  git add -A
  git -c user.email=eval@example.invalid -c user.name=kit-eval commit -q --allow-empty -m fixture
fi
