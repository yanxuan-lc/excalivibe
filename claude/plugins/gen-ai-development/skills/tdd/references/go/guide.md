# Go TDD Toolchain

The standard `testing` package — no external framework needed.

## Stack

- **Test runner**: `go test`
- **Run command**: `go test ./...`
- **Coverage command**: `go test -coverprofile=coverage.out ./... && go tool cover -func=coverage.out`
- **Function / interface coverage**: `go tool cover -func` already prints per-function coverage (final line = total). The 100% interface gate is that every *exported* (capitalized) function shows non-zero coverage; unexported helpers are not part of the gate.
- **Mocking**: Interface-based fakes (no framework required)

## File Organization

Tests live alongside source in the same package:

```
internal/
├── auth/
│   ├── auth.go
│   └── auth_test.go
├── billing/
│   ├── billing.go
│   └── billing_test.go
└── storage/
    ├── storage.go
    └── storage_test.go
```

- `_test.go` suffix — Go convention, auto-excluded from production builds.
- Same package for white-box tests, `_test` package suffix for black-box:
  - `package auth` — can test unexported functions
  - `package auth_test` — tests only the public API (preferred for TDD)

## Test Example

```go
package checkout_test

import (
    "testing"
    "myapp/internal/checkout"
)

func TestCheckout_ConfirmsOrderWithValidCart(t *testing.T) {
    cart := checkout.NewCart()
    cart.Add(checkout.Product{ID: "p1", Name: "Widget", Price: 10})

    gateway := &fakeGateway{status: "approved"}

    result, err := checkout.Process(cart, gateway)

    if err != nil {
        t.Fatalf("unexpected error: %v", err)
    }
    if result.Status != "confirmed" {
        t.Errorf("got status %q, want %q", result.Status, "confirmed")
    }
    if result.OrderID == "" {
        t.Error("expected non-empty order ID")
    }
}

func TestCheckout_RejectsEmptyCart(t *testing.T) {
    cart := checkout.NewCart()
    gateway := &fakeGateway{status: "approved"}

    _, err := checkout.Process(cart, gateway)

    if err == nil {
        t.Fatal("expected error for empty cart")
    }
}
```

## Table-Driven Tests

The Go idiom for testing multiple cases:

```go
func TestDiscount(t *testing.T) {
    tests := []struct {
        name     string
        total    float64
        wantDisc float64
    }{
        {"no discount below threshold", 50, 0},
        {"10% above threshold", 100, 10},
        {"10% on large order", 500, 50},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            got := CalculateDiscount(tt.total)
            if got != tt.wantDisc {
                t.Errorf("CalculateDiscount(%v) = %v, want %v", tt.total, got, tt.wantDisc)
            }
        })
    }
}
```

## Mocking via Interfaces

Go's preferred approach — no mocking framework needed:

```go
// Production interface (defined where consumed)
type PaymentGateway interface {
    Charge(amount float64) (Receipt, error)
}

// Fake for tests
type fakeGateway struct {
    status string
    err    error
}

func (f *fakeGateway) Charge(amount float64) (Receipt, error) {
    if f.err != nil {
        return Receipt{}, f.err
    }
    return Receipt{Status: f.status, ID: "fake-receipt"}, nil
}
```

## Test Helpers

```go
// testutil.go (in a testutil package or _test.go file)
func assertEqual(t *testing.T, got, want interface{}) {
    t.Helper()
    if got != want {
        t.Errorf("got %v, want %v", got, want)
    }
}
```

Use `t.Helper()` so failure messages point to the caller, not the helper.

## Subtests and Cleanup

```go
func TestDatabase(t *testing.T) {
    db := setupTestDB(t)
    t.Cleanup(func() { db.Close() })

    t.Run("insert and retrieve", func(t *testing.T) {
        // ...
    })
}
```
