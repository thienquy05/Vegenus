#!/usr/bin/env bash
# Checks this machine has what Vegenus needs. With --install it offers to fix what it can,
# naming each download host first and asking before running (CLAUDE.md rule 1).
# Usage: scripts/setup.sh [--install]
set -uo pipefail
SKILL_PIN=2822e3ade65bb08130f46ce04e649f7e30a88fc233ef687d2bb5a11a92c20b76 # design/vegenus_security.md
SUPABASE_SKIP=studio,imgproxy,mailpit,logflare,vector,edge-runtime,supavisor,realtime # same as CI

# sha256 over the sorted lines "<path> <git blob sha1>" of every file in a skill folder (the skill pin).
skill_digest(){
  (cd "$1" && find . -type f | sed 's|^\./||' | while read -r f; do echo "$f $(git hash-object "$f")"; done \
    | LC_ALL=C sort | shasum -a 256 | cut -d' ' -f1)
}

ok(){ echo "ok    $1"; }
# miss WHAT FIX [HOST]: with --install and a HOST ("local" = no network), offers to run FIX; otherwise prints it.
miss(){
  echo "MISS  $1"
  if [ "$INSTALL" = --install ] && [ -n "${3:-}" ]; then
    echo "      downloads from: $3"
    read -rp "      run '$2'? [y/N] " a
    [ "$a" = y ] && eval "$2" && return
  fi
  echo "      fix: $2"; missing=1
}

main(){
  cd "$(dirname "$0")/.." || exit 1
  INSTALL=${1:-}; missing=0
  local v d

  v=$(node -v 2>/dev/null); v=${v#v}
  [ "${v%%.*}" -ge 24 ] 2>/dev/null && ok "node $v" || miss "node >= 24 (package.json engines)" "install Node 24+ (nodejs.org or brew install node)"
  docker info >/dev/null 2>&1 && ok "docker running" || miss "docker running" "start Docker Desktop"

  npm ls --depth=0 >/dev/null 2>&1 && ok "node_modules matches package-lock.json" \
    || miss "node_modules matches package-lock.json" "npm ci" "registry.npmjs.org"
  # Browsers live inside node_modules (playwright.config.ts sets PLAYWRIGHT_BROWSERS_PATH=0), so npm ci removes them.
  ls -d node_modules/playwright-core/.local-browsers/{chromium,webkit}-* >/dev/null 2>&1 && ok "playwright chromium + webkit" \
    || miss "playwright chromium + webkit" "PLAYWRIGHT_BROWSERS_PATH=0 npx playwright install chromium webkit" \
      "cdn.playwright.dev, playwright.download.prss.microsoft.com"
  npx --no-install supabase status >/dev/null 2>&1 && ok "local Supabase running" \
    || miss "local Supabase running" "npx supabase start -x $SUPABASE_SKIP" "public.ecr.aws (Docker images, first start only)"

  for d in harness_postgres harness_gate_daemon; do
    docker ps --filter "name=$d" --filter status=running -q 2>/dev/null | grep -q . && ok "harness-os $d running" \
      || miss "harness-os $d running" "start it from your harness-os checkout (docker compose -f <harness-os>/db/docker-compose.yml up -d); a new machine also needs the constitution seed"
  done
  [ -f .claude/proven-config.json ] && ok "harness config approved on this machine" \
    || miss "harness config approved on this machine" "harness init, then reconcile-config and approve (owner, interactive terminal)"

  for d in .claude/skills/security-audit .agents/skills/security-audit; do
    if [ ! -d "$d" ]; then miss "$d present" "cp -R ~/.agents/skills/security-audit $d (owner reinstall if absent: npx skills add https://github.com/cloudflare/security-audit-skill --skill security-audit)"
    elif [ "$(skill_digest "$d")" = "$SKILL_PIN" ]; then ok "$d matches its pin"
    else miss "$d matches its pin" "the skill changed: re-check it before use (design/vegenus_security.md)"; fi
  done

  command -v graphify >/dev/null && ok "graphify installed" || miss "graphify installed" "pipx install graphifyy==0.9.66 (owner approval, pypi.org)"
  [ -d graphify-out ] && ok "code graph built" || miss "code graph built" "graphify update . --no-cluster" "local"

  [ $missing = 0 ] && echo "all set"
  return $missing
}

[ "${BASH_SOURCE[0]}" = "$0" ] && { main "$@"; exit; }
