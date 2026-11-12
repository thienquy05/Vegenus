#!/usr/bin/env bash
# Cases for run-bg.sh and janitor.sh (docs/process/CLEANUP.md). Runs in a temp git repo and touches
# nothing else; it never uses --apply together with --system. Usage: scripts/tests/janitor_test.sh
set -u
here=$(cd "$(dirname "$0")/.." && pwd)
t=$(mktemp -d "${TMPDIR:-/tmp}/janitor_test.XXXXXX") && [ -d "$t" ] || { echo "janitor_test: cannot create a temp dir; refusing to run" >&2; exit 2; }
fails=0; total=0; pids=""
cleanup() { for p in $pids; do kill "$p" 2>/dev/null; done; rm -rf "$t"; }
trap cleanup EXIT
check() { total=$((total + 1)); if eval "$2"; then :; else echo "FAIL $1"; fails=$((fails + 1)); fi; }
# A background job in its own process group, as run-bg.sh makes them.
bg() { set -m; sleep 300 & bgpid=$!; set +m; disown "$bgpid"; pids="$pids $bgpid"; }
# The reused-pid cases need ps, which agent sandboxes block; there the scripts skip the check too.
have_ps() { ps -o pgid= -p $$ >/dev/null 2>&1; }

cd "$t" && git init -q . && mkdir scripts && cp "$here/janitor.sh" "$here/run-bg.sh" scripts/ && printf '.handoff/\n' >.gitignore \
  || { echo "FAIL scripts present: janitor.sh and run-bg.sh"; exit 1; }

# run-bg.sh: a child and a grandchild must both stop
scripts/run-bg.sh srv bash -c 'sleep 300 & sleep 300' >/dev/null
sleep 1
pid=$(awk '$1=="srv"{print $2}' .handoff/procs)
check "run-bg registers the process"            '[ -n "$pid" ] && kill -0 "$pid"'
scripts/run-bg.sh srv true >/dev/null 2>&1; rc=$?
check "run-bg refuses a duplicate name"         '[ $rc = 1 ]'
scripts/run-bg.sh --stop srv >/dev/null
sleep 1
check "run-bg --stop ends the process"          '! kill -0 "$pid" 2>/dev/null'
check "run-bg --stop ends the whole group"      '! kill -0 -- "-$pid" 2>/dev/null'
check "run-bg --stop unregisters"               '! grep -q "^srv " .handoff/procs'

# A registry line whose pid now belongs to another process group (the pid was reused) must not kill anything.
if have_ps; then
  bg; a=$bgpid; bg; b=$bgpid
  echo "reused $a $b $(date +%s) 0 $t" >>.handoff/procs
  scripts/run-bg.sh --stop reused >/dev/null 2>&1
  check "run-bg --stop spares a reused pid"       'kill -0 "$a" 2>/dev/null && kill -0 "$b" 2>/dev/null'
  check "run-bg --stop unregisters a reused pid"  '! grep -q "^reused " .handoff/procs'
fi

# janitor.sh
check "etime 05:07 = 307 s"                     '[ "$(scripts/janitor.sh --etime-seconds 05:07)" = 307 ]'
check "etime 01:00:00 = 3600 s"                 '[ "$(scripts/janitor.sh --etime-seconds 01:00:00)" = 3600 ]'
check "etime 2-03:04:05 = 183845 s"             '[ "$(scripts/janitor.sh --etime-seconds 2-03:04:05)" = 183845 ]'
set -m; sleep 300 & orphan=$!; set +m; disown "$orphan"; pids="$pids $orphan"
echo "dev $orphan $orphan $(date +%s) 999999 $t" >>.handoff/procs   # owner 999999: a session that no longer exists
echo note >.handoff/old-note.md; touch -t 202001010000 .handoff/old-note.md
echo note >.handoff/new-note.md
rep=$(scripts/janitor.sh)
check "report lists the old handoff file"       'echo "$rep" | grep -q old-note.md'
check "report flags the ownerless process"      'echo "$rep" | grep -q "dev pid=$orphan: the agent session that started it has ended"'
check "report changes nothing"                  '[ -f .handoff/old-note.md ] && kill -0 "$orphan"'
check "default scope is this repo only"         '! echo "$rep" | grep -q "orphaned agent tool processes"'
if ps -p $$ >/dev/null 2>&1; then   # --system reads the process table; skip where ps is blocked
  check "--system adds the machine-wide report" 'scripts/janitor.sh --system | grep -q "orphaned agent tool processes"'
fi
scripts/janitor.sh --apply >/dev/null
sleep 1
check "--apply removes the old file"            '[ ! -f .handoff/old-note.md ]'
check "--apply keeps the new file"              '[ -f .handoff/new-note.md ]'
check "--apply stops the ownerless process"     '! kill -0 "$orphan" 2>/dev/null'

# The same reused-pid line under --apply: neither group is touched and the stale line goes.
if have_ps; then
  bg; c=$bgpid; bg; d=$bgpid
  echo "reused2 $c $d $(date +%s) 999999 $t" >>.handoff/procs
  scripts/janitor.sh --apply >/dev/null
  sleep 1
  check "--apply spares a reused pid"             'kill -0 "$c" 2>/dev/null && kill -0 "$d" 2>/dev/null'
  check "--apply drops a reused pid's line"       '! grep -q "^reused2 " .handoff/procs'
fi

[ $fails = 0 ] && echo "janitor: $total cases pass" || { echo "janitor: $fails of $total failed"; exit 1; }
