#!/usr/bin/env bash
# Cases for the CI gate rule (design 6 §4.1, §10). Usage: scripts/gate_test.sh [rule.jq]
set -uo pipefail
J=${1:-$(dirname "$0")/gate.jq}; fail=0

# mk APP [job=result | job=absent | +job=result]...  builds a toJSON(needs) value
mk(){
  local app=$1; shift
  local jobs=(privacy-scan lint-types unit db e2e a11y-perf) out j r kv
  out='"changes":{"result":"success","outputs":{"app":"'$app'"}}'
  [ "$app" = none ] && out='"changes":{"result":"success","outputs":{}}'
  for kv in "$@"; do [ "${kv%%=*}" = changes ] && out='"changes":{"result":"'${kv#*=}'","outputs":{"app":"'$app'"}}'; done
  for j in "${jobs[@]}"; do r=success
    for kv in "$@"; do [ "${kv%%=*}" = "$j" ] && r=${kv#*=}; done
    [ "$r" = absent ] || out+=',"'$j'":{"result":"'$r'"}'; done
  for kv in "$@"; do [ "${kv:0:1}" = + ] && { kv=${kv:1}; out+=',"'${kv%%=*}'":{"result":"'${kv#*=}'"}'; }; done
  echo "{$out}"
}
t(){
  local n=$1 want=$2 got=fail; shift 2
  mk "$@" | jq -e -f "$J" >/dev/null 2>&1 && got=pass
  [ "$got" = "$want" ] || { echo "FAIL $n: got $got, want $want"; fail=1; }
}
SKIP=(lint-types=skipped unit=skipped db=skipped e2e=skipped a11y-perf=skipped)

t all-green               pass true
t docs-only-skips         pass false "${SKIP[@]}"
t skip-on-app-change      fail true e2e=skipped
t job-failed              fail true unit=failure
t job-cancelled           fail true db=cancelled
t privacy-skipped         fail false "${SKIP[@]}" privacy-scan=skipped
t privacy-failed          fail true privacy-scan=failure
t privacy-missing         fail true privacy-scan=absent
t changes-failed          fail true changes=failure
t app-output-missing      fail none
t e2e-missing             fail true e2e=absent
t e2e-renamed             fail true e2e=absent +e2e-old=success
t extra-job-succeeded     pass true +extra=success
t extra-job-failed        fail true +extra=failure

[ $fail = 0 ] && echo "gate rule: 14 cases pass"
exit $fail
