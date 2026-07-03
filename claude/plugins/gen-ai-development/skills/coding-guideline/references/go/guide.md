# Go Guide

Go-specific conventions. Assumes familiarity with the universal principles in SKILL.md.

## Formatting

`gofmt` is non-negotiable. All Go code must be formatted by `gofmt` (or `goimports`). Do not argue about style — the formatter decides.

## Naming

Go's naming carries visibility semantics — uppercase is exported, lowercase is unexported. Beyond that:

- **Packages**: short, lowercase, single-word. `http`, `auth`, `billing`. Never `utils` or `helpers` — find a more specific name.
- **Interfaces**: named by the method they declare, often single-method. `Reader`, `Writer`, `Stringer`. Do not prefix with `I`.
- **Getters**: `Name()`, not `GetName()`. Go convention omits `Get`.
- **Acronyms**: all caps when standalone — `HTTP`, `ID`, `URL`. In mixed case: `userID`, `httpClient`.

## Error Handling

Errors are values. Return them; do not panic.

```go
func fetchUser(id string) (User, error) {
    resp, err := http.Get(userURL + id)
    if err != nil {
        return User{}, fmt.Errorf("fetching user %s: %w", id, err)
    }
    defer resp.Body.Close()
    // ...
}
```

- Wrap errors with context using `fmt.Errorf("context: %w", err)`.
- Use `errors.Is` and `errors.As` for programmatic error checking.
- Define sentinel errors (`var ErrNotFound = errors.New("not found")`) or custom error types for errors callers need to handle.
- `panic` is reserved for truly unrecoverable states (e.g., programmer errors during initialization). Never use it for expected failure paths.

## Interfaces

- Define interfaces where they are **consumed**, not where they are implemented. A function that needs a reader declares `io.Reader` in its signature — the concrete type doesn't know or care.
- Keep interfaces small. One or two methods is ideal. Accept interfaces, return structs.
- Avoid premature interface extraction — if there's only one implementation, use the concrete type.

## Concurrency

- Prefer channels for coordination, mutexes for state protection.
- Always make goroutine lifetimes explicit. A goroutine that outlives its parent function must have a clear shutdown mechanism (`context.Context`, done channel, `sync.WaitGroup`).
- Never launch a goroutine without a plan for how it stops.

## Package Structure

```
project/
├── cmd/
│   └── server/
│       └── main.go
├── internal/
│   ├── auth/
│   ├── billing/
│   └── storage/
├── pkg/            # (only if you publish reusable libraries)
├── go.mod
└── go.sum
```

- `internal/` for code that must not be imported by other modules.
- `cmd/` for entry points — each sub-directory is a binary.
- `pkg/` only when you genuinely intend external consumers.

## Doc-Comments (godoc)

Go doc-comments are plain `//` comments directly above the declaration, with no blank line between the comment and the declaration. godoc and pkg.go.dev render them automatically.

```go
// FetchUser retrieves a user profile by ID.
//
// It returns ErrNotFound if no user matches the given ID.
// The caller is responsible for closing the returned profile's
// underlying resources.
func FetchUser(ctx context.Context, id string) (*User, error) {
    // ...
}

// MaxRetries is the number of retry attempts for transient failures.
// Tuned to balance reliability against latency — 3 retries with
// exponential backoff covers most network blips.
const MaxRetries = 3

// UserService manages user lifecycle operations including creation,
// retrieval, and deactivation.
//
// It is safe for concurrent use.
type UserService struct {
    db *sql.DB
}

// ErrNotFound is returned when a requested resource does not exist.
var ErrNotFound = errors.New("not found")
```

- First line starts with the declaration name: `// FetchUser retrieves...`, not `// This function retrieves...`.
- First sentence is a complete sentence ending with a period — this sentence appears in package index listings.
- Additional paragraphs separated by a blank `//` line for details, error conditions, and caveats.
- Document all exported identifiers (functions, types, constants, variables). Unexported identifiers only need comments when behavior is non-obvious.
- Package-level comments go in a `doc.go` file for packages with substantial documentation.

## Time & Timezone

Go's `time.Time` represents an instant (a point on the timeline) plus a `Location` used for wall-clock rendering. MySQL's `DATETIME` / `DATETIME(3)` columns store a wall-clock literal with **no** timezone. The mismatch is a common source of silent bugs — they pass tests, fail production. Treat the rules below as non-negotiable when SQL meets Go time.

### Rule 1: Know what the driver does to your `time.Time`

`github.com/go-sql-driver/mysql` translates `time.Time` against the DSN's `loc=` parameter on **both directions**:

- **Writing**: the driver converts the instant into wall-clock components *in the DSN's location*, then sends that string.
- **Reading (with `parseTime=true`)**: the driver parses the DATETIME literal as if it were wall-clock in the DSN's location, producing a `time.Time` at that `Location`.

