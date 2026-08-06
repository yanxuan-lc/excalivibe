# Dart Guide

Dart-specific conventions. Assumes familiarity with the universal principles in SKILL.md. For Flutter widget / state / build conventions, read [`../flutter/guide.md`](../flutter/guide.md) on top of this file.

## Formatting

`dart format` is non-negotiable — every file passes the formatter, no debate. Page width defaults to 80; if a project widens it (Dart 3.7+ `analysis_options.yaml` `formatter: page_width:` or `dart format --line-length`), follow the project. Don't argue the value with the formatter, configure it once. Trailing commas after the last argument trigger multi-line formatting and produce nicer diffs — keep them on widget trees and any long argument list.

## Naming

- **Files**: `lower_snake_case.dart`. The file name should match the primary public type or the topic.
- **Types** (classes, enums, typedefs, mixins, extensions): `UpperCamelCase`.
- **Members** (variables, fields, parameters, functions, methods): `lowerCamelCase`. Acronyms become words: `httpClient`, `userId`.
- **Constants**: `lowerCamelCase`, not `SCREAMING_SNAKE`. `const maxRetries = 3;`
- **Private**: prefix with `_`. There is no `private` keyword — the underscore is library-private.
- **Boolean getters**: read like predicates — `isEmpty`, `hasError`, `canRetry` — not `getEmpty` / `checkError`.
- **No `get` prefix**: `user.name`, not `user.getName()`. Properties and getters look identical at the call site.

## Null Safety

Sound null safety is on. Embrace it; do not work around it.

```dart
String? maybeName;          // explicitly nullable
String name = 'unknown';     // non-nullable, must be initialized
```

- Prefer non-nullable types. Reach for `?` only when null carries meaning.
- Avoid the bang operator `!`. Each `!` is a runtime contract you have to maintain by hand. Use `if (x != null)`, `?.`, `??`, or pattern matching instead.
- `late` only for: (a) circular initialization that can't be expressed otherwise, (b) DI fields set in `initState`. Every `late` is a runtime promise — if it fails, you get `LateInitializationError` in production.
- `??` for null-coalescing, `??=` for null-aware assignment, `?.` for null-aware member access.
- **`Object?` over `dynamic`** at API boundaries. `Object?` is checked — you must narrow before use; `dynamic` opts out of static checking entirely and re-introduces the kind of bugs null safety was supposed to remove.

## Immutability

Default to immutable.

- `final` for fields and locals that don't reassign. Make this the default; let mutability be the exception.
- `const` for compile-time constants and constructors that produce them. `const` constructors enable widget reuse and tree canonicalization in Flutter.
- Mutable collections: prefer `List.unmodifiable(...)` / `Map.unmodifiable(...)` when handing data across boundaries.
- For value objects, write `copyWith` instead of mutating; use a sentinel (e.g., `Object _unset = Object()`) to distinguish "leave unchanged" from "set to null" when the field is nullable.

## Constructors

Dart constructors are expressive — pick the right form:

```dart
class HttpClient {
  // Const constructor — usable in const contexts, enables canonicalization.
  const HttpClient({required this.baseUrl, this.timeout = Duration(seconds: 30)});

  final Uri baseUrl;
  final Duration timeout;

  // Named constructor — alternative initialization.
  HttpClient.localhost() : this(baseUrl: Uri.parse('http://127.0.0.1'));

  // Factory — return cached / subtype / nullable instance.
  factory HttpClient.fromConfig(Config c) => _cache[c.id] ??= HttpClient(baseUrl: c.uri);
}
```

- Named parameters with `required` for anything more than 2-3 args. Positional optional params (`[T? x]`) are rarely the right tool.
- One default constructor; everything else is named (`HttpClient.localhost()`, `Foo.fromJson(...)`).
- `factory` when the constructor may return a cached instance, a subtype, or fail (in conjunction with throwing) — but prefer plain async functions for I/O construction.

## Async — Future and Stream

```dart
Future<User> fetchUser(String id) async {
  final response = await _client.get(_userUri(id));
  if (response.statusCode != 200) {
    throw HttpException('fetch user $id failed: ${response.statusCode}');
  }
  return User.fromJson(jsonDecode(response.body));
}
```

