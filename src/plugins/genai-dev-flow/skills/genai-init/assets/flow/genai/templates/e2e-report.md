# E2E Report - <change-id>

<!--
Copy this file, do not retype it:

  cp .flow/genai/templates/e2e-report.md openspec/changes/<id>/genai/e2e-report.md

Everything outside the json block is yours: the diagnosis behind a failure, what a reproduction
showed, anything the next person needs. The gate reads the json block and nothing else, and it reads
it as acceptance facts — per scenario, what happened and what evidence there is.

  scenarios         every scenario the manifest did not waive needs an entry. A scenario nobody ran
                    is not a scenario that passed.
  execution         `script` or `agent-driven`.
  result            `pass` or `fail`.
  db.verified_by    `runner` (your own scoped SELECTs), `suite` (the test code asserted it, and you
                    re-verified a sample), or `not-applicable` (nothing was written).
  db.evidence       required on every pass: name the rows and columns checked, or, for
                    not-applicable, why there was no write to check. An empty string is refused.
  failures          one entry per failed scenario, with a classification. This is what routes the
                    fix, so classify honestly:
                      product  the app did the wrong thing; the result is real
                      test     stale selector, wrong assertion, fixture that no longer applies
                      infra    the environment failed mid-run; neither side is implicated

Delete this comment when you fill the file in.
-->

```json
{
  "scenarios": {
    "S1": {
      "execution": "script",
      "result": "pass",
      "db": {
        "verified_by": "suite",
        "evidence": "<table, columns and values actually checked>"
      }
    },
    "S2": {
      "execution": "agent-driven",
      "result": "fail"
    }
  },
  "failures": [
    {
      "scenario": "S2",
      "classification": "product",
      "error": "<what happened instead>"
    }
  ]
}
```