Default `loc` is `UTC` if the parameter is omitted. With `loc=Asia/Shanghai`, a `time.Date(1970, 1, 1, 0, 0, 0, 0, time.UTC)` written via parameter binding arrives at MySQL as the literal `'1970-01-01 08:00:00'`, not `'1970-01-01 00:00:00'`.

### Rule 2: Never compare a Go time constant to a DDL string default by binding it

```go
// BAD — silently broken under loc=Asia/Shanghai.
var epochSentinel = time.Date(1970, 1, 1, 0, 0, 0, 0, time.UTC)
db.QueryRow(`SELECT ... WHERE revoked_at = ?`, epochSentinel)
```

Under `loc=Asia/Shanghai`, the driver emits `'1970-01-01 08:00:00'` and the row whose stored default is `'1970-01-01 00:00:00.000'` never matches. Tests with `loc=UTC` (or no `loc=`) pass because both sides happen to render to `'1970-01-01 00:00:00'` — the bug is invisible until prod uses a non-UTC DSN.

Fix: bind the literal **as a string** so the driver doesn't translate at all. MySQL implicit-converts the string parameter to `DATETIME` and the comparison is wall-clock equality, regardless of DSN.

```go
// GOOD — driver does not translate strings; MySQL compares wall-clock literals.
const epochSentinel = "1970-01-01 00:00:00.000"
db.QueryRow(`SELECT ... WHERE revoked_at = ?`, epochSentinel)
```

### Rule 3: Never use `time.Time.Equal` for sentinel comparisons across Location boundaries

`Equal` compares **instants**, not wall-clock. A row read with `loc=Asia/Shanghai` surfaces as `1970-01-01 00:00:00 +08:00` — eight hours away from `1970-01-01 00:00:00 UTC`. They are *not* equal.

```go
// BAD — fails whenever the row's Location ≠ the constant's Location.
func isUnset(t time.Time) bool { return t.Equal(epochSentinel) }

// GOOD — wall-clock equality, Location-agnostic.
func isUnset(t time.Time) bool {
    y, m, d := t.Date()
    return y == 1970 && m == time.January && d == 1 &&
        t.Hour() == 0 && t.Minute() == 0 && t.Second() == 0 && t.Nanosecond() == 0
}
```

### Rule 4: For ordering and drift checks, work in Unix seconds, not `time.Time`

When the question is *"is this within ±N seconds of now"* or *"earlier than that"*, drop to `time.Unix()`:

```go
// HMAC replay window: drift bound is a duration, not a wall-clock.
if abs(time.Now().Unix() - clientTs) > int64(maxDrift.Seconds()) {
    reject("ts_drift")
}
```

Unix seconds are pure instants — no Location, no driver involvement.

### Rule 5: Pick one timezone for the data plane and write it down

For each DATETIME column, your team must answer: *"What wall-clock semantics does this carry?"* The two reasonable answers are **UTC** (industry standard, cross-timezone friendly) or **a single business timezone like `Asia/Shanghai`** (simpler when everyone is in one office, but couples the schema to that office forever).

Whichever you pick, encode it in three places that must agree:

1. DDL comment on the column (`COMMENT '事件时间，北京时间+08:00'`).
2. DSN `loc=` parameter (so the driver translates consistently).
3. A doc / ADR in the repo (`docs/.../timezone.md`) describing the rule and the rationale.

Drift in any of the three is what produces the bugs above. Mention this contract in code review checklists for store-layer changes.

### Rule 6: Regression-test the DSN loc you actually deploy with

The default integration-test DSN is often `parseTime=true` with no `loc=`, which the driver maps to UTC. That hides every bug in rules 1–3. Either:

- Set `loc=Asia/Shanghai` (or whatever production uses) in the integration test DSN; or
- Add a focused unit test for sentinel/equality helpers that constructs `time.Time` values in *both* `time.UTC` and `time.FixedZone("Asia/Shanghai", 8*3600)`, including the trap case `time.Unix(0, 0).In(shanghai)` (instant epoch, wall-clock `08:00`).

The unit-test approach is faster and easier to maintain — it directly pins down the wall-clock semantics independent of any DB.

## Conventions

- **Zero values are useful.** Design structs so the zero value is a valid, usable default.
- **`context.Context`** as the first parameter for functions that cross boundaries (HTTP handlers, DB calls, RPCs).
- **Table-driven tests** for repetitive test cases:

```go
tests := []struct {
    name  string
    input string
    want  int
}{
    {"empty", "", 0},
    {"single", "a", 1},
}
for _, tt := range tests {
    t.Run(tt.name, func(t *testing.T) {
        got := count(tt.input)
        if got != tt.want {
            t.Errorf("count(%q) = %d, want %d", tt.input, got, tt.want)
        }
    })
}
```

- **`defer`** for cleanup. Place it immediately after acquiring the resource.
- **No `init()` functions** unless absolutely necessary — they obscure startup behavior. Pass dependencies explicitly.
