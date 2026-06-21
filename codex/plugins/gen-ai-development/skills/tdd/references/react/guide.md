# React TDD Toolchain

Vitest + React Testing Library for component and hook testing. Read the TypeScript guide first for Vitest basics — this guide covers React-specific patterns.

## Stack

- **Test runner**: Vitest (same as TypeScript)
- **Component testing**: `@testing-library/react`
- **User interaction**: `@testing-library/user-event`
- **DOM assertions**: `@testing-library/jest-dom`
- **DOM environment**: `jsdom`
- **Function / interface coverage**: inherits the TypeScript Vitest setup; interface coverage here = every exported component/hook rendered or invoked by at least one test (`% Funcs` is the proxy).

## Setup

```bash
npm install -D vitest @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom @vitejs/plugin-react
```

Add to vitest config:

```typescript
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    include: ["tests/**/*.test.{ts,tsx}"],
    environment: "jsdom",
    // ...
  },
});
```

## File Organization

```
src/                            tests/
├── components/                 ├── components/
│   ├── user-card.tsx           │   ├── user-card.test.tsx
│   └── ui/                     │   └── (no test — thin wrappers)
│       └── button.tsx          │
├── hooks/                      ├── hooks/
│   └── use-auth.ts             │   └── use-auth.test.ts
└── types/                      └── (no test — pure types)
```

## Guiding Principle

**Test what the user sees and does, not component internals.** Render the component, interact like a user would, assert on visible outcomes.

## Rendering and Querying

```tsx
import { render, screen } from "@testing-library/react";
import { UserCard } from "@/components/user-card";

test("displays user name", () => {
  render(<UserCard user={{ id: "1", name: "Alice" }} />);
  expect(screen.getByText("Alice")).toBeInTheDocument();
});
```

### Query Priority (most to least accessible)

1. **`getByRole`** — buttons, headings, links, textboxes
2. **`getByLabelText`** — form inputs
3. **`getByText`** — visible text content
4. **`getByTestId`** — last resort

```tsx
// Good: queries by accessibility role
screen.getByRole("button", { name: "Submit" });

// Avoid: queries by implementation detail
container.querySelector(".submit-btn");
```

## User Interactions

Use `@testing-library/user-event` (not `fireEvent`) — it simulates real browser behavior:

```tsx
import userEvent from "@testing-library/user-event";

test("calls onSelect when clicked", async () => {
  const user = userEvent.setup();
  const handleSelect = vi.fn();

  render(<UserCard user={{ id: "1", name: "Alice" }} onSelect={handleSelect} />);
  await user.click(screen.getByRole("button"));

  expect(handleSelect).toHaveBeenCalledWith("1");
});
```

## Async Operations

Use `findBy` queries (which wait) or `waitFor`:

```tsx
test("shows loading then data", async () => {
  render(<UserList />);
  expect(screen.getByText("Loading...")).toBeInTheDocument();
  expect(await screen.findByText("Alice")).toBeInTheDocument();
});
```

## Testing Hooks

```tsx
import { renderHook, act } from "@testing-library/react";
import { useCounter } from "@/hooks/use-counter";

test("increments counter", () => {
  const { result } = renderHook(() => useCounter());
  act(() => result.current.increment());
  expect(result.current.count).toBe(1);
});
```

## Context Providers

Wrap components that need context:

```tsx
function renderWithProviders(ui: React.ReactElement) {
  return render(ui, {
    wrapper: ({ children }) => (
      <ThemeProvider>{children}</ThemeProvider>
    ),
  });
}
```

## What NOT to Test

- Internal state values (test the visible outcome instead)
- Implementation details (which function was called, render count)
- Third-party library behavior (shadcn/ui works as documented)
- Snapshot tests for layout (brittle, low signal)
