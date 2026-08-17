# Logging: Choosing and Configuring a Logger

How to pick a logging library and how to configure it, in any language. This is a code-level decision — which library, what it emits, where it writes. Shipping those lines to a log platform (collector, index, dashboards, retention) is the platform's side and belongs to `middleware-guideline`; a process that writes correct lines to stdout is already compatible with every collector, which is exactly why the two can be decided separately.

## Choosing

| Level | Rule | Why |
|-------|------|-----|
| [MUST] | **One logger, chosen once, wrapped once.** A single module constructs it and the rest of the code takes it as a dependency. No library is selected in three places, and no request path builds its own. | Two loggers means two formats, two levels and two destinations in the same file. It also makes "add a trace id to every line" a search-and-replace instead of a one-line change. |
| [MUST] | **Structured, level-based, with child/context loggers.** Key-value fields, not interpolated prose; a level per line; and a way to derive a logger that carries fields (request id, tenant, job id) so callers don't repeat them. | A line is read by a machine before a human: `msg="login failed" account=42 reason=locked` is filterable, `"login failed for 42 (locked)"` is a regex problem. Context loggers are what make correlation possible at all. |
| [MUST] | **No `print` / `console.log` / `fmt.Println` in committed code.** Not even temporarily — a debug print has no level, no timestamp and no fields, so it cannot be filtered out later. | It ends up in production output, where it is both noise and, sooner or later, a leak. |
| [SHOULD] | **Prefer the standard library when it is adequate**, and reach for a third-party logger for a concrete reason: allocation-free hot paths, sampling, a sink the stdlib lacks. | The stdlib version is the one every other library in the ecosystem already integrates with, and the one still maintained in five years. "It is faster" is a reason only where the profile says logging is hot. |
| [SHOULD] | **Match the project.** A repository with an established logger gets one more caller, not a second library. | Consistency beats your preference; a mixed-logger codebase is worse than either choice. |

**Per-language defaults** — the first column is what to use unless there is a stated reason:

| Language | Default | Reach for instead when |
|----------|---------|-----------------------|
| Go | `log/slog` (stdlib, structured) | Hot-path allocation matters or sampling is needed: `zerolog`, `zap` |
| TypeScript / Node | `pino` | An existing project already standardizes on something else |
| Python | stdlib `logging`, configured with `dictConfig` | Structured output is a requirement across the codebase: `structlog` |
| Rust | `tracing` + `tracing-subscriber` | Only plain logging is needed and nothing else pulls `tracing`: `log` + `env_logger` |
| Java / Kotlin | SLF4J API + Logback | — (never log to an implementation directly) |
| Swift | `swift-log` (or `os.Logger` on Apple platforms) | — |
| Dart / Flutter | `logging` | — |

## Configuring

| Level | Rule | Why |
|-------|------|-----|
| [MUST] | **stdout is the primary sink** — one line per event, unbuffered enough to survive a crash, no rotation logic of your own. | The runtime collects stdout (container runtime, systemd, supervisor). A process that owns its files owns rotation, permissions and disk-full behaviour too, none of which it does well. |
| [MUST] | **Level comes from configuration** (`LOG_LEVEL`), never from a code constant, and `debug` must be reachable in production without a rebuild. | The moment you need debug logs is the moment you cannot ship a new binary. |
| [MUST] | **Format follows the environment**: JSON (or the collector's format) where it is machine-read, human-readable where a person is watching. One switch, same fields either way. | JSON in a terminal is unreadable and pretty output is unparseable; both are the same event, so it is a rendering choice, not a content one. |
| [MUST] | **Never log secrets or credentials** — passwords, tokens, keys, cookies, full card numbers — and never a whole request/response body without redaction. Keep a deny-list in the logger's own configuration, so it holds for lines nobody reviewed. | Logs are copied, indexed and shared far more widely than the database is. A leak here is a leak with a long tail, and the line that leaks is usually one someone added while debugging. |
| [MUST] | **Timestamps are UTC and ISO-8601**, with the timezone explicit. | Correlating two services across a timezone boundary is otherwise arithmetic under pressure. |
| [SHOULD] | **Carry a correlation id** (request/trace id) on every line, injected once at the entry point and inherited by the context logger. | Without it, "what happened to that user's request" cannot be answered by filtering. |
| [SHOULD] | **Error lines carry the error and the operation** (`err=... op=...`), and log an error **once**, where it is handled — not at every frame it passes. | Re-logging at each level turns one failure into five lines and hides which layer decided what. |
| [SHOULD] | **Startup logs the resolved configuration**, secrets redacted: what it connected to, which mode it is in, which version it is. | It answers "which config is this process actually running with" without a debugger, and it is the first thing an incident needs. |

## The local-development second sink

Local runs want the terminal *and* a file — the terminal for watching, the file for grepping after a failure has scrolled past, and for the case where a run is driven by something that is not a terminal (a task runner starting several processes, an agent running acceptance tests).

| Level | Rule | Why |
|-------|------|-----|
| [SHOULD] | Locally, write **stdout and a file under `logs/<process>.log`** — same lines, both places. Gitignore `logs/`. | Both readers exist: a person watching, and a `grep` five minutes later. |
| [SHOULD] | **One file holds one run.** On start, move the previous file aside (`logs/<process>.log.prev`) and begin a fresh one whose first line stamps the start. | `tail -f` on a file with two runs concatenated is a trap, and the question "did this process ever log X" needs a file whose boundaries are one process lifetime. |
| [SHOULD] | Prefer letting the **task runner** tee the process's stdout over teaching the application a second sink — and if you do, keep the exit code (`set -o pipefail`; a pipeline's status is otherwise `tee`'s success). | It keeps the application single-sink (which is what production wants), works for output the logger never sees (panics, a framework's own startup banner), and needs no config branch. |
| [SHOULD] | When several processes share one terminal, **prefix each line with its process on the terminal only**; keep the file's lines raw. | A reader needs to tell two streams apart; `grep` over the file should not have to know about a prefix. |
| [MUST] | Do **not** make the file sink the primary one, and do not enable it in production. | Then the collector sees nothing, and the process is back to owning rotation and disk space. |
