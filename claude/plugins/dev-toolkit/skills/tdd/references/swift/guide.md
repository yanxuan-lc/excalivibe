# Swift TDD Toolchain

Swift Testing (Swift 6+) as the primary framework, with XCTest as fallback for older projects.

## Stack

- **Test runner**: `swift test` (Swift Package Manager) or Xcode Test Navigator
- **Run command**: `swift test`
- **Coverage command**: `swift test --enable-code-coverage` then `llvm-cov report`
- **Function / interface coverage**: `llvm-cov report` shows per-file function coverage / `Missed Functions` (proxy — includes internal funcs); the 100% interface gate is that every `public`/`open` symbol is exercised by a test.
- **Mocking**: Protocol-based fakes (no framework required)

## Verification Discipline

Swift-specific facts (the generic rules live in SKILL.md) — builds are as expensive
as Rust's:

- **`swift test` already builds** — never chain `swift build` → `swift test` over
  the same tree in one iteration.
- **Scope at the RUN level.** `swift test --filter CheckoutTests` (one suite) or
  `--filter CheckoutTests/confirmsOrder` (one test); in Xcode projects,
  `xcodebuild test -only-testing:MyAppTests/CheckoutTests`. The build stays
  canonical; the filter narrows only the run.
- **Toggling coverage forces rebuilds.** `--enable-code-coverage` changes build
  flags and invalidates the build cache, so alternating plain and coverage runs
  double-compiles. Run coverage once, at the Coverage Gate.
- **Gate pass composition**: full `swift test` + lint (SwiftLint where configured).

## Setup (Swift Package Manager)

Tests go in the `Tests/` directory, declared in `Package.swift`:

```swift
// Package.swift
let package = Package(
    name: "MyApp",
    targets: [
        .target(name: "MyApp", path: "Sources"),
        .testTarget(name: "MyAppTests", dependencies: ["MyApp"], path: "Tests"),
    ]
)
```

## File Organization

```
Sources/
├── Models/
│   └── User.swift
├── Services/
│   └── AuthService.swift
└── Checkout.swift

Tests/
├── Models/
│   └── UserTests.swift
├── Services/
│   └── AuthServiceTests.swift
└── CheckoutTests.swift
```

- `Tests` suffix for test files: `CheckoutTests.swift`.
- Mirror source structure.

## Test Example (Swift Testing)

```swift
import Testing
@testable import MyApp

@Suite("Checkout")
struct CheckoutTests {
    @Test("confirms order with valid cart")
    func confirmsOrder() throws {
        var cart = Cart()
        cart.add(Product(id: "p1", name: "Widget", price: 10))
        let gateway = FakeGateway(status: "approved")

        let result = try checkout(cart: cart, gateway: gateway)

        #expect(result.status == "confirmed")
        #expect(!result.orderID.isEmpty)
    }

    @Test("rejects empty cart")
    func rejectsEmptyCart() {
        let cart = Cart()
        let gateway = FakeGateway(status: "approved")

        #expect(throws: CheckoutError.emptyCart) {
            try checkout(cart: cart, gateway: gateway)
        }
    }
}
```

## Test Example (XCTest — older projects)

```swift
import XCTest
@testable import MyApp

final class CheckoutXCTests: XCTestCase {
    func testConfirmsOrderWithValidCart() throws {
        var cart = Cart()
        cart.add(Product(id: "p1", name: "Widget", price: 10))
        let gateway = FakeGateway(status: "approved")

        let result = try checkout(cart: cart, gateway: gateway)

        XCTAssertEqual(result.status, "confirmed")
        XCTAssertFalse(result.orderID.isEmpty)
    }

    func testRejectsEmptyCart() {
        let cart = Cart()
        let gateway = FakeGateway(status: "approved")

        XCTAssertThrowsError(try checkout(cart: cart, gateway: gateway)) { error in
            XCTAssertEqual(error as? CheckoutError, .emptyCart)
        }
    }
}
```

## Mocking via Protocols

Define a protocol at the boundary, implement a fake:

```swift
protocol PaymentGateway {
    func charge(amount: Decimal) throws -> Receipt
}

// Production
struct StripeGateway: PaymentGateway {
    func charge(amount: Decimal) throws -> Receipt { /* ... */ }
}

// Test fake
struct FakeGateway: PaymentGateway {
    let status: String
    var shouldFail = false

    func charge(amount: Decimal) throws -> Receipt {
        if shouldFail { throw PaymentError.declined }
        return Receipt(status: status, id: "fake-1")
    }
}
```

### Spy pattern (recording calls)

```swift
class SpyEmailClient: EmailClient {
    private(set) var sentEmails: [(to: String, subject: String)] = []

    func send(to: String, subject: String, body: String) {
        sentEmails.append((to: to, subject: subject))
    }
}

@Test("signup sends welcome email")
func signupSendsEmail() throws {
    let spy = SpyEmailClient()
    try signup(email: "alice@example.com", emailClient: spy)

    #expect(spy.sentEmails.count == 1)
    #expect(spy.sentEmails[0].subject == "Welcome")
}
```

## Async Tests

```swift
// Swift Testing
@Test("fetches user profile")
func fetchUser() async throws {
    let user = try await fetchUser(id: "u_123")
    #expect(user.name == "Alice")
}

// XCTest
func testFetchUser() async throws {
    let user = try await fetchUser(id: "u_123")
    XCTAssertEqual(user.name, "Alice")
}
```

## Parameterized Tests (Swift Testing)

```swift
@Test("discount calculation", arguments: [
    (total: 50.0, expected: 0.0),
    (total: 100.0, expected: 10.0),
    (total: 500.0, expected: 50.0),
])
func discount(total: Double, expected: Double) {
    #expect(calculateDiscount(total) == expected)
}
```
