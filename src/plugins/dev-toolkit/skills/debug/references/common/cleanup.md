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

## Self-Check: zero-residual test

After removal, run:

```bash
grep -rn '\[debug:' .
```

The result MUST be empty. Any hit means a probe is still in the tree — remove it and re-run.

This self-check is **mandatory** before declaring the debug session complete.

### Do not use a bare `git diff` for this

`git diff | grep '\[debug:'` looks like the same check and is not. Removing a probe that was
ever committed produces a **deleted** line, and that line still contains the marker:

```
$ grep -rn '\[debug:' .            # clean
$ git diff | grep '\[debug:'
-  fmt.Println("x") // [debug:foo]  ← the removal itself, matched
```

So the cleaner the removal, the louder this check complains — and the procedure it belongs to
says "repeat the removal", which changes nothing. Committing probes mid-session is exactly what
people do while chasing a bug, so this fires in the common case, not a rare one.

If you want a diff-based view, scope it to **added** lines: `git diff | grep '^+.*\[debug:'`.

### Re-verify after removing probes

Deleting a probe line can leave an import that nothing uses any more, and in Go, Rust, and
anything else with a strict unused-import rule that is a **compile error**, not a warning. So
removal is not the last step: build, run the tests, and start the app once. A cleanup that
leaves the tree not building is worse than the probes were.
