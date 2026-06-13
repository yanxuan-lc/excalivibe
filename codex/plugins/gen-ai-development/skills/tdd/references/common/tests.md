# Good and Bad Tests

Cross-language principles for writing tests that verify behavior, not implementation.

## Good Tests

**Test through public interfaces.** A good test calls the same API that real code calls and asserts on observable outcomes.

Characteristics:
- Tests behavior users/callers care about
- Uses only public API
- Survives internal refactors without changes
- Describes WHAT the system does, not HOW
- One logical assertion per test (multiple asserts are fine if they verify one behavior)

**Pseudocode example:**

```
test "user can checkout with valid cart":
    cart = create_cart()
    cart.add(product)

    result = checkout(cart, payment_gateway)

    assert result.status == "confirmed"
    assert result.order_id is not empty
```

## Bad Tests

**Implementation-detail tests** — coupled to internal structure:

```
# BAD: Tests implementation, not behavior
test "checkout calls payment service":
    spy = mock(payment_service.process)
    checkout(cart, payment)
    assert spy was called once
    assert spy was called with cart.total
```

Red flags:
- Mocking internal collaborators (not system boundaries)
- Testing private methods directly
- Asserting on call counts or call order
- Test breaks when refactoring without behavior change
- Test name describes HOW, not WHAT

**Verify through the interface, not around it:**

```
# BAD: Bypasses interface to verify via database
test "createUser saves to database":
    create_user({ name: "Alice" })
    row = db.query("SELECT * FROM users WHERE name = 'Alice'")
    assert row is not null

# GOOD: Verifies through the same interface
test "created user is retrievable":
    user = create_user({ name: "Alice" })
    retrieved = get_user(user.id)
    assert retrieved.name == "Alice"
```

## Naming Convention

Test names should read like specifications — a non-developer should understand what the system does by reading them.

```
# GOOD: Describes behavior
"expired coupon is rejected"
"admin can delete any post"
"empty cart cannot checkout"

# BAD: Describes implementation
"validateCoupon returns false"
"deletePost calls repository"
"checkout throws ValueError"
```

## Test Organization

- **Mirror source structure**: test files live parallel to source files.
- **Group by module/class**: use your language's grouping mechanism (`describe`, sub-test, test class).
- **One behavior per test**: each test verifies a single behavioral expectation.

## Per-Cycle Checklist

When writing each test, verify:

```
[ ] Test describes behavior, not implementation
[ ] Test uses public interface only
[ ] Test would survive internal refactor
[ ] Code is minimal for this test
[ ] No speculative features added
[ ] Refactor candidates checked
[ ] Test file placed in correct location
```
