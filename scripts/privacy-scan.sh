#!/usr/bin/env bash
# privacy-scan (plan §12.2, CLAUDE.md rule 3): the tracked tree holds no secrets, personal emails,
# tokens, tag UIDs or phone numbers; no image or binary file outside the manifests, each matching
# its entry; approved SVGs are plain vectors; local tooling and personal material stay git-ignored.
# With a range it also runs the commit check (check-commits.sh) over it.
# Usage: scripts/privacy-scan.sh [<rev-list args>]   e.g. origin/master..HEAD
set -uo pipefail
source "$(dirname "$0")/check-commits.sh"
bad=0

# Approved SVGs use only these (the shipped logo and Zodiac files), so no script, event handler,
# external reference, style or embedded raster fits in one. A new kind of SVG extends the list in review.
SVG_TAGS='svg|g|path|rect|title|desc'
SVG_ATTRS='xmlns|viewBox|width|height|x|y|d|fill|fill-rule|transform|id|role|aria-labelledby'
# Paths that must stay ignored (CLAUDE.md rules 1 and 3, design 7 §3).
MUST_IGNORE=(.env .env.local .claude/settings.local.json .claude-flow/x .swarm/x agentdb.rvf .codex/x
  .design/x .vercel/x .supabase/x .playwright-mcp/x graphify-out/x .claude/skills/x .agents/skills/x
  private/x personal/x uploads/x photos/x nfc-private/x tag-uids.txt dump.sql
  a.jpg a.jpeg a.png a.webp a.heic a.heif a.mp4 a.mov)

# "path<TAB>sha256<TAB>width<TAB>height" for every manifest entry, paths from the repo root.
manifest_entries(){
  node -e 'const fs = require("fs"), path = require("path");
    const walk = (m, v) => { if (v && typeof v === "object") {
      if (typeof v.file === "string" && typeof v.sha256 === "string")
        console.log([path.join(path.dirname(m), v.file), v.sha256, v.width ?? "", v.height ?? ""].join("\t"));
      Object.values(v).forEach((x) => walk(m, x)); } };
    for (const m of process.argv.slice(1)) if (fs.existsSync(m)) walk(m, JSON.parse(fs.readFileSync(m, "utf8")));' "${MANIFESTS[@]}"
}
# "W H" from a PNG's signature and IHDR chunk; nothing if the file is not a PNG.
png_size(){
  [ "$(od -An -tx1 -N16 "$1" | tr -d ' \n')" = 89504e470d0a1a0a0000000d49484452 ] || return
  od -An -tu1 -j16 -N8 "$1" | awk '{ print $1 * 16777216 + $2 * 65536 + $3 * 256 + $4, $5 * 16777216 + $6 * 65536 + $7 * 256 + $8 }'
}
svg_plain(){
  local svg tags attrs ns left
  svg=$(tr '\n\r' '  ' <"$1") || return 1 # one line, so a tag split over lines is read whole
  tags=$(grep_ok -aoP '<\s*/?\s*\K[^\s/>]+' <<<"$svg" | grep_ok -avxE "$SVG_TAGS") || return 1
  # Tags read quote-aware and quoted values dropped, so a ">" or "x=" inside a value hides nothing.
  attrs=$(grep_ok -aoP '<(?:[^>"'\'']|"[^"]*"|'\''[^'\'']*'\'')*>' <<<"$svg" | sed -E "s/\"[^\"]*\"//g; s/'[^']*'//g" | grep_ok -aoP '[^\s<>="'\'']+(?=\s*=)' | grep_ok -avxE "$SVG_ATTRS") || return 1
  ns=$(grep_ok -aoP '\bxmlns\s*=\s*["'\'']\K[^"'\'']*' <<<"$svg" | grep_ok -avxF 'http://www.w3.org/2000/svg') || return 1
  # A "<" left once every readable tag is gone (an unclosed quote) is a tag whose attributes went unread.
  left=$(sed -E "s/<([^>\"']|\"[^\"]*\"|'[^']*')*>//g" <<<"$svg" | tr -cd '<') || return 1
  [ -z "$tags$attrs$ns$left" ] || { echo "$1: SVG is not a plain vector ($(echo $tags $attrs $ns ${left:+unreadable-tag} | sort -u | head -c 120))"; return 1; }
}

# The tracked files, NUL-separated (git quotes a name holding a tab or newline even with
# core.quotePath=false), read from a file so a git failure stops the scan instead of listing nothing.
list=$(mktemp) && git ls-files --eol -z >"$list" || { echo "cannot list the tracked files" >&2; exit 1; }
trap 'rm -f "$list"' EXIT
# Binaries by their own bytes (git's content check, which attributes do not change); images by name.
declare -A check=(); excl=()
while IFS= read -r -d '' x; do
  f=${x#*$'\t'}
  [ "${x%% *}" = i/-text ] && { check[$f]=1; excl+=(":(exclude,literal)$f"); }
  [[ ${f,,} =~ $IMAGE_EXT ]] && check[$f]=1
done <"$list"

# 1. Every tracked file name, and every line of every other tracked file, through the commit check's
# patterns. --text: a -diff or binary attribute must not hide a text file. A name is reported by its
# line in `git ls-files` (find it with `git ls-files | sed -n <N>p`), never by the name itself.
{ tr '\n\0' ' \n' <"$list" | cut -f2- | awk '{ print "(path " NR ")\t" $0 }'
  git -c core.quotePath=false grep -n --text '' -- . "${excl[@]}" | awk '{ i = index($0, ":"); j = index(substr($0, i + 1), ":")
  print substr($0, 1, i + j - 1) "\t" substr($0, i + j + 1) }'; } | scan_lines || bad=1

# 2. Images (by name) and binaries only as manifest entries.
entries=$(manifest_entries) || { echo "a manifest is not valid JSON"; bad=1; }
while IFS= read -r -d '' f; do
  e=$(awk -F'\t' -v f="$f" '$1 == f' <<<"$entries")
  [ -n "$e" ] || { echo "$f: image or binary not in a manifest"; bad=1; continue; }
  IFS=$'\t' read -r _ sha w h <<<"$e"
  [ "$(shasum -a 256 "$f" | cut -d' ' -f1)" = "$sha" ] || { echo "$f: sha256 differs from its manifest"; bad=1; }
  case ${f,,} in
    *.png) [ "$(png_size "$f")" = "$w $h" ] || { echo "$f: not a ${w}x$h PNG as its manifest says"; bad=1; } ;;
    *.svg) svg_plain "$f" || bad=1 ;;
  esac
done < <([ ${#check[@]} = 0 ] || printf '%s\0' "${!check[@]}")

# 3. Local tooling, secrets and personal material stay git-ignored, and nothing tracked sits where
# the ignore rules point (a force-add).
for p in "${MUST_IGNORE[@]}"; do
  git check-ignore -q --no-index "$p" || { echo ".gitignore: $p is not ignored"; bad=1; }
done
ignored=$(git ls-files -ci --exclude-standard) || { echo "cannot list ignored files" >&2; exit 1; }
[ -z "$ignored" ] || { sed 's/$/: tracked but git-ignored/' <<<"$ignored"; bad=1; }

# 4. The commit check over the range, if one is given.
[ $# -eq 0 ] || check_commits "$@" || bad=1

[ $bad = 0 ] && echo "privacy-scan: clean"
exit $bad
