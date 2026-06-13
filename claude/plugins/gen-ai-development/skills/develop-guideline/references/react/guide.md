# React Guide

React-specific conventions for components, hooks, and styling. Builds on the TypeScript guide — read that first for general TS rules.

## Table of Contents

- [Component Declaration](#component-declaration)
- [Hooks](#hooks)
- [Component File Organization](#component-file-organization)
- [Event Handling](#event-handling)
- [Styling with Tailwind and CVA](#styling-with-tailwind-and-cva)
- [Tauri IPC](#tauri-ipc)

---

## Component Declaration

Use function declarations. Props get their own `interface` when non-trivial.

```tsx
interface UserCardProps {
  user: User;
  onSelect?: (id: string) => void;
}

function UserCard({ user, onSelect }: UserCardProps) {
  return (
    <button onClick={() => onSelect?.(user.id)}>
      {user.name}
    </button>
  );
}
```

- Destructure props in the parameter list.
- Suffix props interfaces with `Props`.
- Avoid `React.FC` — it adds implicit `children` and obscures the return type.

## Hooks

### Custom Hook Conventions

- Prefix with `use` — `useAuth`, `useDebounce`.
- Return a tuple `[value, setter]` for single-state hooks, or a named object for multi-value hooks.
- Extract hooks when logic is reused across components OR when a component's hook logic exceeds ~15 lines.

```tsx
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
```

### Hook Rules

- Never call hooks conditionally or in loops.
- Keep `useEffect` dependencies honest — do not suppress the linter.
- Prefer derived state over `useEffect` + `useState`:

```tsx
// Good — derived
const fullName = `${firstName} ${lastName}`;

// Bad — unnecessary effect
const [fullName, setFullName] = useState("");
useEffect(() => {
  setFullName(`${firstName} ${lastName}`);
}, [firstName, lastName]);
```

## Component File Organization

Within a component file:

1. Imports
2. Types / interfaces
3. Constants
4. Helper functions (non-hook, non-component)
5. Custom hooks (if local to this file)
6. Component(s) — primary component last, exported

### TSDoc for Components and Hooks

Document all exported components and hooks. Skip internal helpers.

```tsx
/**
 * Render a user avatar with optional online status indicator.
 *
 * Displays the user's profile image in a circle. When `showStatus` is true,
 * a green/gray dot appears at the bottom-right corner.
 *
 * @example
 * ```tsx
 * <Avatar user={currentUser} showStatus />
 * ```
 */
function Avatar({ user, showStatus = false }: AvatarProps) {
  // ...
}

/**
 * Debounce a value by the given delay.
 *
 * Returns the most recent value only after `delay` ms of inactivity.
 * Useful for search inputs where you want to avoid firing a request
 * on every keystroke.
 *
 * @param value - The value to debounce
 * @param delay - Debounce window in milliseconds
 * @returns The debounced value
 *
 * @example
 * ```tsx
 * const debouncedQuery = useDebounce(searchInput, 300);
 * ```
 */
function useDebounce<T>(value: T, delay: number): T {
  // ...
}
```

- First line: imperative summary that reads well in IDE hover tooltips.
- `@param` only when the prop/argument name is not self-explanatory.
- `@example` with JSX for components, with a hook call for hooks.
- Props interfaces with `Props` suffix generally don't need separate doc-comments — document on the component instead.

## Event Handling

- Name handlers `handle<Event>` in the component: `handleClick`, `handleSubmit`.
- Name callback props `on<Event>`: `onClick`, `onSubmit`.
- Use the specific event type when the handler reads event properties:

```tsx
function SearchInput({ onSearch }: { onSearch: (query: string) => void }) {
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    onSearch(form.get("query") as string);
  }

  return (
    <form onSubmit={handleSubmit}>
      <input name="query" />
    </form>
  );
}
```

## Styling with Tailwind and CVA

### Utility-First

Use Tailwind utility classes directly in JSX. Avoid custom CSS unless Tailwind cannot express it.

### The `cn()` Utility

`cn()` (clsx + tailwind-merge) for conditional and composable class names:

```tsx
import { cn } from "@/lib/utils";

function Badge({ variant, className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        variant === "success" && "bg-green-100 text-green-800",
        variant === "error" && "bg-red-100 text-red-800",
        className
      )}
      {...props}
    />
  );
}
```

- Pass `className` through `cn()` last — lets consumers override styles.
- Use logical conditions, not ternaries with empty strings.

### Class Variance Authority (CVA)

Use CVA for components with 2+ variant dimensions:

```tsx
import { cva, type VariantProps } from "class-variance-authority";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        outline: "border border-input bg-background hover:bg-accent",
        ghost: "hover:bg-accent hover:text-accent-foreground",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-4 text-sm",
        lg: "h-12 px-6 text-base",
      },
    },
    defaultVariants: { variant: "default", size: "md" },
  }
);

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

function Button({ variant, size, className, ...props }: ButtonProps) {
  return (
    <button className={cn(buttonVariants({ variant, size }), className)} {...props} />
  );
}
```

**When to use CVA vs plain `cn()`:**
- **CVA**: 2+ variant dimensions or non-trivial variant combinations.
- **Plain `cn()`**: single boolean toggle or simple inline conditions.

### Style Guidelines

- Mobile-first responsive design: base styles for smallest, add `md:` / `lg:` breakpoints.
- Use CSS variable semantic colors (`bg-background`, `text-foreground`) for dark mode support.
- Avoid inline `style` props, `@apply`, and arbitrary values (`text-[13px]`) when a Tailwind scale value exists.

## Tauri IPC

When calling Tauri commands from the frontend:

```tsx
import { invoke } from "@tauri-apps/api/core";

const result = await invoke<UserData>("get_user", { userId: "123" });
```

- Always provide a type parameter to `invoke<T>()`.
- Handle IPC errors at the call site — Tauri command errors surface as rejected promises.
- Wrap frequently-used commands in typed helper functions.
