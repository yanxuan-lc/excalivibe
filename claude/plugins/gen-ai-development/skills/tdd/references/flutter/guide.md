# Flutter / Dart TDD Toolchain

`flutter test` for Flutter projects (unit + widget tests); `dart test` for pure-Dart packages. Widget tests are this stack's unit-level workhorse — fast, headless, no device. Driving a real device/emulator (`integration_test` + `flutter drive`) is e2e territory: use the `e2e-test` skill for that, not this loop.

## Stack

- **Test runner**: `flutter test` (Flutter project) / `dart test` (pure-Dart package)
- **Run command**: `flutter test` (all), `flutter test test/services/cart_test.dart` (one file), `--plain-name "adds item"` (one test)
- **Coverage command**: `flutter test --coverage` → `coverage/lcov.info`; summarize with `lcov --summary coverage/lcov.info` or `genhtml`
- **Mocking**: [mocktail](https://pub.dev/packages/mocktail) (no codegen) as the default; `mockito` + `build_runner` only if the project already uses it

## Setup

```yaml
# pubspec.yaml
dev_dependencies:
  flutter_test:
    sdk: flutter
  mocktail: ^1.0.0
```

For a pure-Dart package, depend on `test: ^1.25.0` instead of `flutter_test`.

## File Organization

```
lib/
├── services/
│   └── cart_service.dart
└── widgets/
    └── cart_badge.dart

test/
├── services/
│   └── cart_service_test.dart
└── widgets/
    └── cart_badge_test.dart
```

- `_test.dart` suffix, under `test/`, mirroring `lib/` structure — the runner discovers by this convention.
- Widget tests live with the other tests; no separate directory needed.

## Unit Test Example

```dart
import 'package:test/test.dart'; // or package:flutter_test/flutter_test.dart

void main() {
  group('CartService', () {
    test('adds item and updates total', () {
      final cart = CartService();

      cart.add(Product(id: 'p1', name: 'Widget', priceCents: 1000));

      expect(cart.items, hasLength(1));
      expect(cart.totalCents, 1000);
    });

    test('rejects negative quantity', () {
      final cart = CartService();

      expect(
        () => cart.add(Product(id: 'p1', name: 'Widget', priceCents: 1000), quantity: -1),
        throwsA(isA<ArgumentError>()),
      );
    });
  });
}
```

## Widget Test Example

Widget tests pump a widget tree into a fake viewport and assert on what renders — this is the RED/GREEN unit for UI behavior.

```dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('shows item count badge when cart is not empty', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(home: CartBadge(itemCount: 3)),
    );

    expect(find.text('3'), findsOneWidget);
  });

  testWidgets('tapping the badge invokes onTap', (tester) async {
    var tapped = false;
    await tester.pumpWidget(
      MaterialApp(home: CartBadge(itemCount: 1, onTap: () => tapped = true)),
    );

    await tester.tap(find.byType(CartBadge));
    await tester.pump();

    expect(tapped, isTrue);
  });
}
```

- Always wrap in `MaterialApp` (or a test harness widget) so `Theme`/`Directionality` resolve.
- `pump()` advances one frame; `pumpAndSettle()` runs until animations finish — prefer `pump()` with explicit durations when an animation might never settle (e.g. a looping spinner).
- Find by semantics the user sees (`find.text`, `find.byIcon`, `find.bySemanticsLabel`) before reaching for `find.byKey`; keys are for disambiguation, not the default.

## Mocking with mocktail

```dart
import 'package:mocktail/mocktail.dart';

class MockPaymentGateway extends Mock implements PaymentGateway {}

void main() {
  test('checkout charges the gateway once', () async {
    final gateway = MockPaymentGateway();
    when(() => gateway.charge(any())).thenAnswer((_) async => Receipt(status: 'approved'));

    final result = await checkout(cart, gateway);

    expect(result.status, 'confirmed');
    verify(() => gateway.charge(1000)).called(1);
  });
}
```

- `registerFallbackValue(MyType())` once in `setUpAll` when matching `any()` against a non-primitive parameter type.
- Mock at boundaries you own (gateway/repository interfaces), not Flutter framework classes — see [../common/mocking.md](../common/mocking.md).

## Async Tests

```dart
test('loads user profile', () async {
  final repo = FakeUserRepo();

  final user = await loadProfile(repo, 'u_123');

  expect(user.name, 'Alice');
});
```

`fakeAsync` (from `package:fake_async`) or `tester.pump(const Duration(seconds: 2))` controls time for debounce/timeout logic — never `await Future.delayed` real wall-clock time in a test.

## Coverage

```bash
flutter test --coverage
lcov --summary coverage/lcov.info
```

Generated files (`*.g.dart`, `*.freezed.dart`) inflate the denominator — exclude them when judging the 80% gate:

```bash
lcov --remove coverage/lcov.info '**/*.g.dart' '**/*.freezed.dart' -o coverage/lcov.info
```
