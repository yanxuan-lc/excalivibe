# E2E Manifest - <change-id>

<!--
Copy this file, do not retype it:

  cp .flow/genai/templates/e2e-manifest.md openspec/changes/<id>/genai/e2e-manifest.md

Everything outside the json block is yours — say what a reader needs, in particular why anything is
agent-driven or waived. The gate reads the json block and nothing else.

Buckets, one per scenario, and every scenario in the change appears exactly once:

  mapped        a test case covers it. Needs `test` (the file), `title` (the test's own title,
                which must contain the scenario id) and `db_assert`.
  agent-driven  no scripted seam exists, so it will be driven live during the acceptance run.
                Needs `reason`. Every step of it costs a model call, so use it sparingly.
  waived        genuinely not automatable — a third-party callback, real hardware, a
                non-deterministic external dependency. Needs `reason`. An unmapped scenario is NOT
                waivable: if it can be driven by hand it is agent-driven.

`db_assert` says who verifies the write:

  suite            the test code performs the database verification itself. The acceptance run then
                   re-verifies only a SAMPLE of these, so a `suite` that does not really assert the
                   write weakens the evidence for all of them.
  runner           left to the acceptance run's own scoped queries. Agent-driven is always this.
  not-applicable   the scenario writes nothing.

`run` lists the commands that execute the mapped tests, with machine-readable reporters so results
are parsed rather than scraped. Required whenever any scenario is mapped.

Delete this comment when you fill the file in.
-->

```json
{
  "scenarios": {
    "S1": {
      "bucket": "mapped",
      "test": "e2e/<feature>.spec.ts",
      "title": "S1: <the test's own title>",
      "db_assert": "suite"
    },
    "S2": {
      "bucket": "agent-driven",
      "reason": "<why there is no scripted seam>"
    },
    "S3": {
      "bucket": "waived",
      "reason": "<why no form of execution can reach this>"
    }
  },
  "run": ["<the command that runs the mapped tests, with a machine-readable reporter>"]
}
```
