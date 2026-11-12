#!/usr/bin/env bash
# Start a long-running process (dev server, watcher, database, browser) in its own process group
# and register it in .handoff/procs so it can be stopped later (docs/process/CLEANUP.md).
# Usage:
#   scripts/run-bg.sh <name> <command...>   start and register; log in .handoff/logs/<name>.log
#   scripts/run-bg.sh --stop <name>         stop the whole process group and unregister
#   scripts/run-bg.sh --list                show registered processes
# Registry line: name pid pgid start_epoch owner_pid cwd   (owner = the agent session that started it, 0 if unknown)
set -eu

root=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
dir=${HANDOFF_DIR:-$root/.handoff}
reg=$dir/procs
mkdir -p "$dir/logs"; touch "$reg"

# Nearest ancestor that is an agent session (claude or codex CLI). ps may be unavailable in a sandbox: then 0.
owner() {
  local p=$PPID args
  while [ "${p:-1}" -gt 1 ]; do
    args=$(ps -o args= -p "$p" 2>/dev/null) || { echo 0; return; }
    case "$args" in *"app-server"*) ;; */claude|*/claude\ *|claude|claude\ *|*/codex|*/codex\ *|codex|codex\ *) echo "$p"; return ;; esac
    p=$(ps -o ppid= -p "$p" 2>/dev/null | tr -d ' ') || { echo 0; return; }
  done
  echo 0
}

# Does this pid still belong to the process group it was registered with? A pid can be reused by another
# process after the first one exits. Where ps is blocked (agent sandbox) this cannot be checked: say yes.
owns() {  # $1 = pid, $2 = pgid
  ps -o pgid= -p $$ >/dev/null 2>&1 || return 0
  [ "$(ps -o pgid= -p "$1" 2>/dev/null | tr -d ' ')" = "$2" ]
}

stop_group() {
  kill -TERM -- "-$1" 2>/dev/null || return 0
  for _ in 1 2 3 4 5; do kill -0 -- "-$1" 2>/dev/null || return 0; sleep 1; done
  kill -KILL -- "-$1" 2>/dev/null || true
}

case "${1:-}" in
  ''|-h|--help) sed -n '2,8p' "$0"; exit 0 ;;
  --list)
    while read -r name pid pgid started own cwd; do
      state=exited; kill -0 "$pid" 2>/dev/null && state=running
      echo "$name pid=$pid $state age=$(( $(date +%s) - started ))s owner=$own"
    done <"$reg"
    exit 0 ;;
  --stop)
    name=${2:?usage: run-bg.sh --stop <name>}
    line=$(awk -v n="$name" '$1==n' "$reg")
    [ -n "$line" ] || { echo "run-bg.sh: $name is not registered" >&2; exit 1; }
    lpid=$(echo "$line" | awk '{print $2}'); lpgid=$(echo "$line" | awk '{print $3}')
    if kill -0 "$lpid" 2>/dev/null && ! owns "$lpid" "$lpgid"; then
      echo "run-bg.sh: $name's pid now belongs to another process (reused); nothing was stopped" >&2
    else
      stop_group "$lpgid"
    fi
    awk -v n="$name" '$1!=n' "$reg" >"$reg.tmp" && mv "$reg.tmp" "$reg"
    echo "stopped $name"; exit 0 ;;
esac

name=$1; shift
[ $# -gt 0 ] || { echo "usage: run-bg.sh <name> <command...>" >&2; exit 2; }
case "$name" in *[!A-Za-z0-9._-]*) echo "run-bg.sh: name may use letters, digits, . _ - only" >&2; exit 2 ;; esac
if old=$(awk -v n="$name" '$1==n{print $2}' "$reg") && [ -n "$old" ] && kill -0 "$old" 2>/dev/null; then
  echo "run-bg.sh: $name is already running (pid $old); stop it first" >&2; exit 1
fi
awk -v n="$name" '$1!=n' "$reg" >"$reg.tmp" && mv "$reg.tmp" "$reg"

set -m   # job control: the background job gets its own process group (pgid = pid)
nohup "$@" >"$dir/logs/$name.log" 2>&1 </dev/null &
pid=$!
set +m
echo "$name $pid $pid $(date +%s) $(owner) $PWD" >>"$reg"
echo "started $name pid=$pid log=${dir#"$root"/}/logs/$name.log"
