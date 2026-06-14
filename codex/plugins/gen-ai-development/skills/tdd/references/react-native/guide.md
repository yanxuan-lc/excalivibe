# React Native TDD Toolchain

Jest + React Native Testing Library (RNTL) for component and hook testing. Read the React guide first for the query-priority and "test what the user sees" philosophy — it carries over verbatim; this guide covers what differs on React Native (the runner, the native runtime, and the v14 async API). This is **development-time** unit/component testing in a Node/jsdom-free RN runtime — driving the real app on a device/simulator is the `e2e-test` skill (Detox).

## Stack

- **Test runner**: Jest with the `react-native` preset (RN ships it; not Vitest — RN's Metro/Babel transform and native-module mocks assume Jest).
- **Component testing**: `@testing-library/react-native` (RNTL) — `render`, `screen`, `userEvent`, queries.
- **Matchers**: RNTL's built-in Jest matchers (`toBeOnTheScreen`, `toHaveTextContent`, …) — auto-extended since RNTL v12.4; no separate `jest-native` import needed on current versions.

## Setup

```bash
npm install -D @testing-library/react-native jest @types/jest
```

`jest.config.js`:

```javascript
module.exports = {
  preset: "react-native",
  setupFilesAfterEnv: ["@testing-library/react-native/extend-expect"],
};
```

Add `"test": "jest"` and `"test:cov": "jest --coverage"` to `package.json` scripts. Prefer the project's existing script.

## v14 essentials (don't skip — they change how tests are written)

- **`render` is async** — always `await render(<Component />)`.
- **`userEvent` over `fireEvent`** — `const user = userEvent.setup()`, then `await user.press(...)` / `await user.type(...)`. It simulates realistic native events; `fireEvent` is the low-level fallback.
- **Fake timers recommended with userEvent**: call `jest.useFakeTimers()` so userEvent's internal delays resolve deterministically.

## Guiding Principle

**Test what the user sees and does, not component internals.** Render the component, interact like a user, assert on visible output. Same query priority as React (DOM): `getByRole` → `getByLabelText` (accessibility label) → `getByText` → `getByTestId` (last resort).

## Rendering, Querying, Interacting

```tsx
import { render, screen, userEvent } from "@testing-library/react-native";
import { LoginForm } from "@/components/login-form";

jest.useFakeTimers();

test("submits entered credentials", async () => {
  const user = userEvent.setup();
  const onSubmit = jest.fn();

  await render(<LoginForm onSubmit={onSubmit} />);

  // ✅ getByRole first; `name` matches the accessibility label
  await user.type(screen.getByRole("textbox", { name: "Email" }), "alice@example.com");
  await user.press(screen.getByRole("button", { name: "Login" }));

  expect(onSubmit).toHaveBeenCalledWith({ email: "alice@example.com" });
});
```

Set `accessibilityLabel` / `role` (or `aria-label`) on RN components so role/label queries work — the same affordances also make the app accessible and Detox-addressable.

## Async Operations

Use `findBy*` (waits internally) or `waitFor` — never a bare timeout:

```tsx
test("shows data after load", async () => {
  await render(<UserList />);
  expect(screen.getByText("Loading…")).toBeOnTheScreen();
  expect(await screen.findByText("Alice")).toBeOnTheScreen();
});
```

## Testing Hooks

```tsx
import { renderHook, act } from "@testing-library/react-native";
import { useCounter } from "@/hooks/use-counter";

test("increments", () => {
  const { result } = renderHook(() => useCounter());
  act(() => result.current.increment());
  expect(result.current.count).toBe(1);
});
```

## Mocking native modules

Native modules (navigation, async-storage, device APIs) have no JS implementation under Jest — mock them at the module boundary:

```tsx
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"));
```

Many libraries ship an official mock (as above) — prefer it over hand-rolled mocks. See `references/common/mocking.md` for what to mock vs. what to leave real.

## Coverage

```bash
jest --coverage        # honors the skill's >= 80% line-coverage gate
```

## What NOT to Test

- Internal state values (assert the visible outcome instead).
- Which function was called / render counts (implementation details).
- Third-party / native library behavior (trust the library + its official mock).
- Navigation library internals — test that *your* screen reacts, mock the navigator.
- Pixel layout via snapshots (brittle, low signal — visual regression belongs to e2e/golden, not unit tests).
