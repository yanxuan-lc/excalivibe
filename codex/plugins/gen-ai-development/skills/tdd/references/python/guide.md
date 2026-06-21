# Python TDD Toolchain

pytest as the default test framework for Python projects.

## Stack

- **Test runner**: [pytest](https://docs.pytest.org)
- **Run command**: `pytest`
- **Coverage command**: `pytest --cov=src --cov-report=term-missing`
- **Function / interface coverage**: coverage.py reports lines, not functions — judge interface coverage manually: every public symbol (no leading underscore) in the module's API must be exercised by at least one test.
- **Mocking**: `unittest.mock` (stdlib) + `pytest-mock` plugin

## Setup

```bash
pip install pytest pytest-cov pytest-mock pytest-asyncio
```

**pyproject.toml** configuration:

```toml
[tool.pytest.ini_options]
testpaths = ["tests"]
python_files = ["test_*.py"]
python_functions = ["test_*"]
asyncio_mode = "auto"

[tool.coverage.run]
source = ["src"]

[tool.coverage.report]
show_missing = true
fail_under = 90
```

## File Organization

Mirror source structure under `tests/`:

```
src/
├── package_name/
│   ├── __init__.py
│   ├── models/
│   │   └── user.py
│   ├── services/
│   │   └── auth.py
│   └── utils.py

tests/
├── conftest.py              # Shared fixtures
├── models/
│   └── test_user.py
├── services/
│   └── test_auth.py
└── test_utils.py
```

- `test_` prefix for test files and functions.
- `conftest.py` for shared fixtures (pytest auto-discovers them).
- Group with classes when useful: `class TestCheckout:`.

## Test Example

```python
from package_name.services.checkout import checkout
from package_name.models.cart import Cart, Product


class TestCheckout:
    def test_confirms_order_with_valid_cart(self):
        cart = Cart()
        cart.add(Product(id="p1", name="Widget", price=10))

        class FakeGateway:
            def charge(self, amount):
                return {"status": "approved", "id": "receipt-1"}

        result = checkout(cart, FakeGateway())

        assert result.status == "confirmed"
        assert result.order_id is not None

    def test_rejects_empty_cart(self):
        cart = Cart()

        class FakeGateway:
            def charge(self, amount):
                return {"status": "approved", "id": "r1"}

        with pytest.raises(ValueError, match="Cart is empty"):
            checkout(cart, FakeGateway())
```

## Fixtures

```python
import pytest
from package_name.models.cart import Cart, Product


@pytest.fixture
def cart_with_item():
    cart = Cart()
    cart.add(Product(id="p1", name="Widget", price=10))
    return cart


@pytest.fixture
def fake_gateway():
    class FakeGateway:
        def charge(self, amount):
            return {"status": "approved", "id": "receipt-1"}
    return FakeGateway()
```

## Mocking Tools

### `mocker` fixture (pytest-mock)

```python
def test_signup_sends_email(mocker):
    mock_send = mocker.patch("package_name.clients.email.send_email")

    signup(email="alice@example.com")

    mock_send.assert_called_once_with(
        to="alice@example.com",
        subject="Welcome",
    )
```

### `unittest.mock.patch` — context manager

```python
from unittest.mock import patch

def test_reads_api_key():
    with patch.dict("os.environ", {"API_KEY": "test-key-123"}):
        config = load_config()
        assert config.api_key == "test-key-123"
```

### `freezegun` — time control

```python
from freezegun import freeze_time

@freeze_time("2026-01-15 12:00:00")
def test_token_expires():
    token = create_token(ttl_seconds=3600)
    with freeze_time("2026-01-15 13:00:01"):
        assert token.is_expired()
```

## Async Tests

```python
import pytest

@pytest.mark.asyncio
async def test_fetch_user():
    user = await fetch_user("u_123")
    assert user.name == "Alice"
```
