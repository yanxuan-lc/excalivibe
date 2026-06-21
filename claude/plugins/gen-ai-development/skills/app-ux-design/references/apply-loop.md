# 落库 commit — the apply-loop protocol

This is the full machinery behind Step 4 Channel C: how inspect-overlay edits
commit back to source. SKILL.md keeps the one-line summary; consult this before
applying.

> **Why edits don't reload the page:** the framework excludes `<stateDir>` (`.ued/`)
> from Vite's file watcher (`server.watch.ignored`). Without that, every appended
> inspect event (each blur) is a change to a non-module file inside the project
> root, and Vite answers with a full page reload — which reloads the app iframe
> mid-edit and closes any open dialog / resets the active tab. With it ignored,
> logging never reloads; only real source writes do, and those are React Fast
> Refresh, which preserves UI state (the dialog/tab stays open).

When the user clicks **落库**, the shell first runs the **fast path**: every net
static `text-edit` / `placeholder-edit` is written straight to source via
`POST /__ued/apply` and marked done with an `{kind:"apply", of:…}` line in the
log. If *all* pending edits went via the fast path, the shell advances `.cursor`
itself and you're never involved. Only the **leftovers** — dynamic text, className
edits, hides, notes, or anything the fast path couldn't resolve uniquely — are
written to `.ued/apply-request.json` (`{seq, offset, count, fast, ts}`, where
`offset` = the log size to apply up to and `count` = leftovers). The shell polls
`.ued/apply-result.json` for a result tagged with the same `seq`. **Your job is
to notice the request and apply the leftovers.**

**Arm a watcher whenever inspect is in play** (after scaffolding, on resume, or
the moment the user starts inspecting). Run a background command that blocks
until the marker changes, so a click re-invokes you with zero chat typing:

```bash
# background watcher — exits when the user clicks 落库; re-arm after each apply.
# mtime() is portable: BSD/macOS uses `stat -f %m`, GNU/Linux uses `stat -c %Y`.
# A hardcoded `stat -f %m` silently never fires on Linux (ref==cur forever, the
# loop hangs), so try both forms and fall back to 0 when the file is absent.
cd <WORKING_DIR>
mtime() { stat -f %m "$1" 2>/dev/null || stat -c %Y "$1" 2>/dev/null || echo 0; }
ref=$(mtime .ued/apply-request.json)
while :; do cur=$(mtime .ued/apply-request.json); [ "$cur" != "$ref" ] && break; sleep 2; done
echo apply-requested
```

When it fires (or the user simply says "应用 inspect 改动"), run the apply loop,
then **re-arm the watcher**.

## The apply loop

1. **Read the pending slice** of `.ued/inspect-events.jsonl` — from the
   `.ued/.cursor` byte offset up to the `offset` in `apply-request.json` (or EOF
   if applying on a chat request). **Filter, in order:** (a) drop events the user
   undid — collect every `{"kind":"undo","of":X}` and drop each matching original
   `X` (match by `kind` + `target.path` + changed value); (b) drop events already
   written by the fast path — collect every `{"kind":"apply","of":X}` and drop the
   target whose net `to` it covers (these are already in source); (c) drop the
   `undo` / `apply` markers themselves. Keep only the **last edit per target**
   (later wins). What remains is the leftovers you must apply.
2. **Apply** each remaining event to source — use `path` + `text` to locate the
   element; verify after each edit. For `placeholder-edit`, change the located
   input/textarea's `placeholder` prop. `note` events are instructions, not
   auto-edits — act on them as feedback. If a target is **dynamic** (e.g. text is `{expr}` /
   className is `cn(...)`) so you can't safely patch it, skip the literal edit and
   handle it by judgement (or leave it for the user) — count it as `skipped`. If
   multiple sites match ambiguously, ask.
3. **Apply** any conversational feedback from the same turn.
4. **Advance `.cursor`** to the `offset` you applied through (the end of the slice).
5. **Write `.ued/apply-result.json`** = `{"seq": <from request>, "applied": <N>,
   "skipped": <M>, "ts": "<iso>"}` so the shell's 落库 button can confirm
   "已写入源码 N 项". (Skip this when applying from a plain chat request.)
6. **Confirm tersely, then re-arm.** On a 落库 commit the user wants the *action*,
   not a report: just apply and reply lean — a single line, or one short bullet
   per edit when there are several (`昵称 → 昵称1`). No preamble, no narrating the
   protocol (cursor / apply-result / fast-path), no re-opening the browser to
   verify — HMR already shows it live and the 落库 button already says "已写入源码
   N 项". Save the detailed walkthrough for when the user asks. Then **re-arm the
   watcher** and wait for the next commit.
