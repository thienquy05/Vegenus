#!/usr/bin/env bash
# Fails if a build input names docs/ or a root Markdown file, which would make the
# docs-only CI skip unsafe (design 6 §4). URLs such as https://host/docs/ are fine.
set -uo pipefail
[ $# -gt 0 ] || set -- src e2e supabase package.json '*.config.*' lighthouserc.json
hits=$(git grep --untracked -nIoE '(https?://[^[:space:]"]*|^|[^a-zA-Z])docs/|(README|CLAUDE|AGENTS)\.md' -- "$@" | grep -vE '^[^:]+:[0-9]+:https?://')
[ -z "$hits" ] || { echo "$hits"; echo "Build input references docs/ or root Markdown (above)." >&2; exit 1; }
