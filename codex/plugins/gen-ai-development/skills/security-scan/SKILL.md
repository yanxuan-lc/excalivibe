---
name: security-scan
description: SAST + dependency-audit + secret-scan with a blocking-threshold verdict — invoked by name as the security-gate node, or on explicit security check requests.
---

# Security Scan

Run three classes of static security check over a change or a whole codebase — **SAST**
(code-level vulnerability patterns), **dependency / vulnerability audit** (known CVEs in
declared packages), and **secret scanning** (hardcoded credentials) — and report every
finding ranked by severity, in a shape a caller can threshold on.

**This skill reports; it does not decide pass/fail.** It produces severity-ranked findings
plus an overall clean / not-clean summary. Whether any finding blocks is the caller's
decision against the caller's threshold — this skill never gates, never knows what it is
gating, and never reads or writes any pipeline state.

## Procedure

1. **Pick the scope.** Two modes:
   - **Change scope** — scan only the diff (the changed/added files, the moved
     dependencies). Fast; right for an incremental check on a change in flight.
   - **Codebase scope** — scan the whole tree. Right for a one-time sweep or a baseline.
   - **Scope caveat (state it in the report):** secret-scanning *only the diff* misses
     secrets already committed earlier in git history. When the question is "are there any
     leaked secrets," run the secret scan over **full history**, not just the diff.

2. **Detect the languages and ecosystems in play** (by manifest/lockfile and file
   extensions) so you pick the matching tools below. A polyglot repo runs several.

3. **Run each of the three dimensions** (skip a dimension only when it genuinely does not
   apply, and say so in the report):

   **a. SAST — code-level vulnerability patterns.** Run a static analyzer over the in-scope
   source. Common tools:

   | Language | SAST tools |
   |----------|-----------|
   | Any / polyglot | Semgrep (`semgrep --config auto`), CodeQL |
   | JS / TS | Semgrep, ESLint security plugins, `njsscan` |
   | Python | Bandit (`bandit -r`), Semgrep |
   | Go | `gosec`, `go vet`, Semgrep |
   | Rust | `cargo clippy` (security lints), Semgrep |
   | Java / Kotlin | Semgrep, SpotBugs + find-sec-bugs, CodeQL |
   | Ruby | Brakeman (Rails), Semgrep |
   | PHP | Psalm/Phan taint analysis, Semgrep |

   Look for injection (SQL/command/path/template), unsafe deserialization, weak or
   misused crypto, SSRF, XXE, hardcoded trust, missing authz checks, and unsafe-API use.

   **b. Dependency / vulnerability audit — known CVEs in declared packages.** Run the
   ecosystem's audit tool against the lockfile/manifest. Common tools:

   | Ecosystem | Audit tools |
   |-----------|-------------|
   | npm / pnpm / yarn | `npm audit`, `pnpm audit`, `osv-scanner` |
   | Python | `pip-audit`, `safety`, `osv-scanner` |
   | Go | `govulncheck`, `osv-scanner` |
   | Rust | `cargo audit`, `osv-scanner` |
   | Java / Maven / Gradle | OWASP Dependency-Check, `osv-scanner` |
   | Ruby | `bundler-audit`, `osv-scanner` |
   | PHP / Composer | `composer audit`, `osv-scanner` |

   `osv-scanner` is the cross-ecosystem fallback when a native tool is unavailable. Note
   each vulnerable package, the installed version, the fixed version (if any), and the CVE.

   **c. Secret scanning — hardcoded credentials.** Scan for API keys, tokens, private
   keys, passwords, and connection strings. Common tools: `gitleaks`, `trufflehog`,
   `detect-secrets`. Run over full git history when answering "are there leaked secrets"
   (see the scope caveat); over the diff when checking an incremental change. Distinguish a
   live-looking credential from an obvious placeholder/test fixture in the finding.

4. **If a tool is not installed,** say so in the report and either invoke it via the
   ecosystem's runner (e.g. `npx`, `pipx`, `go run`) or note the dimension as **not run**
   — never silently skip it and report "clean."

5. **Normalize and rank the findings, then write the report.**

## Severity taxonomy

Rank every finding into one bucket. Use tool-reported severity as a starting point but
adjust for reachability and exploitability in *this* codebase:

- **Critical** — exploitable now with serious impact (RCE, auth bypass, a live leaked
  secret, a CVE with a known exploit on a reachable path).
- **High** — a real vulnerability on a plausible path (injection, SSRF, a high-severity
  CVE in a used dependency).
- **Medium** — a weakness that needs other conditions to exploit, or a vulnerable
  dependency on a path that may not be reachable.
- **Low** — hardening / defense-in-depth; low-severity advisories.
- **Info** — notable but not a vulnerability (e.g. a secret that is clearly a placeholder).

## Report contract

Write a report (e.g. `security-scan-report.md`) so a caller can threshold on it
mechanically. It contains:

- **An overall status line** — `clean` (no findings at or above a stated severity) or
  `not-clean`, with per-severity counts (e.g. `not-clean — Critical: 1, High: 2, Medium: 4`).
- **The scope** scanned — change vs codebase, and whether the secret scan covered full
  history or just the diff.
- **The commit stamp and tool invocations** — the SHA scanned, and each tool's exact
  command + real exit code, so a later consumer can tell the report is current for the
  tree and trust it instead of re-scanning.
- **The three dimensions** each marked run / not-run (with the reason if not-run).
- **Per finding**, a row carrying:
  - `severity` — one bucket from the taxonomy above;
  - `location` — file:line, or package@version for a dependency finding;
  - `what` — the vulnerability class / rule / CVE id and a one-line description;
  - `remediation` — the concrete fix (sanitize input, bump to the fixed version, rotate
    and remove the secret).

The caller reads the status line and per-finding severities and applies its own threshold.
The threshold, and any decision that follows from it, is entirely the caller's.
