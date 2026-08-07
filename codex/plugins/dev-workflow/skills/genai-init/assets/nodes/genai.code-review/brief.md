# Review this change's diff before it merges

Incremental, read-only, in a fresh context. **Two independent verdicts**: whether it complies with
the design, and whether the code itself is sound. One verdict covering both hides which of the two
failed.

Sweep for accumulated bad smells while you are here — compose **`dev-toolkit:smell-scan`**. It
detects; it does not edit, and it does not decide which candidates get acted on.

Read-only means read-only: finding a one-line fix is not a licence to apply it. Whoever verifies
must not also repair, or the next review is of your own work.

## Upstream artifacts

{{inputs}}
{{rejection}}
