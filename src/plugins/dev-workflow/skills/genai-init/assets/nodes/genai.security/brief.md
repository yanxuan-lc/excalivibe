# Run the static security checks over this change

**Include this step when** the diff touches authentication, authorization, input handling, crypto,
file-path construction, or the third-party dependency list — and before any outward release,
whatever the diff touched.

**State the scope you scanned.** A diff-only scan cannot see a credential committed last month, and
removing one from HEAD does not remove it from any clone that already exists. A report without its
scope reads as "nothing was found" when the truth is "nothing was looked for".
