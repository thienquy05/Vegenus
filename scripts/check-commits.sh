#!/usr/bin/env bash
# Commit check (design 6 §8): each commit's author, committer, message, file names and added lines, and every
# binary blob it adds, so a value added and removed later is still caught. Merges are diffed against
# their first parent, root commits against the empty tree. Reports where and what kind, never the
# value (CI logs are public). privacy-scan.sh sources this file for the same line patterns.
# Usage: scripts/check-commits.sh <rev-list args>   e.g. origin/master..HEAD (before a push), --all
# A binary must match a sha256 in a manifest as it is on $MANIFEST_REF (default origin/master), not
# in the range checked, so a commit cannot approve its own image.
set -uo pipefail
export LC_ALL=C

# Image exceptions are file-level, listed in these manifests (plan §12.2); renders.json joins at T3.9.
MANIFESTS=(assets/zodiac-sign/western/manifest.json assets/zodiac-sign/vietnamese/manifest.json
  assets/zodiac-sign/source-sheets.json assets/logo/manifest.json)
EMPTY_TREE=4b825dc642cb6eb9a060e54bf8d69288fbee4904

EMAIL='[A-Za-z0-9._%+-]+@(?:(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}|localhost)\b'
# GitHub noreply, the Anthropic co-author line, Resend's public sender (design 6 §8), and domains
# reserved so they never belong to a person (RFC 2606, RFC 6761; Q109). Matched in lower case.
ALLOWED_EMAIL='^([0-9]+\+[a-z0-9-]+@users\.noreply\.github\.com|noreply@(github|anthropic)\.com|onboarding@resend\.dev|[^@]+@((.+\.)?example\.(com|net|org)|(.+\.)?(test|example|invalid|localhost)))$'
# npm's own deprecation text in the lockfile may name a maintainer (Q93); nowhere else. The line must
# be that one field and nothing more, so no other field rides along.
LOCK_DEPRECATED='^([0-9a-f]+ )?package-lock\.json:[0-9]+\t\s*"deprecated": "(?:[^"\\]|\\.)*",?$'
# A lockfile line that is only an integrity hash skips every pattern: its base64 can hold anything.
LOCK_INTEGRITY='^([0-9a-f]+ )?package-lock\.json:[0-9]+\t\s*"integrity": "sha(1|256|384|512)-[A-Za-z0-9+/]+=*",?$'
# SVG path data (only path commands and numbers) is blanked first: its numbers look like tag UIDs.
SVG_PATH_DATA='/^([0-9a-f]+ )?[^\t]*\.svg:[0-9]+\t/ s/([[:space:]<])d="[MmLlHhVvCcSsQqTtAaZz0-9.,eE+[:space:]-]*"/\1d=""/g'
IMAGE_EXT='\.(svg|png|jpe?g|gif|webp|avif|hei[cf]|bmp|tiff?|ico)$'
# kind<TAB>PCRE. Tokens: 43 base64url characters, the guest token's form (src/lib/guest.ts), with
# upper and lower case (a random token lacks one with odds near 1 in 3 billion) so a 43-character
# kebab-case name passes. Tag UIDs are 4, 7 or 10 bytes (NFC Forum), so a 6-byte MAC address passes;
# compact ones skip a CSS colour (after #), a UUID's first group and a migration stamp (14 digits
# and _) or a package's prerelease build (19.0.0-rc-<commit>-<date>), and 8 digits with no hex letter
# pass (dates).
PATTERNS='private key	-----BEGIN[A-Z ]*PRIVATE KEY-----
JWT	\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.
API key	\b(?:sb_(?:secret|publishable)_[A-Za-z0-9_-]{10,}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35}|xox[abprs]-[A-Za-z0-9-]{10,}|[rs]k_live_[A-Za-z0-9]{16,}|sk-(?:ant-)?[A-Za-z0-9_-]{20,}|re_[A-Za-z0-9]{8,}_[A-Za-z0-9_]{8,})
token	(?<![A-Za-z0-9_-])(?=[A-Za-z0-9_-]{0,42}[A-Z])(?=[A-Za-z0-9_-]{0,42}[a-z])[A-Za-z0-9_-]{43}(?![A-Za-z0-9_-])
tag UID	(?i)(?<![0-9a-f][:-])(?<![0-9a-z])[0-9a-f]{2}([:-])[0-9a-f]{2}(?:\1[0-9a-f]{2}){2}(?:(?:\1[0-9a-f]{2}){3}){0,2}(?![0-9a-z]|[:-][0-9a-f])
tag UID	(?i)(?<![0-9a-z#])(?<!-rc-|-canary-|-experimental-)(?![0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?![0-9a-z]))(?![0-9]{14}_)(?:(?=[0-9]{0,7}[a-f])[0-9a-f]{8}|[0-9a-f]{14}|[0-9a-f]{20})(?![0-9a-z])
phone number	(?<![0-9A-Za-z+.])(?:\+84[ .-]?|0)[35789](?:[ .-]?[0-9]){8}(?![0-9])
phone number	(?<![0-9A-Za-z+.])\+[1-9][0-9]{7,14}(?![0-9])
image data URI	(?i)\bdata:\s*(?:image(?:[/;,]|%2f)|[^,\s]*;\s*base64\s*,)'

# grep, but exit 1 ("no match") counts as success; 2 and above (an error, such as a PCRE limit on a
# long line) is reported and fails, so a pattern that could not run never reads as "nothing found".
grep_ok(){ grep "$@"; local rc=$?; [ $rc -le 1 ] || echo "grep failed (exit $rc): a scan did not complete" >&2; [ $rc -le 1 ]; }

# Reads "label<TAB>text" lines and prints "label: kind" for each hit. Fails if there was any, or if
# any step could not run.
scan_lines(){
  local in kind re out hits='' lines label text emails rc
  # Fail closed: without PCRE (e.g. BSD grep) every pattern below would silently find nothing.
  grep -qaP '^(?=x)x$' <<<x || { echo "grep -P (GNU grep with PCRE) is required" >&2; return 1; }
  in=$(grep_ok -avP -- "$LOCK_INTEGRITY" | sed -E "$SVG_PATH_DATA") || return 1
  while IFS=$'\t' read -r kind re; do
    out=$(grep_ok -aP -- "^[^\t]*\t.*?(?:$re)" <<<"$in") || return 1
    [ -z "$out" ] || hits+=$(cut -f1 <<<"$out" | sed "s/\$/: $kind/")$'\n'
  done <<<"$PATTERNS"
  lines=$(grep_ok -aP -- "$EMAIL" <<<"$in") && lines=$(grep_ok -avP -- "$LOCK_DEPRECATED" <<<"$lines") || return 1
  if [ -n "$lines" ]; then
    while IFS=$'\t' read -r label text; do
      emails=$(grep_ok -aoP -- "$EMAIL" <<<"$text" | tr 'A-Z' 'a-z') || return 1
      grep -vqE "$ALLOWED_EMAIL" <<<"$emails"; rc=$?
      [ $rc -le 1 ] || { echo "grep failed (exit $rc): a scan did not complete" >&2; return 1; }
      [ $rc = 1 ] || hits+="$label: email address"$'\n'
    done <<<"$lines"
  fi
  [ -z "$hits" ] || { sort -u <<<"${hits%$'\n'}"; return 1; }
}

# Labelled metadata, message and added lines of commit $1 against $2; more args are pathspecs.
commit_lines(){
  local s=${1:0:12} c=$1 p=$2; shift 2
  git log -1 --format='%an <%ae>%n%cn <%ce>' "$c" | awk -v s="$s" '{ print s (NR == 1 ? " (author)" : " (committer)") "\t" $0 }' || return 1
  git log -1 --format=%B "$c" | awk -v s="$s" '{ print s " (message)\t" $0 }' || return 1
  # --text: a -diff or binary attribute must not hide a text file's lines (the caller excludes real binaries).
  git -c core.quotePath=false diff --text --no-color --no-ext-diff --no-textconv --no-renames -U0 "$p" "$c" -- . "$@" | awk -v s="$s" '
    /^diff --git / { h = 1; next }
    h && /^\+\+\+ / { f = substr($0, 7); h = 0; next }
    /^@@ / { h = 0; split($3, a, ","); n = substr(a[1], 2); next }
    !h && /^\+/ { print s " " f ":" n "\t" substr($0, 2); n++ }'
}

# Scratch repo $1 holding only revision $2's .gitignore files, to test paths against its rules.
# Fails on any error, so a missing rule never reads as "not ignored".
ignore_snapshot(){
  local g
  rm -rf -- "$1" && git init -q -- "$1" && git ls-tree -r -z --name-only "$2" >"$1.paths" || return 1
  while IFS= read -r -d '' g; do
    case $g in .gitignore | */.gitignore) ;; *) continue ;; esac
    mkdir -p -- "$1/$(dirname -- "$g")" && git cat-file blob "$2:$g" >"$1/$g" || return 1
  done <"$1.paths"
}
# Ignored, or check-ignore failed (exit 128): both count, only a clean "not ignored" (1) passes.
ignored_in(){ git -C "$1" -c core.excludesFile=/dev/null check-ignore -q --no-index -- "$2"; [ $? -ne 1 ]; }

