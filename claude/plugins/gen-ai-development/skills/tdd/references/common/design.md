# Design for Testability

Principles for writing code that is naturally easy to test, regardless of language.

## Deep Modules

From "A Philosophy of Software Design": a **deep module** has a small interface hiding lots of implementation. A **shallow module** has a large interface with thin implementation.

```
Deep module (good):          Shallow module (avoid):
+------------------+         +--------------------------------+
| Small Interface  |         |       Large Interface          |
+------------------+         +--------------------------------+
|                  |         | Thin Implementation            |
| Deep             |         +--------------------------------+
| Implementation   |
|                  |
+------------------+
```

Deep modules are easier to test: fewer methods means fewer tests, and each test exercises more meaningful behavior.

When designing interfaces, ask:
- Can I reduce the number of methods?
- Can I simplify the parameters?
- Can I hide more complexity inside?

## Interface Design Principles

### 1. Accept dependencies, don't create them

```
# Testable
function process_order(order, gateway):
    return gateway.charge(order.total)

# Hard to test
function process_order(order):
    gateway = new StripeGateway(env.STRIPE_KEY)
    return gateway.charge(order.total)
```

### 2. Return results, don't produce side effects

```
# Testable — assert on return value
function calculate_discount(cart):
    return { amount: cart.total * 0.1, reason: "loyalty" }

# Hard to test — must inspect mutated state
function apply_discount(cart):
    cart.total -= cart.total * 0.1
```

### 3. Small surface area

- Fewer methods = fewer tests needed
- Fewer params = simpler test setup
- Prefer one method that does something meaningful over five methods that each do a trivial step

## Refactor Candidates

After each GREEN phase, check for these. Refactor only when the signal is clear — don't force it.

| Candidate | Signal | Action |
|-----------|--------|--------|
| Duplication | Same logic in 2+ places | Extract function |
| Long function | Function does multiple things | Break into private helpers (keep tests on public interface) |
| Shallow module | Wrapper with same interface as wrapped | Combine or deepen |
| Feature envy | Function uses more data from another module than its own | Move logic to where data lives |
| Primitive obsession | Passing raw strings/dicts for structured data | Introduce value objects / domain types |
| Revealed problems | New code makes existing code look worse | Improve the existing code too |

**Rules:**
- Never refactor while RED — get to GREEN first.
- Run tests after each refactor step.
- Each refactor should be a small, verifiable change.
- If a refactor is large, treat it as its own RED-GREEN cycle.
