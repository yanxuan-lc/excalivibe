# JavaScript Guide

JavaScript-specific conventions for plain `.js` / `.mjs` projects (no TypeScript). Builds on the [TypeScript guide](../typescript/guide.md) — read it first. The cross-cutting rules (imports grouping, error subclasses with `name`/`cause`, async/await over callbacks, `?.`/`??`, `Map`/`Set`, `Promise.all` patterns, no `any`-equivalent shortcuts) all transfer; this file lists what differs in plain JS.

Targets modern Node (≥ 22) and modern browsers. Pre-ESM CommonJS-only conventions are out of scope.

## Modules — ESM Only

ES modules (`import` / `export`). CommonJS (`require` / `module.exports`) is acceptable only when consuming a third-party module that ships CJS.

```js
// good — named exports, single responsibility per file
export function buildUserPayload(user) { ... }
export const MAX_RETRIES = 3;
```

- **File extension**: `.mjs` if `package.json` doesn't set `"type": "module"`; `.js` if it does. Pick one and don't mix.
- **Always include the file extension in relative imports** (`./foo.mjs`, not `./foo`) — Node's ESM loader requires it.
- **Node built-ins use the `node:` prefix**: `import { readFile } from "node:fs/promises";`. Prepend a Node built-ins group **before** the third-party group from the TypeScript guide. Plain-JS Node projects rarely use path aliases, so the typical layout collapses to three groups:
  ```js
  import { readFile } from "node:fs/promises";   // 1. Node built-ins

  import { z } from "zod";                        // 2. Third-party

  import { buildUserPayload } from "./user.mjs";  // 3. Relative
  ```
  If your project does use path aliases (TS-style `@/*`), add an aliased group between third-party and relative.
- Prefer named exports; default exports only when a framework requires them.

## Naming

- **Files**: `kebab-case.mjs` is the dominant Node convention (matches npm package names, Node core, most popular libraries). `lower_snake_case.mjs` is acceptable in projects that already use it — match the project's existing style. Don't introduce a third style.
- **Constants**: `SCREAMING_SNAKE_CASE` for module-level **primitive** constants (`MAX_RETRIES`, `BASE_URL`). Use `camelCase` for everything else, including configuration objects (`const defaultOptions = { ... };`).
- **Private members**: prefix with `_` for module-private convention, or use real `#private` fields **inside classes** for hard enforcement.

Other casing follows the [common naming reference](../common/naming.md).

## Variables

`const` by default, `let` when the binding genuinely reassigns. **`var` is never the answer** — its function-scoping and hoisting are footguns that ESM has eliminated for everyone else.

- Mutating the contents of a `const` array / object is fine — `const` only freezes the binding.
- For "really immutable", use `Object.freeze(...)` at the boundary or hand out copies.
- Defensive defaults at destructuring read better than `||`: `const { timeout = 30_000 } = options;` correctly handles `0` / `""`, while `options.timeout || 30_000` does not.

## Async — Plain JS Specifics

The async patterns from TypeScript apply. Two JS-specific points:

- **Top-level `await`** is supported in any ESM module. Use it directly; don't wrap top-level code in a `(async () => { ... })()` IIFE.
- **Mark fire-and-forget intent explicitly**: `void doBackgroundWork();`. Without TS to flag floating promises, `void` is the convention that tells reviewers you chose to drop the result.

## Type Discipline Without a Type Checker

Plain JS gives no static checking — make it up with disciplined boundaries:

- **JSDoc on public functions** so editors and `tsc --noEmit --allowJs --checkJs` (when used) catch shape mismatches:

  ```js
  /**
   * Fetch a user profile by ID.
   * @param {string} userId
   * @returns {Promise<User>}
   * @throws {NotFoundError} when no user matches the given ID
   */
  export async function fetchUser(userId) { ... }

  /**
   * @typedef {Object} User
   * @property {string} id
   * @property {string} name
   * @property {string} [email]
   */
  ```

- **Use `@typedef` for shared object shapes** — equivalent to TypeScript interfaces; IDEs honor them.
- **Validate at every external boundary** (HTTP body, CLI arg, file content) with a schema validator (Zod, AJV, manual `assertString`). Inside the module, trust the shape.

## Error Handling — Plain-JS Notes

Universal rules (extend `Error`, use `cause`, never throw strings) live in the TypeScript guide. Plain-JS extras:

- **Set `name` explicitly** in custom error subclasses — minifiers / bundlers will rename the class, and `error.name` is what survives in logs:

  ```js
  class HttpError extends Error {
    constructor(message, { status, cause } = {}) {
      super(message, { cause });
      this.name = "HttpError";
      this.status = status;
    }
  }
  ```

- Without TS narrowing, branch by `instanceof`, not by string-matching `error.name`:
  ```js
  catch (e) {
    if (!(e instanceof HttpError)) throw e;
    // ...
  }
  ```

## Modern Syntax

These transfer directly from the TypeScript guide; in plain JS they're even more important because there's no compiler insisting on them. Use:

- Optional chaining `obj?.user?.name`
- Nullish coalescing `value ?? fallback` (over `||` when `0` / `""` / `false` are valid)
- Spread / rest, object shorthand, template literals, numeric separators (`1_000_000`)
- `for...of` over `forEach` when the body needs `await`, `break`, or `continue`
- **Strict equality** `===` / `!==` — loose equality has too many footguns, never reach for it intentionally

## Doc-Comments — JSDoc

Use `/** ... */`. The general rules (first line is imperative, document exported APIs, skip obvious one-liners) match the TypeScript guide. JSDoc differences vs TSDoc:

- **Type annotations**: `@param {string} userId` — the type is part of the comment, since there's no TS to read it from the signature. Skip the type only when it's inferred and uninteresting (`@param userId - the user id`).
- **`@typedef`** is your "interface" — define shared shapes once, reference them everywhere with `{User}`.
- **`@example`** with a fenced code block helps IDEs render usage in hover tooltips.

## Conventions

- **No `arguments` object** — use rest params (`...args`). Arrows don't have an `arguments` object anyway, and rest params survive any future TS migration.
- **Arrow vs `function`**: arrows for callbacks and module-level pure helpers. Use `function` (or `class` methods) when you need `this` binding — arrows do not have their own `this`.
- **No `console.log` in committed code** — use a real logger that supports levels and structured fields.
- **Crypto**: `crypto.getRandomValues(...)`. In Node ≥ 22 the Web Crypto API is a stable global; older versions need `import { webcrypto as crypto } from 'node:crypto'`. `Math.random` is not cryptographically suitable.
- **Tests**: Node's built-in [`node:test`](https://nodejs.org/api/test.html) (`node --test test/*.test.mjs`) is sufficient for most projects; reach for Vitest / Jest only when you need their specific mocking surfaces.
- **Linting**: ESLint with `eslint:recommended` + project rules. Run in CI; fix in code, not with `// eslint-disable-next-line`.
