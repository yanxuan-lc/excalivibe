# Debug Probe Cleanup Reference

All temporary debug probes injected during a debug session MUST be tagged and removed before the session ends. This file defines the canonical tag convention and the deterministic cleanup procedure.

## Canonical Tag Body

```
[debug:<id>]
```

- `<id>` is a short **kebab-case** session identifier chosen by the agent at the start of the session (e.g., `null-ref-login`, `timeout-retry-01`).
- The same `<id>` is used for all probes injected in one session, making it trivial to grep every probe added during that session.
- Keep `<id>` short (≤ 20 characters), lowercase, and descriptive enough to be meaningful in a diff.

## Language-Specific Comment Wrappers

Use the comment syntax appropriate for the language. Place the tag on **the same line** as the probe statement.

| Language | Wrapper form | Example |
|---|---|---|
| JavaScript / TypeScript | `// [debug:<id>]` | `console.log('val:', x); // [debug:null-ref-login]` |
| JSX / TSX (expression context) | `{/* [debug:<id>] */}` | `{/* [debug:null-ref-login] */}` |
| Python | `# [debug:<id>]` | `print('val:', x)  # [debug:null-ref-login]` |
| Go | `// [debug:<id>]` | `log.Printf("val: %v", x) // [debug:null-ref-login]` |
| Rust | `// [debug:<id>]` | `dbg!(&x); // [debug:null-ref-login]` |
| Dart / Flutter | `// [debug:<id>]` | `debugPrint('val: $x'); // [debug:null-ref-login]` |
| Shell / Bash | `# [debug:<id>]` | `echo "val: $x" # [debug:null-ref-login]` |

> For multi-line probe blocks, tag every line of the block, or add a start/end comment pair:
> ```js
> // [debug:null-ref-login] start
> console.log('ctx:', ctx);
> console.log('user:', user);
> // [debug:null-ref-login] end
> ```

## Canonical Grep Command

```bash
grep -rn '\[debug:' <project-root>
```

Run this command from the repository root to locate every tagged probe in the project. Replace `<project-root>` with the actual path (e.g., `.` when already at root).

## Deterministic Removal Procedure

1. Run the grep command above and collect all matching file paths and line numbers.
2. For each file reported, open it and delete every line containing `[debug:`.
3. Save each modified file.
4. Run the grep command again and confirm zero output.

## Self-Check: `git diff` Zero-Residual Test

After removal, run:

```bash
git diff | grep '\[debug:'
```

The result MUST be empty. If any `[debug:` lines appear in the diff output, the probe was not fully removed — repeat the removal procedure.

This self-check is **mandatory** before declaring the debug session complete. A non-empty result means temporary instrumentation is being committed to the codebase.
