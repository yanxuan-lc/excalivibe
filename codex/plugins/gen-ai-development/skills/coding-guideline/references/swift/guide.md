# Swift Guide

Swift-specific conventions. Assumes familiarity with the universal principles in SKILL.md.

## Style Foundation

Follow the Swift API Design Guidelines. Use SwiftFormat to enforce formatting automatically.

## Naming

- **Types, Protocols, Enums**: `PascalCase` — `UserProfile`, `Decodable`
- **Functions, methods, properties, variables**: `camelCase` — `fetchUser`, `retryCount`
- **Enum cases**: `camelCase` — `case loading`, `case loaded(Data)`
- **Protocol names**: describe a capability, often ending in `-able`, `-ible`, or `-ing` — `Equatable`, `Codable`, `Loading`
- **Boolean properties**: read as assertions — `isEmpty`, `hasContent`, `canRetry`

### Argument Labels

- Use prepositions for clarity: `move(to:)`, `insert(at:)`, `remove(from:)`.
- Omit the first label when the function name already describes the argument's role: `contains(_ element:)`, `append(_ item:)`.
- Use `_` to suppress labels only when the meaning is unambiguous from context.

## Optionals

- **Prefer `guard let` for early exit** — it keeps the happy path unindented:

```swift
func process(user: User?) throws -> Profile {
    guard let user else {
        throw AppError.missingUser
    }
    // user is non-optional from here
    return Profile(name: user.name)
}
```

- **`if let`** for branches where both paths do meaningful work.
- **Never force-unwrap (`!`)** unless the invariant is provably guaranteed (e.g., `URL(string: "https://example.com")!` — a compile-time-known literal). Add a comment when you do.
- **Nil-coalescing (`??`)** for defaults: `let name = user.nickname ?? user.username`.
- **Optional chaining (`?.`)** to safely traverse nested optionals.

## Error Handling

Define error types as enums conforming to `Error`:

```swift
enum AppError: Error, LocalizedError {
    case notFound(id: String)
    case validation(field: String, message: String)
    case networkFailure(underlying: Error)

    var errorDescription: String? {
        switch self {
        case .notFound(let id):
            return "Resource \(id) not found"
        case .validation(let field, let message):
            return "\(field): \(message)"
        case .networkFailure(let error):
            return "Network error: \(error.localizedDescription)"
        }
    }
}
```

- Use `throws` for synchronous errors, `async throws` for async.
- `do-catch` at the handling site — catch specific error cases, not generic `Error`.
- Use `Result<T, E>` when you need to store or pass errors as values (e.g., completion handlers in legacy APIs).

## Protocols and Extensions

- **Protocol-oriented design**: define behavior through protocols, provide defaults via extensions.
- **Constrained extensions** over inheritance for shared behavior:

```swift
extension Collection where Element: Identifiable {
    func element(withID id: Element.ID) -> Element? {
        first { $0.id == id }
    }
}
```

- One protocol per concept. Prefer small, composable protocols over large monolithic ones.

## Concurrency (Swift Concurrency)

- Use `async/await` and structured concurrency (`TaskGroup`, `async let`) over GCD or completion handlers.
- Mark actors with `actor` for mutable shared state — do not use manual locks.
- Use `@Sendable` closures and `Sendable` types to ensure data-race safety.

## Project Structure

```
Sources/
├── App/
│   ├── AppDelegate.swift (or @main App struct)
│   └── Configuration.swift
├── Models/
│   └── User.swift
├── Services/
│   └── AuthService.swift
├── Views/
│   ├── Components/
│   └── Screens/
└── Utilities/
    └── Extensions/

Tests/
├── ModelTests/
└── ServiceTests/
```

- Feature-based grouping within `Views/` — `Screens/` for full screens, `Components/` for reusable pieces.
- Keep `AppDelegate` or `@main` thin — delegate to services.

## Doc-Comments (DocC / Quick Help)

Use `///` for single-line or multi-line doc-comments. Xcode Quick Help and DocC render them as structured documentation.

```swift
/// Fetch a user profile by ID.
///
/// Queries the user service and returns the full profile.
///
/// - Parameter userId: The unique identifier of the user.
/// - Returns: The resolved user profile.
/// - Throws: `AppError.notFound` when no user matches the given ID.
///
/// ## Example
///
/// ```swift
/// let user = try await fetchUser(userId: "u_123")
/// print(user.name)
/// ```
func fetchUser(userId: String) async throws -> User {
    // ...
}

/// A service for managing user authentication and token lifecycle.
///
/// `AuthService` handles JWT token creation, validation, and refresh.
/// It is the single source of truth for authentication state.
///
/// ## Topics
///
/// ### Creating Tokens
/// - ``createToken(for:)``
///
/// ### Validating Tokens
/// - ``validate(_:)``
class AuthService {
    /// Token time-to-live in seconds. Defaults to 1 hour.
    let tokenTTL: Int

    /// Create a new auth service.
    ///
    /// - Parameter tokenTTL: Token time-to-live in seconds.
    init(tokenTTL: Int = 3600) {
        self.tokenTTL = tokenTTL
    }
}

/// Maximum number of retry attempts for transient failures.
let maxRetries = 3
```

- First line: imperative summary — "Fetch a user profile" not "Fetches a user profile" or "This method fetches...".
- `- Parameter name:` for each non-obvious parameter. Use `- Parameters:` (plural) with indented list for 3+ params.
- `- Returns:` and `- Throws:` when applicable.
- `## Topics` sections for organizing related members in DocC.
- Document all `public` and `open` declarations. `internal` only when non-obvious.
- Properties with clear names (`let name: String`) don't need doc-comments.

## Conventions

- **`let` over `var`** — default to immutable. Use `var` only when mutation is required.
- **Value types (`struct`, `enum`)** over reference types (`class`) unless identity semantics are needed (e.g., `ObservableObject`).
- **Access control**: start `private`, widen only when needed. Use `internal` (the default) for module-internal API, `public` for framework boundaries.
- **Computed properties** over zero-argument methods when the operation is O(1) and has no side effects.
- **Trailing closure syntax** for the last closure argument. Use labeled arguments if there are multiple closures.
- **`@MainActor`** for UI-bound types and methods — do not dispatch to main queue manually.
