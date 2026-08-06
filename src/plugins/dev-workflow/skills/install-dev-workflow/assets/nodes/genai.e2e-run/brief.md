# Execute the suite, and verify what actually landed

Compose **`dev-toolkit:e2e-test`**.

**A green interface assertion sitting on top of a row that was never written is a false pass**, and
catching that is the whole reason this step exists. Every executed path gets both checks: the
visible result, and the effect on persisted state.

Scenarios with mapped test code run as scripts at no model cost; uncovered ones get driven live.
Read-only toward product code and test code alike.

The application has to be up. If it will not start, that is `blocked` rather than a failure — it is
not something the implementation can fix, and it does not consume patience.
