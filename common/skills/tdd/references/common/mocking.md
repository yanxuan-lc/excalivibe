# When and How to Mock

Mocking is a tool for isolating your code from things you don't control. The key insight: mock at **system boundaries**, not between your own modules.

## Mock These (System Boundaries)

- External APIs (payment, email, third-party services)
- Databases (sometimes — prefer test DB or in-memory alternative)
- Time / randomness / UUIDs
- File system (sometimes)
- Network I/O

## Don't Mock These (Your Own Code)

- Your own classes/modules
- Internal collaborators
- Anything you control and can run in tests

If you find yourself mocking internal code to make tests work, that is a design signal — the code needs better boundaries, not more mocks.

## Preferred Mocking Strategy: Dependency Injection

The most portable and language-agnostic mocking technique is to accept dependencies as parameters rather than creating them internally:

```
# Testable — dependency is injected
function checkout(cart, gateway):
    return gateway.charge(cart.total)

# Test passes a fake
test "checkout succeeds with valid cart":
    fake_gateway = { charge: () -> { status: "approved" } }
    result = checkout(cart, fake_gateway)
    assert result.status == "approved"
```

```
# Hard to test — dependency is created internally
function checkout(cart):
    gateway = new StripeGateway(env.STRIPE_KEY)
    return gateway.charge(cart.total)
```

## Designing for Mockability

### Accept dependencies, don't create them
Pass external dependencies as parameters or constructor arguments.

### Prefer specific interfaces over generic ones
Create focused interfaces for each external operation rather than one catch-all "request" method. Each mock returns one specific shape — no conditional logic in test setup.

### Keep boundary layers thin
The code that touches external systems should be a thin adapter with no business logic. Test business logic with real objects; mock only the thin adapter.

## Language-Specific Mocking Tools

Each language guide covers the idiomatic mocking tools:

| Language | Primary mocking tool |
|----------|---------------------|
| TypeScript | `vi.mock()`, `vi.spyOn()`, `vi.fn()` |
| React | Same as TypeScript + provider wrappers |
| Python | `unittest.mock.patch`, `pytest-mock`, `MagicMock` |
| Go | Interface-based fakes (no framework needed) |
| Rust | Trait-based fakes, `mockall` crate |
| Swift | Protocol-based fakes, `@testable import` |
