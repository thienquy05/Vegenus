# CI gate rule (design 6 §4.1). Input: toJSON(needs). Tested by scripts/gate_test.sh.
(["changes","privacy-scan","lint-types","unit","db","e2e","a11y-perf"] - keys == [])
and .changes.result == "success"
and (.changes.outputs.app == "true" or .changes.outputs.app == "false")
and .["privacy-scan"].result == "success"
and ((.changes.outputs.app) as $app
     | [to_entries[] | select(.key != "changes" and .key != "privacy-scan") | .value.result]
     | all(. == "success" or (. == "skipped" and $app == "false")))
