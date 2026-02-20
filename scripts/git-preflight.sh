#!/usr/bin/env bash
set -euo pipefail

echo "[1/6] Verify git remote configuration"
git remote -v

echo
echo "[2/6] Verify remote reachability"
git ls-remote --symref origin HEAD >/dev/null
git ls-remote --heads origin >/dev/null
echo "origin reachable"

echo
echo "[3/6] Verify authentication"
gh auth status -h github.com >/dev/null
echo "gh auth ok"

echo
echo "[4/6] Refresh remote tracking refs"
git fetch --prune origin >/dev/null
echo "fetch/prune ok"

echo
echo "[5/6] Verify upstream tracking"
current_branch="$(git branch --show-current)"
if ! git rev-parse --abbrev-ref "@{upstream}" >/dev/null 2>&1; then
  echo "No upstream for ${current_branch}."
  echo "Set upstream with: git push -u origin ${current_branch}"
  exit 1
fi
git status -sb

echo
echo "[6/6] Dry-run push"
git push --dry-run origin "${current_branch}"

echo
echo "git preflight passed"
