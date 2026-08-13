# REFERENCE, not a file that gets copied. The numbers the genai.implement and genai.merge gates
# judge. The executor writes this target into the project's Makefile, with a real recipe rather than
# the placeholder at the bottom.
#
# Nothing installs it, because the recipe is this project's: which reporter its runner produces, and
# how a repository of several modules aggregates across them, is not something a template knows. A
# placeholder written by a script only moves that work later while leaving a target that fails by
# construction. Keep the placeholder for the one case it is honest — the executor could not
# determine the command — and say so in the report rather than leaving it silently.
#
# The gate reads ONE line out of stdout and ignores everything else — and ignores the exit code
# too, so a failing suite needs no `|| true` and the test output needs no redirect. Both are
# mistakes that would otherwise break the gate silently.
#
# It reads stderr the same way, which is why neither placeholder line below repeats the marker: an
# unfilled recipe fails in the shell, and the shell echoes the offending line. A placeholder carrying
# `genai-metrics: ` would come back as metrics_unreadable with the placeholder text as evidence,
# instead of the metrics_missing that says plainly that nothing has been filled in yet.
#
#   genai-metrics: {"tests":{"passed":131,"skipped":0,"failed":2},"coverage":{"lines":0.93,"branches":0.91,"functions":1.0}}
#
# But make DOES stop a recipe at the line that failed, so prefix the line that runs the suite with
# make's own `-` — otherwise a failing test means the print line below never runs, and the gate
# reports metrics_missing (a broken setup nobody in the round can fix) instead of tests_failing
# (which the round's next attempt can). `-` also leaves make's own `Error 1 (ignored)` visible,
# which `|| true` erases:
#
#   -@<run the suite>
#   @<print the line>
#
# Counts are non-negative integers and the total is computed by the gate, not read — one less
# number that can disagree with itself. Coverage is a fraction in [0,1]: 93 for 93% is refused
# rather than guessed at. Omit or null a dimension the project's tooling does not report.
#
# Read the line out of a machine-readable reporter (JSON, JUnit, lcov summary) — never out of a
# human-readable table. Column widths shift with content, so a scraper passes on an empty project
# and fails on the first real source file, with the gate blaming the code.
#
# A machine-readable format fixes whether the numbers drift; it says nothing about whether the scope
# is complete. Several coverage tools — Node's --experimental-test-coverage among them — report only
# the files a test loaded, so a module nobody imports cannot pull any dimension down and an entire
# unimplemented file is invisible. If that is this project's tool, this target closes the gap itself:
# enumerate the source files and score one the report never mentions as zero. genai-guideline has it.
.PHONY: genai-metrics
genai-metrics:                 ## the numbers the genai gates judge
	-@<run the suite with coverage, writing a machine-readable report>
	@<print the marked line — the example is in the comments above>
