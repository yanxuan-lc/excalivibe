# Flutter Guide

Flutter-specific conventions for widgets, state, and build behavior. Builds on the Dart guide — read [`../dart/guide.md`](../dart/guide.md) first for general Dart rules.

## Table of Contents

- [Widget Declaration](#widget-declaration)
- [Build Method Discipline](#build-method-discipline)
- [State Management](#state-management)
- [Lifecycle and Resource Cleanup](#lifecycle-and-resource-cleanup)
- [Performance Patterns](#performance-patterns)
- [Theming and Design Tokens](#theming-and-design-tokens)
- [Async UI](#async-ui)
- [Navigation](#navigation)

---

## Widget Declaration

Use `StatelessWidget` unless the widget genuinely owns mutable state.

```dart
class UserCard extends StatelessWidget {
  const UserCard({super.key, required this.user, this.onTap});

  final User user;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Text(user.name),
    );
  }
}
```

- **`const` constructor** whenever fields permit. `const` widgets are canonicalized — Flutter skips rebuilds for identical instances.
- **`super.key`** in the constructor; never reinvent the key parameter.
- **Fields are `final`**. State changes go through the parent (callbacks) or a State object, not by mutating widget fields.
- **Suffix prop callbacks with `on`**: `onTap`, `onChanged`, `onSubmit`. Internal handlers are `handleTap`, `handleChanged`.
- Avoid extending `StatefulWidget` for stateless rendering. If the only state is "did the user tap" pass it up via callback.

## Build Method Discipline

`build` runs every rebuild — keep it cheap and pure.

- **No I/O** in `build` — no network, no file reads, no `Future.delayed`. Push them into `initState` / event handlers / providers.
- **No allocation that survives `build`** — `Timer`, `StreamSubscription`, `AnimationController` all belong in `State` fields.
- **Prefer extracting reusable sub-trees as widget classes** rather than helper methods that return `Widget`. Class widgets enable `const` canonicalization and show up clearly in DevTools' rebuild profiler.
- **Exception**: small one-shot helpers that aren't reused can stay as methods, especially when they keep the parent's `build` readable without buying anything from being a widget.
- **Don't read `MediaQuery` / `Theme` outside `build`**; they're context-dependent and the value can change between rebuilds.

## State Management

Pick one state-management approach per app and stay consistent. Common idioms:

| Scope | Tool |
|---|---|
| Local widget state (form input, animation) | `StatefulWidget` + `setState` |
| Shared cross-widget state | `ChangeNotifier` + `Provider` / `Riverpod` |
| Reactive streams of events | `StreamBuilder` / Riverpod `StreamProvider` |
| Asynchronous one-shot fetch | `FutureBuilder` / Riverpod `FutureProvider` |

Riverpod-style fine-grained selectors:

```dart
// Reads only the slice that changed; the consumer rebuilds only when `count` differs.
final count = ref.watch(cartProvider.select((c) => c.itemCount));
```

- **Avoid `setState` in hot paths**. Each call rebuilds the widget. Throttle / batch when a stream of updates lands faster than the frame budget.
- **Don't `notifyListeners()` in a loop**. Coalesce updates; emit once per logical change.
- **Don't watch the whole store** when you only render one field. Use `select` (Riverpod / Provider) to scope rebuilds.

## Lifecycle and Resource Cleanup

Anything you start in `initState`, you stop in `dispose`. Pair them in adjacent code so it's hard to miss.

```dart
class _ChatScreenState extends State<ChatScreen> {
  late final StreamSubscription<Event> _sub;
  final TextEditingController _ctrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _sub = widget.events.listen(_onEvent);
  }

  @override
  void dispose() {
    _sub.cancel();
    _ctrl.dispose();
    super.dispose();
  }
}
```

- `super.initState()` first, `super.dispose()` last.
- Cancel `StreamSubscription`, dispose `TextEditingController` / `FocusNode` / `AnimationController` / `ScrollController` — every "Controller" has a `dispose`.
- Guard async callbacks: check `if (!mounted) return;` before calling `setState` after an `await`.

## Performance Patterns

- **`const` everywhere it compiles**. The analyzer's `prefer_const_constructors` lint catches this.
- **`ListView.builder`** for any list that might exceed the viewport. Provide `itemExtent` when items are uniform height — it lets the framework skip layout.
- **`RepaintBoundary`** around heavy or animated subtrees that don't share repaint regions with their neighbors.
- **`AutomaticKeepAliveClientMixin`** when a `PageView` / tab content should not rebuild from scratch on focus loss — but only when rebuild cost is real.
- **Keys** for items in a reorderable list — `ValueKey(item.id)`, not `UniqueKey()` (which forces full rebuild every frame).
- **Image** widgets: provide `cacheWidth` / `cacheHeight` for grid thumbnails so the decoder doesn't allocate full-resolution bitmaps.

## Theming and Design Tokens

Centralize colors / typography / spacing — never inline raw values.

```dart
// Bad: magic hex
Container(color: Color(0xFF6F5AFB));

// Good: theme-driven, dark-mode-safe
Container(color: Theme.of(context).colorScheme.primary);

// Good: brand-fixed token (does not flip with theme)
Container(color: AppColors.brandPrimary);
```

- One source of truth: `ThemeData` for colors that flip with mode, a separate token class (`AppColors`) for brand-fixed values.
- Define text styles as semantic tokens (`titleLarge`, `bodyMedium`) on `TextTheme`; reach for them in widgets via `Theme.of(context).textTheme.titleLarge`.
- For multi-resolution layouts, define a scale extension tied to a design baseline (e.g. 375×812) and run all numeric pixel values through it. Many projects adopt `flutter_screenutil`'s `.w` / `.h` / `.sp` / `.r` extensions on `num`, or write their own. Hardcoded numbers stop scaling on small / tablet screens.

## Async UI

Streaming UI:

```dart
StreamBuilder<List<Message>>(
  stream: chat.messages,
  initialData: const [],
  builder: (context, snapshot) {
    if (snapshot.hasError) return ErrorView(error: snapshot.error!);
    final items = snapshot.data ?? const [];
    return MessageList(items: items);
  },
);
```

- Always handle the three states `hasError` / `hasData` / loading. Empty fallbacks are not free — show the empty state explicitly.
- Prefer state-management libraries (Riverpod / Bloc) over `FutureBuilder` for anything that needs caching, retry, or shared subscription. `FutureBuilder` recreates the future on every rebuild if you're not careful.
- Mark async UI cancellable: keep the `Future` / `Stream` on a field so you can cancel on `dispose`, and check `mounted` after each `await` before touching `BuildContext`.

## Navigation

- Use a single navigation strategy per app (Navigator 2.0 / `go_router` / `auto_route`). Mixing styles makes deep-linking break in confusing ways.
- Routes are typed: a screen receives a typed args object, not a `Map<String, dynamic>`.
- **Don't pass `BuildContext` across async gaps** — applies to **any** `*.of(context)` lookup (`Navigator`, `ScaffoldMessenger`, `Theme`, `MediaQuery`) plus the navigator itself. Capture before `await` (`final nav = Navigator.of(context);`, `final messenger = ScaffoldMessenger.of(context);`), then use the captured handle after the await. Always check `if (!mounted) return;` before touching `setState` post-await.
- Back navigation: prefer `pop` with a typed result (`Navigator.pop(context, value)`) over a callback prop.
