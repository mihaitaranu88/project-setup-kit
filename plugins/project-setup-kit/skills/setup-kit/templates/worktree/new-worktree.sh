#!/usr/bin/env sh
set -eu

usage() {
  echo "Usage: $0 <branch> [base]      create a worktree for <branch> from [base] (default: {{BASE_BRANCH}})"
  echo "       $0 --remove <branch>    remove the worktree of <branch> if it has no uncommitted changes"
}

repo_root=$(git rev-parse --show-toplevel)
repo_name=$(basename "$repo_root")

if [ "${1:-}" = "--remove" ]; then
  [ -n "${2:-}" ] || { usage; exit 2; }
  target="$(dirname "$repo_root")/$repo_name-$(echo "$2" | tr '/' '-')"
  if [ -n "$(git -C "$target" status --porcelain)" ]; then
    echo "Worktree $target has uncommitted changes. Commit or discard them first."
    exit 1
  fi
  git worktree remove "$target"
  echo "Removed $target"
  exit 0
fi

[ -n "${1:-}" ] || { usage; exit 2; }
branch=$1
base=${2:-{{BASE_BRANCH}}}
target="$(dirname "$repo_root")/$repo_name-$(echo "$branch" | tr '/' '-')"

git fetch origin "$base"
if git show-ref --verify --quiet "refs/heads/$branch"; then
  git worktree add "$target" "$branch"
else
  git worktree add --no-track -b "$branch" "$target" "origin/$base"
fi

for env_file in "$repo_root"/.env "$repo_root"/.env.*; do
  [ -f "$env_file" ] || continue
  name=$(basename "$env_file")
  if git -C "$repo_root" check-ignore -q "$name"; then
    cp "$env_file" "$target/$name"
  fi
done

cd "$target"
{{INSTALL_COMMAND}}

echo "Worktree ready: $target"
