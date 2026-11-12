#!/usr/bin/env bash
# Find leftovers that nothing needs; close them with --apply (docs/process/CLEANUP.md).
# Usage: scripts/janitor.sh [--apply] [--system]
# Never matches by name or port alone. By default it looks at this repo only and closes only:
#   1. processes registered by run-bg.sh whose agent session has ended (or, owner unknown, older than the limit)
#   4. .handoff/ files older than JANITOR_HANDOFF_DAYS
# --system also covers the whole machine, which can hit other projects' tools, so it is never the default:
#   2. agent tool trees (plugin brokers, app-servers, MCP servers) orphaned to PID 1 and older than every live session
#   3. MCP containers (JANITOR_MCP_IMAGES) older than every live `docker run` client of that image
#   and reports listening ports and Docker reclaimable space. Always reports git-ignored cache sizes.
# Env: JANITOR_ORPHAN_HOURS (2), JANITOR_HANDOFF_DAYS (2), JANITOR_MCP_IMAGES ("harness-os:latest"),
#      JANITOR_KEEP_CONTAINERS ("harness_gate_daemon harness_postgres")
set -u

etime_s() {  # ps etime "[[dd-]hh:]mm:ss" -> seconds
  awk -v t="$1" 'BEGIN { d = 0; if (index(t, "-")) { split(t, a, "-"); d = a[1]; t = a[2] }
    n = split(t, p, ":"); s = 0; for (i = 1; i <= n; i++) s = s * 60 + p[i]; print d * 86400 + s }'
}

apply=0; system=0
while [ $# -gt 0 ]; do
  case "$1" in
    --apply) apply=1 ;;
    --system) system=1 ;;
    --report) ;;
    --etime-seconds) etime_s "${2:?}"; exit 0 ;;  # used by the tests
    *) sed -n '2,13p' "$0"; exit 0 ;;
  esac
  shift
done

# Does this pid still belong to the process group it was registered with? A pid can be reused by another
# process after the first one exits. Where ps is blocked (agent sandbox) this cannot be checked: say yes.
owns() {  # $1 = pid, $2 = pgid
  ps -o pgid= -p $$ >/dev/null 2>&1 || return 0
  [ "$(ps -o pgid= -p "$1" 2>/dev/null | tr -d ' ')" = "$2" ]
}

root=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
handoff=${HANDOFF_DIR:-$root/.handoff}
orphan_s=$(( ${JANITOR_ORPHAN_HOURS:-2} * 3600 ))
handoff_days=${JANITOR_HANDOFF_DAYS:-2}
mcp_images=${JANITOR_MCP_IMAGES:-harness-os:latest}
keep=" ${JANITOR_KEEP_CONTAINERS:-harness_gate_daemon harness_postgres} "
now=$(date +%s)
mode=report; [ $apply = 1 ] && mode=apply
echo "janitor ($mode) in $root"

tree() { local c; for c in $(pgrep -P "$1" 2>/dev/null); do tree "$c"; done; echo "$1"; }
stop_pids() {
  kill -TERM "$@" 2>/dev/null; sleep 2
  local p; for p in "$@"; do kill -0 "$p" 2>/dev/null && kill -KILL "$p" 2>/dev/null; done; return 0
}
stop_group() {  # $1 = pgid; $2 = pid fallback when the group is gone
  kill -TERM -- "-$1" 2>/dev/null || { [ -n "${2:-}" ] && stop_pids "$2"; return 0; }
  for _ in 1 2 3 4 5; do kill -0 -- "-$1" 2>/dev/null || return 0; sleep 1; done
  kill -KILL -- "-$1" 2>/dev/null; return 0
}

# 1. Registered processes
echo "== registered processes"
if [ -s "$handoff/procs" ]; then
  : >"$handoff/procs.new"
  while read -r name pid pgid started own cwd; do
    [ -n "${name:-}" ] || continue
    if ! kill -0 "$pid" 2>/dev/null; then
      echo "  $name: exited"; [ $apply = 1 ] && continue
    elif ! owns "$pid" "$pgid"; then
      echo "  $name pid=$pid: the pid now belongs to another process (reused) -> drop the entry, kill nothing"
      [ $apply = 1 ] && continue
    elif [ "$own" != 0 ] && ! kill -0 "$own" 2>/dev/null; then
      echo "  $name pid=$pid: the agent session that started it has ended -> close"
      [ $apply = 1 ] && { stop_group "$pgid" "$pid"; continue; }
    elif [ "$own" = 0 ] && [ $(( now - started )) -gt "$orphan_s" ]; then
      echo "  $name pid=$pid: owner unknown and older than the limit -> close"
      [ $apply = 1 ] && { stop_group "$pgid" "$pid"; continue; }
    else
      echo "  $name pid=$pid: running, still owned"
    fi
    echo "$name $pid $pgid $started $own $cwd" >>"$handoff/procs.new"
  done <"$handoff/procs"
  mv "$handoff/procs.new" "$handoff/procs"
