#!/usr/bin/env bash
# Cases for the tree scan (plan §12.2). The line patterns are shared with the commit check and are
# tested in check_commits_test.sh. Usage: scripts/tests/privacy_scan_test.sh
# Fixture values are split ("a""b") so this file never holds the literal it tests for.
set -uo pipefail
S=$(cd "$(dirname "$0")/.." && pwd)/privacy-scan.sh; ROOT=$(dirname "$S")/..; fail=0; n=0
d=$(mktemp -d); trap 'rm -rf "$d"' EXIT
NR=1+bot@users.noreply.github.com
SVG='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1" role="img" aria-labelledby="t"><title id="t">Star</title><g transform="scale(1)"><path fill="#fff" fill-rule="evenodd" d="M0 0h1v1z"/><rect x="0" y="0" width="1" height="1"/></g></svg>'

g(){ GIT_AUTHOR_EMAIL=${A:-$NR} GIT_COMMITTER_EMAIL=$NR git -C "$d/r" -c user.name=t \
  -c core.hooksPath=/dev/null -c commit.gpgsign=false "$@"; }
put(){ mkdir -p "$(dirname "$d/r/$1")"; printf '%s\n' "$2" >"$d/r/$1"; g add -f "$1"; }
sha(){ shasum -a 256 "$d/r/$1" | cut -d' ' -f1; }
# png PATH W H: the PNG signature and IHDR header the scan reads, for a W x H image.
png(){ mkdir -p "$(dirname "$d/r/$1")"
  printf "\\x89PNG\\r\\n\\x1a\\n\\0\\0\\0\\rIHDR\\0\\0\\0\\x$(printf %02x "$2")\\0\\0\\0\\x$(printf %02x "$3")\\x08\\x06\\0\\0\\0" >"$d/r/$1"
  g add -f "$1"; }
# A clean tree: the real .gitignore, an approved 2x3 logo PNG and an approved vector SVG.
fresh(){ rm -rf "$d/r"; git init -q -b master "$d/r"; { cat "$ROOT/.gitignore"; echo '!/assets/logo/ok.png'; } >"$d/r/.gitignore"; g add .gitignore
  png assets/logo/ok.png 2 3; logo ok.png "$(sha assets/logo/ok.png)" 2 3
  put assets/zodiac-sign/western/star.svg "$SVG"
  put assets/zodiac-sign/western/manifest.json '[{"file":"star.svg","sha256":"'"$(sha assets/zodiac-sign/western/star.svg)"'"}]'; }
logo(){ put assets/logo/manifest.json '{"files":[{"file":"'"$1"'","sha256":"'"$2"'","width":'"$3"',"height":'"$4"'}]}'; }
t(){
  local name=$1 want=$2 got=fail; shift 2; n=$((n + 1))
  (cd "$d/r" && MANIFEST_REF=master "$S" "$@") >/dev/null 2>&1 && got=pass
  [ "$got" = "$want" ] || { echo "FAIL $name: got $got, want $want"; fail=1; }
}
# svg NAME WANT CONTENT: CONTENT as the approved SVG, its checksum in the manifest.
svg(){ fresh; put assets/zodiac-sign/western/star.svg "$3"
  put assets/zodiac-sign/western/manifest.json '[{"file":"star.svg","sha256":"'"$(sha assets/zodiac-sign/western/star.svg)"'"}]'; t "$1" "$2"; }

fresh; t clean-tree pass

# Images and binaries: only files listed in a manifest, matching it
fresh; png docs/photo.png 2 3; t unlisted-png fail
fresh; logo ok.png "$(sha assets/logo/ok.png)" 2 4; t png-wrong-dimensions fail
fresh; logo ok.png "$(printf '%064d' 0)" 2 3; t png-wrong-checksum fail
fresh; put assets/logo/ok.png "not a png"; logo ok.png "$(sha assets/logo/ok.png)" 2 3; t png-wrong-type fail
fresh; put docs/photo.jpg x; t unlisted-jpg fail
fresh; printf 'a\0b' >"$d/r/notes.md"; g add notes.md; t binary-named-md fail
fresh; put docs/extra.svg "$SVG"; t unlisted-svg fail
fresh; put $'docs/a\tb.svg' "$SVG"; t unlisted-svg-tab-name fail
fresh; put $'docs/a\nb.svg' "$SVG"; t unlisted-svg-newline-name fail
fresh; put .gitattributes '*.dat diff'; printf 'a\0b' >"$d/r/x.dat"; g add -f x.dat; t forced-text-binary fail

