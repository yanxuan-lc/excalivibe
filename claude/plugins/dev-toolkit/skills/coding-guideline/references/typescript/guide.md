# TypeScript Guide

TypeScript-specific conventions. Assumes familiarity with the universal principles in SKILL.md.

## Strict Mode

`strict: true` in tsconfig — no exceptions. This enables `noImplicitAny`, `strictNullChecks`, and all related flags. Never weaken strictness per-file with `// @ts-ignore` or `// @ts-nocheck` — fix the type instead.

## Types vs Interfaces

- **`interface`** for object shapes that may be extended (props, API responses, domain entities).
- **`type`** for unions, intersections, mapped types, and anything that cannot be expressed as an interface.

```typescript
// Interface — extensible object shape
interface User {
  id: string;
  name: string;
}

// Type — union, cannot be an interface
type Result<T> = { ok: true; data: T } | { ok: false; error: Error };
```

## Avoiding `any`

Use `unknown` when the type is genuinely unknown, then narrow:

```typescript
function parseJson(raw: string): unknown {
  return JSON.parse(raw);
}

function getUser(raw: string): User {
  const data = parseJson(raw);
  if (isUser(data)) return data;
  throw new Error("Invalid user data");
}
```

`as const` for literal tuples and configuration objects:

```typescript
const ROLES = ["admin", "editor", "viewer"] as const;
type Role = (typeof ROLES)[number]; // "admin" | "editor" | "viewer"
```

## Imports

ES module syntax. Three groups separated by blank lines:

```typescript
// 1. Third-party packages
import { z } from "zod";

// 2. Path-aliased local imports
import { Button } from "@/components/ui/button";
import type { UserProfile } from "@/types";

// 3. Relative imports (same feature/module)
import { validateEmail } from "./utils";
```

- `@/*` path alias for cross-module imports.
- `import type { ... }` for type-only imports — this is tree-shaking friendly and makes intent clear.
- Prefer named exports. Default exports are acceptable only for pages/routes where the framework requires them.

## Error Handling

Domain errors extend `Error` with a descriptive `name` and support cause chaining:

```typescript
class ValidationError extends Error {
  override name = "ValidationError";
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
  }
}

// Usage — preserve the original error
throw new ValidationError("Invalid email", { cause: originalError });
```

## Module File Order

1. Type-only imports
2. Value imports (third-party → aliased local → relative)
3. Constants
4. Types / interfaces (if not in a separate types file)
5. Exported functions / classes
6. Private helpers (unexported)

## Doc-Comments (TSDoc)

Use `/** ... */` syntax. Document all exported functions, classes, types, and constants.

```typescript
/**
 * Fetch a user profile by ID.
 *
 * @param userId - The unique identifier of the user
 * @returns The resolved user profile
 * @throws {NotFoundError} When no user matches the given ID
 *
 * @example
 * ```ts
 * const user = await fetchUser("u_123");
 * console.log(user.name);
 * ```
 */
async function fetchUser(userId: string): Promise<User> {
  // ...
}

/**
 * Maximum number of retry attempts for transient failures.
 * Tuned to balance reliability against latency — 3 retries
 * with exponential backoff covers most network blips.
 */
const MAX_RETRIES = 3;

/** A validated, non-empty email address string. */
type Email = string & { readonly __brand: "Email" };
```

- `@param` only when the name is ambiguous — `userId: string` is self-explanatory, but `threshold: number` needs context.
- `@returns` when the return value is not obvious from the function name and return type.
- `@throws` for each error type the function may throw.
- `@example` with a fenced code block for non-trivial APIs.
- Skip doc-comments on private helpers and obvious one-liners.

## Miscellaneous

- `readonly` for properties that must not be reassigned.
- `async/await` over raw `Promise.then()` chains.
- Prefer `Map`/`Set` over plain objects when keys are dynamic or non-string.
- Use optional chaining (`?.`) and nullish coalescing (`??`) — avoid `||` for defaults when `0` or `""` are valid values.