check_commits(){
  local ref=${MANIFEST_REF:-origin/master} revs approved c p f meta b size text binary bad=0 excl tmp paths
  git rev-parse -q --verify "$ref^{commit}" >/dev/null || { echo "manifest ref $ref not found" >&2; return 1; }
  revs=$(git rev-list --reverse "$@") || { echo "bad range: $*" >&2; return 1; }
  approved=$(for f in "${MANIFESTS[@]}"; do git show "$ref:$f" 2>/dev/null; done | grep -oE '"sha256": *"[0-9a-f]{64}"' | grep -oE '[0-9a-f]{64}')
  # Ignore rules from $ref (the trusted policy) and from each commit itself (a nested .gitignore
  # deleted later), never from the checkout or this machine's global excludes.
  tmp=$(mktemp -d) && ignore_snapshot "$tmp/base" "$ref" || { echo "cannot snapshot the ignore rules of $ref" >&2; rm -rf "$tmp"; return 1; }
  for c in $revs; do
    p=$(git rev-parse -q --verify "$c^1") || p=$EMPTY_TREE
    excl=(); paths=''; ignore_snapshot "$tmp/c" "$c" || { echo "cannot snapshot the ignore rules of ${c:0:12}" >&2; rm -rf "$tmp"; return 1; }
    # From a file, not process substitution, so a git failure stops the check instead of listing nothing.
    git diff --raw -z --no-abbrev --no-renames --diff-filter=d "$p" "$c" >"$tmp/raw" \
      || { echo "cannot list the changes of ${c:0:12}" >&2; rm -rf "$tmp"; return 1; }
    # Every added or changed blob, judged by its own bytes (a NUL) or an image name, never by
    # attributes, which a .gitattributes line can flip; and never at a path the ignore rules cover.
    while IFS= read -r -d '' meta && IFS= read -r -d '' f; do
      paths+="${c:0:12} (path)"$'\t'"${f//$'\n'/ }"$'\n' # a file name is public too
      b=$(cut -d' ' -f4 <<<"$meta")
      [ "$(cut -d' ' -f2 <<<"$meta")" = 160000 ] && continue # a submodule link, not a blob
      { ignored_in "$tmp/base" "$f" || ignored_in "$tmp/c" "$f"; } && { echo "${c:0:12} $f: added at a git-ignored path"; bad=1; }
      # One checked read of the blob; a NUL in it makes it binary. A git failure stops the check
      # rather than reading as "text" or as an approved checksum.
      git cat-file blob "$b" >"$tmp/blob" && size=$(wc -c <"$tmp/blob") && text=$(tr -d '\000' <"$tmp/blob" | wc -c) \
        || { echo "cannot read blob $b" >&2; rm -rf "$tmp"; return 1; }
      binary=0; [ "$text" -ne "$size" ] && binary=1
      [ $binary = 1 ] && excl+=(":(exclude,literal)$f")
      [ $binary = 1 ] || [[ ${f,,} =~ $IMAGE_EXT ]] || continue
      grep -qx "$(shasum -a 256 <"$tmp/blob" | cut -d' ' -f1)" <<<"$approved" \
        || { echo "${c:0:12} $f: image or binary not in a manifest on $ref"; bad=1; }
    done <"$tmp/raw"
    { printf '%s' "$paths"; commit_lines "$c" "$p" "${excl[@]}"; } | scan_lines || bad=1
  done
  rm -rf "$tmp"
  return $bad
}

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  [ $# -gt 0 ] || { echo "usage: $0 <rev-list args>" >&2; exit 2; }
  check_commits "$@" && echo "commit check: clean"
fi
