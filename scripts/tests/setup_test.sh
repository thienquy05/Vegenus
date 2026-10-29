#!/usr/bin/env bash
# Cases for the skill pin digest in setup.sh (design/vegenus_security.md). Usage: scripts/tests/setup_test.sh
set -uo pipefail
source "$(dirname "$0")/../setup.sh"; fail=0
d=$(mktemp -d); trap 'rm -rf "$d"' EXIT
mkdir -p "$d/refs"; printf 'x\n' >"$d/SKILL.md"; printf 'y\n' >"$d/refs/a.md"

# Expected value built without git: sha256 of sorted "<path> <sha1 of 'blob <size>\0<content>'>" lines.
want=64a37f85797c2c95256c4fde4abbdd5ff7368718fbb62270bbb302c3b31786fb
[ "$(skill_digest "$d")" = "$want" ] || { echo "FAIL fixture digest"; fail=1; }
printf 'z\n' >>"$d/refs/a.md"
[ "$(skill_digest "$d")" != "$want" ] || { echo "FAIL changed file keeps the digest"; fail=1; }

[ $fail = 0 ] && echo "setup: 2 cases pass"
exit $fail
