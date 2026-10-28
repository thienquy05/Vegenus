#!/usr/bin/env bash
# Fails if a test is focused or skipped (.only / .skip), so no test is silently disabled (plan §12.2).
# Usage: scripts/no-focused-tests.sh [dir...]   (default: src e2e)
set -uo pipefail
[ $# -gt 0 ] || set -- src e2e
if grep -rnE '\b(describe|it|test|suite)(\.[a-zA-Z]+)*\.(only|skip)\b' --include='*.ts' --include='*.tsx' "$@"; then
  echo "Focused or skipped test found (above)." >&2; exit 1
fi
