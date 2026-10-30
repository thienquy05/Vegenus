#!/usr/bin/env bash
# Cases for the commit check (design 6 §8, §10). Usage: scripts/tests/check_commits_test.sh
# Fixture values are split ("a""b") so this file never holds the literal it tests for.
set -uo pipefail
C=$(cd "$(dirname "$0")/.." && pwd)/check-commits.sh; fail=0; n=0
d=$(mktemp -d); trap 'rm -rf "$d"' EXIT
NR=1+bot@users.noreply.github.com; ME="person@""gmail.com"
printf '\x89PNG\0approved' >"$d/ok.bin"; printf '\x89PNG\0photo' >"$d/photo.bin"; OKSHA=$(shasum -a 256 "$d/ok.bin" | cut -d' ' -f1)

# g ARGS: git in the fixture repo; author and committer from $A and $K (default noreply), author name from $N.
g(){ GIT_AUTHOR_NAME=${N:-t} GIT_AUTHOR_EMAIL=${A:-$NR} GIT_COMMITTER_EMAIL=${K:-$NR} git -C "$d/r" -c user.name=t \
  -c core.hooksPath=/dev/null -c commit.gpgsign=false "$@"; }
put(){ mkdir -p "$(dirname "$d/r/$1")"; printf '%s\n' "$2" >"$d/r/$1"; g add -f -- "$1"; }
ci(){ g commit -qm "${1:-change}"; }
# master holds a logo manifest approving ok.bin's checksum (and $1 if given); cases commit on `work`.
fresh(){ rm -rf "$d/r"; git init -q -b master "$d/r"
  put assets/logo/manifest.json '{"files":[{"file":"ok.png","sha256":"'"$OKSHA"'"},{"file":"a.svg","sha256":"'"${1:-}"'"}]}'; ci base
  g checkout -qb work; }
t(){
  local name=$1 want=$2 got=fail; shift 2; n=$((n + 1))
  (cd "$d/r" && MANIFEST_REF=master "$C" "${@:-master..work}") >/dev/null 2>&1 && got=pass
  [ "$got" = "$want" ] || { echo "FAIL $name: got $got, want $want"; fail=1; }
}
# line NAME WANT PATH TEXT: one commit adding TEXT to PATH. svgline NAME WANT TEXT: the same as an
# a.svg whose checksum master approves, so only the text patterns decide.
line(){ fresh; put "$3" "$4"; ci; t "$1" "$2"; }
svgsha(){ printf '%s\n' "$1" | shasum -a 256 | cut -d' ' -f1; }
svgline(){ fresh "$(svgsha "$3")"; put a.svg "$3"; ci; t "$1" "$2"; }

# Commit metadata and messages
fresh; put a.txt x; ci; t noreply-clean pass
fresh; put a.txt x; A=$ME ci; t personal-author fail
fresh; put a.txt x; K=$ME ci; t personal-committer fail
fresh; put a.txt x; ci $'feat: x\n\nCo-Authored-By: Claude <noreply@anthropic.com>'; t anthropic-coauthor pass
fresh; put a.txt x; ci "fix: reported by $ME"; t personal-in-message fail
fresh; put a.txt x; ci $'d\ndeploy notes'; t message-line-d pass
fresh; t no-new-commits pass master..master
fresh; put a.txt x; A=harness-os@localhost K=harness-os@localhost ci; t harness-localhost pass
fresh; put a.txt x; N="Call 09""12 345 678" ci; t phone-in-author-name fail
line uid-in-path fail "nfc/04a1b2c""3d4e5f6.json" x

# Added lines, including values removed again later
fresh; put a.txt "$ME"; ci; put a.txt x; ci; t added-then-removed fail
line personal-in-line fail a.txt "contact $ME"
line resend-sender pass a.txt "from onboarding@resend.dev"
line reserved-domains pass a.txt "owner@example.test admin@sub.example.com x@y.invalid"
fresh; put a.txt base; ci; g checkout -q master; put a.txt master; ci; g checkout -q work
  put a.txt work; ci; g merge -q master >/dev/null 2>&1; put a.txt "$ME"; ci merge
  put a.txt clean; ci; t merge-resolution fail
fresh; g checkout -q --orphan o; g rm -rqf .; put a.txt "$ME"; ci root; t root-commit fail o

# Binary blobs: approved only by a manifest as it is on master
fresh; cp "$d/photo.bin" "$d/r/photo.jpg"; g add -f photo.jpg; ci; g rm -q photo.jpg; ci; t photo-added-then-deleted fail
fresh; cp "$d/photo.bin" "$d/r/notes.md"; g add notes.md; ci; t binary-named-md fail
fresh; cp "$d/ok.bin" "$d/r/assets/logo/ok.png"; g add -f assets/logo/ok.png; ci; t approved-png pass
fresh; cp "$d/photo.bin" "$d/r/x.png"; g add -f x.png
  put assets/logo/manifest.json '{"files":[{"file":"x.png","sha256":"'"$(shasum -a 256 "$d/photo.bin" | cut -d' ' -f1)"'"}]}'
  ci; t self-approved-photo fail