- `async`/`await` over raw `.then()` — sequential code reads top-to-bottom.
- One-shot async result: `Future<T>`. Push streams of values: `Stream<T>`.
- `async*` + `yield` for generator-style streams; cancel-safe by default (subscriber's `cancel` propagates as a `StreamSubscription` close).
- Always close resources you open: `StreamSubscription`, `StreamController`, `IOSink`. Hold the handle in a field, cancel in `dispose`.
- Concurrent fan-out: `Future.wait([...])`. Use `eagerError: true` when one failure should cancel the rest.
- Use `unawaited(future)` (from `dart:async`) when you intentionally fire-and-forget — it makes intent clear and silences the analyzer.

## Imports

Three groups separated by blank lines:

```dart
// 1. Dart SDK
import 'dart:async';
import 'dart:convert';

// 2. Third-party packages
import 'package:http/http.dart' as http;
import 'package:flutter/material.dart';

// 3. This package — relative paths within `lib/`
import '../models/user.dart';
import 'app_http_exception.dart';
```

- Sort alphabetically within each group; the formatter tooling (`dart fix`, `import_sorter`) handles it.
- Use `package:` for cross-package imports always; relative imports only **within the same package** under `lib/`.
- Hide / show only when necessary to disambiguate (`import 'foo.dart' show Bar;`); don't pre-emptively narrow.
- Prefix imports (`as http`) when symbols would collide.

## Error Handling

Throw exceptions for exceptional conditions; return `Result`-like sealed classes for expected failure paths if the call site needs to branch.

```dart
class AppHttpException implements Exception {
  AppHttpException(this.message, {this.statusCode, this.uri, this.rawBody});

  final String message;
  final int? statusCode;
  final Uri? uri;
  final String? rawBody;

  @override
  String toString() => 'AppHttpException(${statusCode ?? '-'}): $message';
}
```

- Implement `Exception` (not `Error`). `Error` is reserved for programmer mistakes that should crash.
- `try/on` to filter by type, `try/catch` to capture stack: `catch (error, stackTrace)`.
- Rethrow with context using a wrapping exception, or `rethrow` to preserve the original stack.
- Don't catch `Object` / `dynamic` unless you're at a top-level boundary (e.g., a request handler) and you're going to log + report.

## Doc-Comments

Use `///` for public API; rendered by `dart doc` and IDEs.

```dart
/// Fetches a user profile by [id].
///
/// Returns the deserialized [User]. Throws [AppHttpException] on non-2xx
/// responses or when the body fails to deserialize.
Future<User> fetchUser(String id) async { ... }

/// Maximum number of retry attempts for transient failures.
///
/// Tuned to balance reliability against latency — 3 retries with
/// exponential backoff covers most network blips.
const maxRetries = 3;
```

- First line is a complete sentence in the imperative mood.
- Reference identifiers with `[brackets]` so IDE / `dart doc` link them.
- Document every public (non-`_`) declaration. Skip obvious one-liners and private helpers.
- Don't repeat the type — the signature already shows it; explain the *why*.

## Conventions

- **Pattern matching** (Dart 3+): use `switch` expressions and destructuring patterns over chained `if`-`is` casts.
  ```dart
  final greeting = switch (user) {
    Admin(:final name) => 'Welcome, admin $name',
    Guest() => 'Welcome, guest',
    _ => 'Welcome',
  };
  ```
- **Records** for ad-hoc multi-value returns: `(int, String)` instead of a one-off class. Promote to a class once the shape gains methods.
- **Sealed / final classes** to model closed hierarchies (e.g., a `Result<T>` with `Ok` / `Err`). The compiler enforces exhaustive matches.
- **`enum`** with members and methods for closed sets — preferred over `static const String` constants.
- **Equality**: override `==` and `hashCode` together for value types, or use `package:equatable` / generated equality. The default `Object` equality is identity-based.
- **Collections**: prefer the iterable methods (`.map`, `.where`, `.fold`) over manual `for` when the result is a transformation; switch back to `for` when side effects or early exit clarify intent.
- **Cascade operator** `..` to chain configuration on a freshly constructed object (`request..headers.addAll(h)..body = body`).
- **Tests**: `package:test` (`group` / `test` / `expect`); table-driven tests are idiomatic when cases differ only by data.
