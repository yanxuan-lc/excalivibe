# Derive test code from the acceptance scenarios

**From the scenarios, never from the implementation.** The implementation is what these tests
judge; written by reading it, they can only prove that the code does what it does.

Deliver the test code plus a manifest mapping every stable identifier to a test case — or
declaring it agent-driven, or deliberately uncovered. A scenario missing from the manifest is
indistinguishable from one nobody noticed.

Test code only, never product code. This runs in parallel with implementation; you both work from
the same confirmed design.

## Upstream artifacts

{{inputs}}
{{rejection}}
