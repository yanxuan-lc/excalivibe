# Go Debug Guide

## 1. Tagged Probe Injection

Use `log` or `slog` with the `[debug:<id>]` tag on the same line.

```go
import "log"

// log package (standard)
log.Printf("[debug:my-session] value: %v", value) // [debug:my-session]
log.Printf("[debug:my-session] ctx: %+v", ctx) // [debug:my-session]
```

```go
import "log/slog"

// slog (Go 1.21+) — structured, preferred for new code
slog.Debug("[debug:my-session] request", "method", r.Method, "url", r.URL) // [debug:my-session]
```

For quick one-liner inspection of a value:

```go
fmt.Printf("[debug:my-session] %T %+v\n", val, val) // [debug:my-session]
```

See `../common/cleanup.md` for the full tag convention and removal procedure.

## 2. Reproduce / Run Command

```bash
# Run all tests
go test ./...

# Run a specific package
go test ./internal/auth/...

# Run a single test function (exact name match)
go test ./... -run TestLoginHandler

# With verbose output (shows each test name and PASS/FAIL)
go test ./... -v

# With race detector (recommended for concurrency bugs)
go test ./... -race
```

Exit code 0 = all tests pass. Exit code 1 = at least one test failed or there is a compilation error.

Build only (no tests):

```bash
go build ./...
```

## 3. Error-Driven Exit-Code Convention (Loop B)

| Exit code | Meaning |
|---|---|
| 0 | All tests pass (or build succeeds) |
| 1 | Test failure or compilation error — read stderr for details |
| Non-zero (other) | Tool invocation failure, missing dependency, etc. |

When a test fails, Go prints the test function name, the failing file:line, and the assertion message to stderr. Read this output directly; do not ask the user to paste it.

A panic during a test will also appear in stderr with a full goroutine stack trace — locate the frame in user code (below the `testing.tRunner` frame) to find the source of the panic.

## 4. CLI Debugger for Loop C — `dlv` (Delve)

Install Delve if not present:

```bash
go install github.com/go-delve/delve/cmd/dlv@latest
```

**Debug a test:**

```bash
dlv test ./internal/auth -- -test.run TestLoginHandler
```

**Debug a binary:**

```bash
dlv debug ./cmd/server
```

Inside `dlv`:

```
(dlv) break auth.go:45          # set breakpoint at file:line
(dlv) break LoginHandler        # set breakpoint at function
(dlv) continue                  # run until breakpoint
(dlv) print val                 # inspect variable
(dlv) locals                    # print all local variables
(dlv) stack                     # print call stack
(dlv) next                      # step over
(dlv) step                      # step into
(dlv) quit
```

> Loop C requires an interactive terminal (TTY). In headless / CI contexts, fall back to Loop A (tagged `log` probes reviewed in `go test -v` output).

## 5. Browser Handoff

Go is a backend language; browser debugging is **n/a** for server-side Go code. If the symptom is in a Go-served web frontend, invoke the `graceful-browser` skill for browser-side inspection.