fresh; cp "$d/ok.bin" "$d/r/assets/logo/ok.png"; g add -f assets/logo/ok.png; ci; g rm -q assets/logo/ok.png; ci; t approved-png-deleted pass
fresh; put .gitattributes '*.jpg diff'; cp "$d/photo.bin" "$d/r/photo.jpg"; g add -f photo.jpg; ci; g rm -q photo.jpg; ci; t forced-text-photo fail
fresh; put photo.png 'no NUL byte'; ci; g rm -q photo.png; ci; t image-name-without-nul fail
fresh; put .gitattributes '*.txt -diff'; put a.txt "$ME"; ci; t forced-binary-text fail
fresh; put .gitattributes '*.txt binary'; put a.txt "$ME"; ci; g rm -q a.txt; ci; t forced-binary-text-removed fail
fresh; g checkout -q master; put .gitignore .env; ci; g checkout -qB work master
  put .env 'PASSWORD=hunter2hunter2'; ci; g rm -q .env; ci; t ignored-file-added-then-removed fail
fresh; put secret/.gitignore '*'; put secret/notes.txt 'plain words'; ci; g rm -rq secret; ci; t nested-ignore-removed-too fail
fresh; put -x/.gitignore '*'; put -x/notes.txt 'plain words'; ci; g rm -rq -- -x; ci; t dash-dir-ignore-removed fail
fresh; put a.txt x; ci; TMPDIR=$d/missing t scratch-dir-unavailable fail
# shim WORD: a grep that fails (exit 2, like a PCRE limit error) when its arguments hold WORD.
G=$(type -P grep); mkdir -p "$d/shim"
shim(){ printf '#!/usr/bin/env bash\ncase "$*" in *%q*) exit 2 ;; esac\nexec %q "$@"\n' "$1" "$G" >"$d/shim/grep"; chmod +x "$d/shim/grep"; }
fresh; put a.txt x; ci; shim 'PRIVATE KEY'; PATH=$d/shim:$PATH t matcher-error fail
fresh; put a.txt x; ci; shim '"integrity"'; PATH=$d/shim:$PATH t preprocessing-error fail
fresh; put a.txt x; ci; shim 'users'; PATH=$d/shim:$PATH t email-check-error fail
# gitshim WORD: the same for git, failing (exit 128) the one call whose arguments hold WORD.
GIT=$(type -P git); mkdir -p "$d/gitshim"
gitshim(){ printf '#!/usr/bin/env bash\ncase "$*" in *%q*) exit 128 ;; esac\nexec %q "$@"\n' "$1" "$GIT" >"$d/gitshim/git"; chmod +x "$d/gitshim/git"; }
fresh; put a.png 'no NUL byte'; ci; gitshim '--raw'; PATH=$d/gitshim:$PATH t raw-diff-error fail
fresh; put a.txt x; ci; gitshim '--format=%B'; PATH=$d/gitshim:$PATH t message-log-error fail
fresh; put a.txt x; ci; gitshim '%an <%ae>'; PATH=$d/gitshim:$PATH t metadata-log-error fail
fresh; put a.txt x; ci; gitshim 'ls-tree'; mkdir -p "$d/tmp"; TMPDIR=$d/tmp PATH=$d/gitshim:$PATH t base-snapshot-error fail
  [ -z "$(ls -A "$d/tmp")" ] || { echo "FAIL base-snapshot-error: scratch folder left behind"; fail=1; }
# A git whose second blob read prints the approved bytes, then fails: a read that is not checked
# would approve the photo.
printf '#!/usr/bin/env bash\ncase "$*" in *"cat-file blob"*) n=$(cat %q 2>/dev/null || echo 0); echo $((n + 1)) >%q
  [ "$n" -ge 1 ] && { cat %q; exit 128; } ;; esac\nexec %q "$@"\n' "$d/n" "$d/n" "$d/ok.bin" "$GIT" >"$d/gitshim/git"
fresh; cp "$d/photo.bin" "$d/r/x.dat"; g add x.dat; ci; rm -f "$d/n"; PATH=$d/gitshim:$PATH t blob-read-error fail

# Images inside text (data URIs)
B64SVG='<svg><image href="data'':image/png;base64,iVBORw0KGgo="/></svg>'
fresh "$(svgsha "$B64SVG")"; put a.svg "$B64SVG"; ci; g rm -q a.svg; ci; t svg-base64-photo-removed fail
svgline plain-vector-svg pass '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h1v1z"/></svg>'
line unapproved-plain-svg fail b.svg '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h1v1z"/></svg>'
line data-uri-charset fail a.css 'url("data'':image/svg+xml;charset=utf-8,%3Csvg%3E")'
line data-uri-percent fail a.css 'url(data'':image%2Fsvg+xml,%3Csvg)'
line data-uri-upper fail a.html '<img src="DATA'':IMAGE/PNG;BASE64,AAAA">'
line data-uri-base64-text fail a.txt 'data'':text/plain;base64,aGk='

