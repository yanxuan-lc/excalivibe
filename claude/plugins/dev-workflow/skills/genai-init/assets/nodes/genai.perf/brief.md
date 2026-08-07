# Measure what this change cost at runtime

**Include this step when** the diff touches the data-access layer, the dependency list that ends up
in a build artifact, or any hot path with a declared budget.

Measure only the dimensions this change can actually move, and say which ones you excluded and why.
That sentence is what lets a reader tell "unaffected" from "not measured".

One bare number is not a verdict. Measured, threshold, and baseline-plus-delta — three numbers
are.

## Upstream artifacts

{{inputs}}
{{rejection}}
