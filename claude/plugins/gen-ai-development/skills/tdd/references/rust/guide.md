# Rust TDD Toolchain

`cargo test` with inline `#[cfg(test)]` modules and the `tests/` directory.

## Stack

- **Test runner**: `cargo test`
- **Run command**: `cargo test`
- **Coverage command**: `cargo llvm-cov --lcov --output-path lcov.info` (requires `cargo-llvm-cov`)
- **Mocking**: Trait-based fakes, optionally `mockall` crate

## Setup

```bash
# Coverage tool (optional but recommended)
cargo install cargo-llvm-cov
```

No special config needed — Rust's test infrastructure is built into `cargo`.

## File Organization

Two locations for tests:

### Unit tests — inline `#[cfg(test)]` modules

```
src/
├── lib.rs
├── checkout.rs     # contains #[cfg(test)] mod tests { ... }
├── models/
│   ├── mod.rs
│   └── cart.rs     # contains #[cfg(test)] mod tests { ... }
└── services/
    └── auth.rs
```

### Integration tests — `tests/` directory

```
tests/
├── checkout_integration.rs
└── auth_flow.rs
```

Integration tests import the crate as an external consumer (`use mycrate::...`).

## Test Example

```rust
// src/checkout.rs
pub fn process(cart: &Cart, gateway: &dyn PaymentGateway) -> Result<Order, CheckoutError> {
    if cart.is_empty() {
        return Err(CheckoutError::EmptyCart);
    }
    let receipt = gateway.charge(cart.total())?;
    Ok(Order::new(receipt))
}

#[cfg(test)]
mod tests {
    use super::*;

    struct FakeGateway {
        status: String,
    }

    impl PaymentGateway for FakeGateway {
        fn charge(&self, _amount: f64) -> Result<Receipt, PaymentError> {
            Ok(Receipt { status: self.status.clone(), id: "fake-1".into() })
        }
    }

    #[test]
    fn confirms_order_with_valid_cart() {
        let mut cart = Cart::new();
        cart.add(Product { id: "p1".into(), name: "Widget".into(), price: 10.0 });
        let gateway = FakeGateway { status: "approved".into() };

        let result = process(&cart, &gateway).unwrap();

        assert_eq!(result.status, "confirmed");
        assert!(!result.order_id.is_empty());
    }

    #[test]
    fn rejects_empty_cart() {
        let cart = Cart::new();
        let gateway = FakeGateway { status: "approved".into() };

        let result = process(&cart, &gateway);

        assert!(matches!(result, Err(CheckoutError::EmptyCart)));
    }
}
```

## Mocking via Traits

Define a trait at the boundary, implement a fake for tests:

```rust
pub trait PaymentGateway {
    fn charge(&self, amount: f64) -> Result<Receipt, PaymentError>;
}

// Production implementation
pub struct StripeGateway { /* ... */ }
impl PaymentGateway for StripeGateway { /* ... */ }

// Test fake
#[cfg(test)]
struct FakeGateway {
    should_fail: bool,
}

#[cfg(test)]
impl PaymentGateway for FakeGateway {
    fn charge(&self, _amount: f64) -> Result<Receipt, PaymentError> {
        if self.should_fail {
            return Err(PaymentError::Declined);
        }
        Ok(Receipt { status: "approved".into(), id: "fake".into() })
    }
}
```

### `mockall` crate (for complex interfaces)

```rust
use mockall::automock;

#[automock]
pub trait EmailClient {
    fn send(&self, to: &str, subject: &str, body: &str) -> Result<(), EmailError>;
}

#[test]
fn signup_sends_welcome_email() {
    let mut mock = MockEmailClient::new();
    mock.expect_send()
        .withf(|to, subject, _| to == "alice@example.com" && subject == "Welcome")
        .times(1)
        .returning(|_, _, _| Ok(()));

    signup("alice@example.com", &mock).unwrap();
}
```

## Async Tests

```rust
#[tokio::test]
async fn fetch_user_returns_profile() {
    let user = fetch_user("u_123").await.unwrap();
    assert_eq!(user.name, "Alice");
}
```

## Useful Macros

- `assert_eq!(left, right)` — equality with nice diff output
- `assert!(condition)` — boolean assertion
- `assert!(matches!(value, Pattern))` — pattern matching
- `#[should_panic(expected = "message")]` — expect a panic
