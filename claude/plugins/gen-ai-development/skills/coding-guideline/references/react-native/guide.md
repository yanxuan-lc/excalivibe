# React Native Guide

React Native-specific conventions for components, styling, platform code, and native boundaries. Builds on the [React guide](../react/guide.md) — read it first (it builds on TypeScript). Everything there about function components, props interfaces, hook rules, `handle<Event>`/`on<Event>` naming, and TSDoc applies unchanged. This guide covers only what differs because the target is a native runtime, not the DOM.

## Table of Contents

- [Core Components, Not DOM](#core-components-not-dom)
- [Styling with StyleSheet](#styling-with-stylesheet)
- [Platform-Specific Code](#platform-specific-code)
- [Lists and Performance](#lists-and-performance)
- [Native Module Boundary](#native-module-boundary)
- [Navigation](#navigation)
- [Accessibility (and Testability)](#accessibility-and-testability)

---

## Core Components, Not DOM

There is no `div`/`span`/`button`/`img` — use RN's core components and never reach for web primitives:

| Web | React Native |
|-----|--------------|
| `div` | `View` |
| `span` / `p` | `Text` (all text MUST be inside a `<Text>`) |
| `button` / `a` | `Pressable` (prefer over the older `TouchableOpacity`) |
| `img` | `Image` (local `require(...)` or `{ uri }`) |
| scroll container | `ScrollView` (small, static) / `FlatList` (long, dynamic) |

- **Text must live in `<Text>`** — a bare string in a `View` throws at runtime.
- Prefer `Pressable` for all tappables; it exposes pressed/hovered/focused state via its `style`/`children` render-prop.

## Styling with StyleSheet

The React guide's Tailwind/CVA section does **not** apply on bare RN — there is no Tailwind unless the project adopts NativeWind. Default to `StyleSheet`:

```tsx
import { StyleSheet, View, Text } from "react-native";

function Badge({ label }: { label: string }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 10, paddingVertical: 2, borderRadius: 999, backgroundColor: "#dcfce7" },
  label: { fontSize: 12, fontWeight: "600", color: "#166534" },
});
```

- Define styles once with `StyleSheet.create` at module scope — **never build a fresh style object inside `render`** (defeats the equality fast-path and re-allocates per frame).
- Compose conditional styles with an array: `style={[styles.base, pressed && styles.pressed]}`.
- Layout is **Flexbox, defaulting to `flexDirection: "column"`** (unlike web's `row`) — don't assume web defaults. Dimensions are unitless density-independent pixels, not `px`/`rem`.
- If the project uses **NativeWind** (Tailwind for RN), then the React guide's `cn()`/CVA rules apply via `className` — follow the project's existing choice; don't introduce a second styling system.

## Platform-Specific Code

Keep platform branches small and explicit. Two idioms, smallest first:

```tsx
import { Platform } from "react-native";

// Inline branch for a value
const paddingTop = Platform.select({ ios: 20, android: 0, default: 0 });

// Whole-file split when divergence is structural — RN picks the right one automatically:
//   Button.ios.tsx   Button.android.tsx   (import as "./Button")
```

- Use `Platform.OS === "ios"` only for one-off conditions; reach for `.ios.tsx`/`.android.tsx` files once a component's two platforms diverge structurally.
- Gate version-specific APIs with `Platform.Version`.
- Always provide a `default` in `Platform.select` so web/未来平台 don't fall through to `undefined`.

## Lists and Performance

- **Long or data-driven lists use `FlatList`/`SectionList`, never `.map()` inside a `ScrollView`** — `ScrollView` renders every child eagerly; `FlatList` virtualizes.
- Provide a stable `keyExtractor` (a domain id, not the array index).
- Keep `renderItem` cheap and its row component `React.memo`'d; hoist it out of `render`.
- Reach for `getItemLayout` when row height is fixed — it skips async measurement.
- Don't put a `FlatList` inside a vertical `ScrollView` of the same axis (nested virtualization warning); restructure with list header/footer props instead.

## Native Module Boundary

Treat the JS↔native bridge as a system boundary (per the skill's "Validate at Boundaries" principle):

- Wrap third-party native modules (camera, storage, BLE, permissions) behind a typed module of your own — the rest of the app imports your wrapper, not the library, so a swap or a mock is one file.
- Native calls are **async and can reject** for device reasons (permission denied, hardware absent) — handle rejection at the call site, never assume success.
- Don't scatter `NativeModules.Foo` access across components; centralize it.

## Navigation

Standardize on **React Navigation** and type the param list:

```tsx
type RootStackParamList = {
  Home: undefined;
  Profile: { userId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// In a screen — typed route params, no `any`:
const { userId } = useRoute<RouteProp<RootStackParamList, "Profile">>().params;
```

- Declare one `ParamList` per navigator and thread its types through `navigation`/`route`.
- Keep navigation out of deep children — pass an `on<Event>` callback down and navigate at the screen level (mirrors the React event-prop rule and keeps screens testable).

## Accessibility (and Testability)

Set accessibility props on interactive elements — they double as the stable selectors RNTL (`getByRole`) and Detox (`by.id`/`by.label`) query, so this is also what makes the screen e2e-addressable:

```tsx
<Pressable
  role="button"               // or accessibilityRole="button"
  aria-label="Submit order"   // or accessibilityLabel="Submit order"
  testID="submit-order"       // stable Detox handle, survives copy changes
  onPress={handleSubmit}
>
  <Text>Submit</Text>
</Pressable>
```

- Prefer `role` + `aria-label` (RNTL/Detox query by these); add `testID` for the gray-box e2e handle.
- Don't tie tests to visible copy — copy changes; roles and `testID`s shouldn't.
- See the `tdd` skill's `react-native/guide.md` (unit) and the `e2e-test` skill's `react-native-detox.md` (e2e) for how these affordances are consumed.