# package-lock.json: an address only in npm's "deprecated" text (Q93)
line lock-deprecated pass package-lock.json "      \"deprecated\": \"ask $ME\","
line lock-other-field fail package-lock.json "      \"author\": \"$ME\","
line lock-deprecated-plus-author fail package-lock.json "      \"deprecated\": \"old\", \"author\": \"$ME\","
line lock-deprecated-escaped-quote pass package-lock.json "      \"deprecated\": \"say \\\"hi\\\" to $ME\","
line deprecated-other-file fail other.json "      \"deprecated\": \"ask $ME\","

# Keys and tokens
line private-key fail a.txt "-----BEGIN RSA ""PRIVATE KEY-----"
line github-token fail a.txt "ghp_""abcdefghijklmnopqrstuvwxyz0123456789"
line jwt fail a.txt "eyJhbGciOiJIUzI1NiJ9"".eyJzdWIiOiIxIn0.c2ln"
line supabase-secret fail a.txt "sb_""secret_abcdefghijklmnop0123"
line aws-key fail a.txt "AKIA""ABCDEFGHIJKLMNOP"
line guest-token fail a.txt "https://x.example/g#AbCdEfGhIjKlMnOpQrStUvWxYz0123456789""_-abcde"
line guest-token-query fail a.txt "?t=AbCdEfGhIjKlMnOpQrStUvWxYz0123456789""_-abcde&x=1"
line guest-token-no-digit fail a.txt "#AbCdEfGhIjKlMnOpQrStUvWxYz""AbCdEfGhIjKlMnOpQ"
line guest-token-in-path fail a.txt "/g/AbCdEfGhIjKlMnOpQrStUvWxYz0123456789""_-abcde/"
line guest-token-in-base64 fail a.txt "x+AbCdEfGhIjKlMnOpQrStUvWxYz0123456789""_-abcde="
line integrity-plus-token fail package-lock.json '      "integrity": "sha512-Aup7aUOf''pbAUg2ROOJN6Iw5f9DMBlzu0mIkm/malLQFN/YQgO48wCj0Kxa3sEHJvPVFg7siR+qRInwXd2qhQKw==", "t": "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789''_-abcde"'
line kebab-anchor pass a.md "see #122-workflow-layout-github-actions-proposal"
line integrity-hash pass package-lock.json '      "integrity": "sha512-Aup7aUOf''pbAUg2ROOJN6Iw5f9DMBlzu0mIkm/malLQFN/YQgO48wCj0Kxa3sEHJvPVFg7siR+qRInwXd2qhQKw==",'

# NFC tag UIDs (4, 7 or 10 bytes)
line uid-7-colon fail a.txt "tag 04:A1:B2"":C3:D4"":E5:F6"
line uid-4-dash fail a.txt "tag DE-AD""-BE-EF"
line uid-7-compact fail a.txt "tag 04a1b2""c3d4""e5f6"
line uid-7-digits fail a.txt "tag 04:11:22"":33:44"":55:66"
line uid-4-compact fail a.txt "tag 04a1""b2c3"
line uid-7-compact-digits fail a.txt "tag 04112233""445566"
svgline uid-in-svg-title fail '<svg><title>tag 04:A1:B2'':C3:D4'':E5:F6</title></svg>'
line uuid pass a.txt "123e4567-e89b-12d3-a456-426614174000"
line css-colour pass a.css "color: #aabbccdd;"
line short-sha-and-date pass a.md "commit 1069604 on 20261029"
line time-range pass a.txt "23:00-01:00"
line mac-address pass a.txt "aa:bb:cc:dd:ee:ff"
svgline svg-path-numbers pass '<path d="M3 4-14-11-14-10z"/>'
line migration-stamp pass a.txt "20261028120000_core.sql"
line uid-after-dash fail "nfc/tag-04a1b2c""3d4e5f6.json" x
line uid-after-underscore fail a.txt "tag_04a1b2""c3"
line uid-before-dash fail a.txt "04a1b2c""3d4e5f6-front"
line uuid-upper pass a.txt "123E4567-E89B-12D3-A456-426614174000"
line prerelease-version pass package-lock.json '        "react": "^18.2.0 || 19.0.0-rc-de68d2f4-20241204 || ^19.0.0"'
line uid-after-other-word fail a.txt "tag-de68""d2f4"

# Phone numbers
line phone-vn fail a.txt "call 09""12 345 678"
line phone-vn-intl fail a.txt "call +84 912"" 345 678"
line phone-e164 fail a.txt "call +1415""5550100"
line byte-count pass a.txt '"bytes": 3356328,'
line phone-after-equals fail a.txt "PHONE=09""12345678"
line phone-in-path fail "docs/09""12345678.md" x

[ $fail = 0 ] && echo "check-commits: $n cases pass"
exit $fail
