## 1. Node definitions

- [x] 1.1 Rewrite `executor` in all fourteen `assets/nodes/*/node.yaml` to the block form, following the mapping table in design.md — External Protocol
- [x] 1.2 Confirm the diff is one field per file: no gate, locator, input, or output line moved

## 2. Installer

- [x] 2.1 Replace the regex extraction at `install-flow.mjs:142` with a post-install `fsx nodes -w <workflow> --json` read
- [x] 2.2 Under `--dry-run`, print that the executor summary was skipped and why, instead of an empty list
- [x] 2.3 Keep the accompanying warning intact — nothing validates the names, and how to check them

## 3. Documentation

- [x] 3.1 Restate the executor table in `install-dev-workflow/SKILL.md` in protocol vocabulary
- [x] 3.2 Check no other prose in the plugin names a bare-string executor

## 4. Acceptance

- [x] 4.1 `make build` then `make check` — green, artifact count still 411
- [x] 4.2 In a throwaway project: `fsx init`, run the installer from the **compiled** `claude/` end, then `fsx check` — exits 0, fourteen definitions load
- [x] 4.3 `fsx nodes -w genai` lists all fourteen with their executors resolved by the engine
- [x] 4.4 Run the installer a second time over the same project — idempotent, no error
- [x] 4.5 Run with `--dry-run` on a fresh project — the skip message appears, nothing is written
