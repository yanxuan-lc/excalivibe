# The numbers the genai.implement and genai.merge gates judge. Append this target to the
# project's Makefile, then replace the two placeholder lines below.
#
# The gate reads ONE line out of stdout and ignores everything else — and ignores the exit code
# too, so a failing suite needs no `|| true` and the test output needs no redirect. Both are
# mistakes that would otherwise break the gate silently.
#
#   genai-metrics: {"tests":{"passed":131,"skipped":0,"failed":2},"coverage":{"lines":0.93,"branches":0.91,"functions":1.0}}
#
# Counts are non-negative integers and the total is computed by the gate, not read — one less
# number that can disagree with itself. Coverage is a fraction in [0,1]: 93 for 93% is refused
# rather than guessed at. Omit or null a dimension the project's tooling does not report.
#
# Read the line out of a machine-readable reporter (JSON, JUnit, lcov summary) — never out of a
# human-readable table. Column widths shift with content, so a scraper passes on an empty project
# and fails on the first real source file, with the gate blaming the code.
.PHONY: genai-metrics
genai-metrics:                 ## the numbers the genai gates judge
	@<run the suite with coverage, writing a machine-readable report>
	@<print one line: genai-metrics: {"tests":{...},"coverage":{...}}>