# SVGs stay plain vectors
svg svg-script fail '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
svg svg-handler fail '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><path d="M0 0"/></svg>'
svg svg-external-href fail '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><use xlink:href="https://x.example/a.svg#s"/></svg>'
svg svg-handler-next-line fail $'<svg xmlns="http://www.w3.org/2000/svg"><path\n onload="alert(1)" d="M0 0"/></svg>'
svg svg-raster fail '<svg xmlns="http://www.w3.org/2000/svg"><image href="a.png"/></svg>'
svg svg-style fail '<svg xmlns="http://www.w3.org/2000/svg"><path style="fill:url(https://x.example/p)" d="M0 0"/></svg>'
svg svg-foreign-ns fail '<svg xmlns="http://x.example/ns"><path d="M0 0"/></svg>'
svg svg-gt-in-quoted-value fail '<svg xmlns="http://www.w3.org/2000/svg"><path d=">" onload="alert(1)"/></svg>'
svg svg-unclosed-quote fail "<svg xmlns=\"http://www.w3.org/2000/svg\"><path onload=alert(1) d='/></svg>"
svg svg-doctype fail '<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg xmlns="http://www.w3.org/2000/svg"><title>&x;</title></svg>'

# shim WORD: a grep that fails (exit 2, like a PCRE limit error) when its arguments hold WORD.
G=$(type -P grep); mkdir -p "$d/shim"
shim(){ printf '#!/usr/bin/env bash\ncase "$*" in *%q*) exit 2 ;; esac\nexec %q "$@"\n' "$1" "$G" >"$d/shim/grep"; chmod +x "$d/shim/grep"; }
fresh; shim 'rect|title'; PATH=$d/shim:$PATH t svg-check-error fail

# Text lines (patterns shared with the commit check)
fresh; put src/a.ts "const to = \"person@""gmail.com\";"; t personal-email fail
fresh; put src/a.ts 'const to = "owner@example.test";'; t reserved-email pass
fresh; put src/a.ts "const t = \"AbCdEfGhIjKlMnOpQrStUvWxYz0123456789""_-abcde\";"; t token fail
fresh; put "nfc/04a1b2c""3d4e5f6.json" x; t uid-in-path fail
  # the hit names the file's position in `git ls-files`, never the name
  n=$((n + 1)); out=$(cd "$d/r" && "$S" 2>&1); want=$(cd "$d/r" && git ls-files | grep -n '^nfc/' | cut -d: -f1)
  grep -qx "(path $want): tag UID" <<<"$out" || { echo "FAIL uid-in-path-position: no '(path $want)' line"; fail=1; }
fresh; put "nfc/tag-04a1b2c""3d4e5f6.json" x; t uid-after-dash-in-path fail
fresh; put a.env.example "PHONE=09""12345678"; t phone-after-equals fail
fresh; put .gitattributes '*.txt -diff'; put a.txt "to: person@""gmail.com"; t forced-binary-text fail

# Local tooling and personal material stay git-ignored
fresh; grep -v '^\.codex/$' "$d/r/.gitignore" >"$d/gi"; mv "$d/gi" "$d/r/.gitignore"; t codex-not-ignored fail
fresh; grep -v '^\*\.heic$' "$d/r/.gitignore" >"$d/gi"; mv "$d/gi" "$d/r/.gitignore"; t heic-not-ignored fail
fresh; put .env 'PASSWORD=hunter2hunter2'; t tracked-env-file fail
fresh; put private/notes.txt 'plain words'; t tracked-private-folder fail

# With a range it runs the commit check too
fresh; g commit -qm base; g checkout -qb work; put a.txt x; A="person@""gmail.com" g commit -qm x
  t range-personal-author fail master..work
fresh; g commit -qm base; g checkout -qb work; put a.txt x; g commit -qm x; t range-clean pass master..work

[ $fail = 0 ] && echo "privacy-scan: $n cases pass"
exit $fail
