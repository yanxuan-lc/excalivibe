# Reading the numbers out of a test run

The `genai-metrics` target has to end up with numbers, and where they come from decides whether the
gate measures the project or measures a formatting accident.

## Do not scrape the suite's human-readable output

The cheapest-looking route is a regex over whatever the test runner prints for people. **That route
breaks on content, not on code.** A coverage summary pads its filename column to the widest path, so
a run with no source files and a run with `src/parse-duration.mjs` in it produce different spacing on
the same line — and a regex written against the first silently matches nothing against the second.
Every dimension comes through absent, the gate reads a declared floor with no measurement behind it
as below the floor, and it rejects a round whose real coverage was 100%. The rejection message blames
the code, which is the expensive part: nothing points at the reporter.

Two consequences worth taking seriously:

- **Prefer a machine-readable reporter** — a JSON or LCOV summary, `--reporter=json`, a coverage
  tool's own data file. A format with a contract does not move when the content does.
- **When there is no choice but to parse text, the install-time check proves nothing.** It runs on an
  empty project, which is exactly the layout the real one will not have. Re-run `make genai-metrics`
  and the atom after the first real source file lands, and compare the numbers against what the suite
  actually reported.

## Silence is a rejection, but plausible numbers are not checked

Nothing in the protocol can be made to pass by leaving something out, which is the property worth
keeping: **the gate demands numbers, so silence is a rejection.** Silence is not the only way to be
wrong, though — a target printing plausible numbers it never measured passes, and no check can see
that. So read what the target actually runs, and run both halves before trusting either:

```bash
make genai-metrics                     # one genai-metrics: line per module, with real numbers
node .flow/genai/check.mjs metrics     # {"result":"satisfied", ...}
```

## Scope, per module

A module's coverage is that module's claim, and some tools quietly narrow it. Several — Node's
built-in `--experimental-test-coverage` among them — report only the files a test actually loaded, so
a file nobody imports never appears and therefore cannot pull any dimension down. Where that is the
tool, the target closes the gap itself: enumerate the module's source files and score one the report
never mentions as zero.

Aggregating **within** one module needs care where its report spans tools — sum covered and total
counts rather than averaging percentages, and mind that merged profiles can list the same block twice
(`go test -coverpkg=./...` does, and summing naively reports about half the real figure).