else
  echo "  none"
fi

if [ $system = 1 ] && ps -p $$ >/dev/null 2>&1; then
  # 2. Orphaned agent tool trees
  echo "== orphaned agent tool processes"
  plist=$(ps -axo pid=,ppid=,etime=,args=)
  # Age of the oldest live agent session (claude/codex CLI, not an app-server, not orphaned).
  oldest=0
  while read -r pid ppid et args; do
    case "$args" in *app-server*) continue ;; esac
    case "$args" in */claude|*/claude\ *|claude|claude\ *|*/codex|*/codex\ *|codex|codex\ *) ;; *) continue ;; esac
    [ "$ppid" = 1 ] && continue
    a=$(etime_s "$et"); [ "$a" -gt "$oldest" ] && oldest=$a
  done <<<"$plist"
  found=0
  while read -r pid ppid et args; do
    [ "$ppid" = 1 ] || continue
    case "$args" in *app-server-broker*|*"codex app-server"*|*/.claude/plugins/*|*-mcp|*-mcp\ *|*mcp-server*) ;; *) continue ;; esac
    a=$(etime_s "$et")
    [ "$a" -gt "$orphan_s" ] && [ "$a" -gt "$oldest" ] || continue
    found=1; pids=$(tree "$pid")
    echo "  pid=$pid age=${a}s ($(echo "$pids" | wc -l | tr -d ' ') processes): ${args:0:90} -> close"
    [ $apply = 1 ] && stop_pids $pids
  done <<<"$plist"
  [ $found = 0 ] && echo "  none"

  # 3. Orphaned MCP containers
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    echo "== MCP containers ($mcp_images)"
    for img in $mcp_images; do
      newest_client=0; oldest_client=0
      while read -r pid ppid et args; do
        case "$args" in *"docker run"*"$img"*) ;; *) continue ;; esac
        a=$(etime_s "$et"); [ "$a" -gt "$oldest_client" ] && oldest_client=$a
      done <<<"$plist"
      docker ps --filter "ancestor=$img" --format '{{.ID}} {{.Names}}' | while read -r id cname; do
        case "$keep" in *" $cname "*) continue ;; esac
        created=$(docker inspect -f '{{.Created}}' "$id"); created=${created%%.*}; created=${created%Z}
        c=$(date -u -j -f '%Y-%m-%dT%H:%M:%S' "$created" +%s 2>/dev/null || date -u -d "$created" +%s)
        age=$(( now - c ))
        if [ "$age" -gt "$orphan_s" ] && [ "$age" -gt $(( oldest_client + 60 )) ]; then
          echo "  $cname age=${age}s: older than every live client -> close"
          [ $apply = 1 ] && docker stop -t 5 "$id" >/dev/null
        else
          echo "  $cname age=${age}s: in use"
        fi
      done
    done
  fi

  echo "== listening TCP ports (report only)"
  lsof -nP -iTCP -sTCP:LISTEN 2>/dev/null | awk 'NR > 1 { print "  " $1 " pid=" $2 " " $9 }' | sort -u
fi

# 4. Old handoff files
echo "== .handoff files older than ${handoff_days} days"
old=$( [ -d "$handoff" ] && find "$handoff" -type f -mtime +"$handoff_days" ! -name procs ! -path "*/logs/*" 2>/dev/null )
if [ -n "$old" ]; then
  echo "$old" | sed "s#^$root/#  #"
  [ $apply = 1 ] && echo "$old" | while IFS= read -r f; do rm -f "$f"; done && echo "  removed"
else
  echo "  none"
fi

# Reports
echo "== git-ignored folders by size (report only)"
git -C "$root" ls-files -o -i --exclude-standard --directory 2>/dev/null | awk -F/ '{ print $1 }' | sort -u |
  while IFS= read -r d; do [ -e "$root/$d" ] && du -sk "$root/$d" 2>/dev/null; done | sort -rn | head -8 |
  awk -v r="$root/" '{ s = $1; $1 = ""; sub(/^ /, ""); sub(r, ""); printf "  %6.1f MB  %s\n", s / 1024, $0 }'
if [ $system = 1 ] && command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  echo "== Docker disk (report only; prune is the owner's choice)"
  docker system df 2>/dev/null | sed 's/^/  /'
fi
exit 0
