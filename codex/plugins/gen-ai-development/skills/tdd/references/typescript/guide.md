# TypeScript TDD Toolchain

Vitest as the default test runner for TypeScript projects.

## Stack

- **Test runner**: [Vitest](https://vitest.dev)
- **Run command**: `npm test` (or `npx vitest run`)
- **Coverage command**: `npx vitest run --coverage`
- **Function / interface coverage**: the text reporter prints a `% Funcs` column as a proxy (it counts private functions too); the 100% interface gate is the *exported* surface — confirm each exported symbol has at least one test.
- **Watch mode**: `npx vitest` (default)

## Project Setup

```bash
npm install -D vitest @vitest/coverage-v8
```

**vitest.config.ts** (or `test` field in `vite.config.ts`):

```typescript
import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    coverage: {
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.d.ts", "src/types/**"],
      reporter: ["text", "lcov"],
      thresholds: { lines: 90 }, // hard line gate; interface coverage is judged on the exported surface (see skill)
    },
  },
});
```

## File Organization

Mirror source structure under `tests/`:

```
src/                        tests/
├── lib/                    ├── lib/
│   ├── utils.ts            │   ├── utils.test.ts
│   └── api.ts              │   └── api.test.ts
├── services/               ├── services/
│   └── auth.ts             │   └── auth.test.ts
└── types/                  └── (no test — pure types)
    └── index.ts
```

- `.test.ts` suffix for test files.
- `describe("moduleName", ...)` to group related tests.
- `test()` or `it()` for individual cases.

## Test Example

```typescript
import { describe, test, expect } from "vitest";
import { checkout } from "@/services/checkout";
import { createCart } from "@/models/cart";

describe("checkout", () => {
  test("confirms order with valid cart", () => {
    const cart = createCart();
    cart.add({ id: "p1", name: "Widget", price: 10 });

    const fakeGateway = {
      charge: () => ({ status: "approved", id: "receipt-1" }),
    };

    const result = checkout(cart, fakeGateway);
    expect(result.status).toBe("confirmed");
    expect(result.orderId).toBeDefined();
  });

  test("rejects empty cart", () => {
    const cart = createCart();
    const fakeGateway = { charge: () => ({ status: "approved", id: "r1" }) };

    expect(() => checkout(cart, fakeGateway)).toThrow("Cart is empty");
  });
});
```

## Mocking Tools

### `vi.fn()` — standalone mock function

```typescript
const handler = vi.fn();
handler("hello");
expect(handler).toHaveBeenCalledWith("hello");
```

### `vi.spyOn()` — spy on existing method

```typescript
const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
doSomething();
expect(spy).toHaveBeenCalled();
spy.mockRestore();
```

### `vi.mock()` — module-level mock (for system boundaries)

```typescript
import { sendEmail } from "../src/clients/email.js";

vi.mock("../src/clients/email.js", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

test("signup sends welcome email", async () => {
  await signup({ email: "alice@example.com" });
  expect(sendEmail).toHaveBeenCalledOnce();
});
```

### `vi.useFakeTimers()` — time control

```typescript
test("token expires after TTL", () => {
  vi.useFakeTimers();
  const token = createToken({ ttl: 3600_000 });
  vi.advanceTimersByTime(3600_001);
  expect(token.isExpired()).toBe(true);
  vi.useRealTimers();
});
```

### `vi.stubEnv()` — environment variables

```typescript
test("reads API key from env", () => {
  vi.stubEnv("API_KEY", "test-key-123");
  const config = loadConfig();
  expect(config.apiKey).toBe("test-key-123");
  vi.unstubAllEnvs();
});
```
