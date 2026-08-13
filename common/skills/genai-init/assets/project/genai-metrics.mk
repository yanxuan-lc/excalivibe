# REFERENCE, not a file that gets copied. The numbers the genai.implement and genai.merge gates
# judge. The executor writes this target into the project's Makefile, with a real recipe rather than
# the placeholder at the bottom.
#
# Nothing installs it, because the recipe is this project's: which reporter its runner produces, and
# how a repository of several modules reports each of them, is not something a template knows.
#
# ── The protocol ──────────────────────────────────────────────────────────────────────────────────
#
# Print ONE LINE PER MODULE, each beginning `genai-metrics: ` and followed by one JSON object naming
# the module it is about:
#
#   genai-metrics: {"module":"server","tests":{"passed":131,"skipped":0,"failed":0},"coverage":{"lines":0.93}}
#   genai-metrics: {"module":"web","tests":{"passed":12,"skipped":0,"failed":0}}
#
# A project of one module may leave `module` out. With several declared it is required — there is no
# honest way to guess which module an unlabelled line is about.
#
# The gate reads those lines and ignores everything else, the exit code included, so a failing suite
# needs no `|| true` and the test output needs no redirect. Both are mistakes that would otherwise
# break the gate silently. It reads stderr the same way, which is why the placeholder below repeats
# no marker: an unfilled recipe fails in the shell, the shell echoes the offending line, and a
# placeholder carrying `genai-metrics: ` would come back as metrics_unreadable instead of the
# metrics_missing that says plainly that nothing has been filled in yet.
#
# ── What each module reports ──────────────────────────────────────────────────────────────────────
#
# Counts are non-negative integers and the total is computed by the gate, not read — one less number
# that can disagree with itself. Coverage is a fraction in [0,1]: 93 for 93% is refused rather than
# guessed at. Report the dimensions this module's tooling actually measures and leave the rest out;
# `tools/genai/thresholds.json` decides which of them are judged, per module.
#
# A module with no unit tests reports its tests and no coverage, or goes unreported entirely. What
# makes that legitimate is its absence from the floors in `thresholds.json` — a decision recorded in
# a file a round may not edit, rather than one a round can award itself.
#
# ── Two details that look like details and are not ────────────────────────────────────────────────
#
# make DOES stop a recipe at the line that failed, so prefix the line that runs the suite with make's
# own `-` — otherwise a failing test means the print line never runs, and the gate reports
# metrics_missing (a broken setup nobody in the round can fix) instead of tests_failing (which the
# round's next attempt can). `-` also leaves make's own `Error 1 (ignored)` visible, which `|| true`
# erases:
#
#   -@<run the suite>
#   @<print the line>
#
# Read the numbers out of a machine-readable reporter (JSON, JUnit, lcov summary) rather than a
# human-readable table. Column widths shift with content, so a scraper passes on an empty project and
# fails on the first real source file, with the gate blaming the code.
#
# A machine-readable format fixes whether the numbers drift; it says nothing about whether the scope
# is complete. Several coverage tools — Node's --experimental-test-coverage among them — report only
# the files a test loaded, so a source file nobody imports is invisible. Where that is this project's
# tool, close the gap inside this target: enumerate the module's source files and score one the
# report never mentions as zero. genai-guideline has it.
.PHONY: genai-metrics
genai-metrics:                 ## the numbers the genai gates judge
	-@<run the suite with coverage, writing a machine-readable report>
	@<print one marked line per module — the example is in the comments above>
