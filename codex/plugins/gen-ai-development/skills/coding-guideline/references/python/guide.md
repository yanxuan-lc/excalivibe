# Python Guide

Python-specific conventions. Assumes familiarity with the universal principles in SKILL.md.

## Style Foundation

Follow PEP 8 with these clarifications. Use a formatter (Black or Ruff) to handle whitespace and line length automatically — do not spend human effort on formatting.

## Type Hints

Type-annotate all public function signatures. Internal helpers benefit from annotations too, but brevity wins when the types are obvious from context.

```python
def fetch_user(user_id: str) -> User:
    ...

def calculate_total(items: list[OrderItem], *, tax_rate: float = 0.0) -> Decimal:
    ...
```

- Use `from __future__ import annotations` at the top of every module for forward-reference support.
- Prefer built-in generics (`list[str]`, `dict[str, int]`) over `typing.List`, `typing.Dict` (Python 3.9+).
- Use `X | None` over `Optional[X]` (Python 3.10+).
- Use `TypeAlias` for complex type expressions:

```python
from typing import TypeAlias

UserMap: TypeAlias = dict[str, list[User]]
```

## Imports

Three groups, separated by blank lines:

```python
# 1. Standard library
import os
from pathlib import Path

# 2. Third-party
from fastapi import FastAPI
from pydantic import BaseModel

# 3. Local
from app.models import User
from app.services.auth import verify_token
```

- Absolute imports for cross-module references.
- Relative imports only within the same package (`from .utils import slugify`).
- `isort` or Ruff handles ordering automatically.

## Error Handling

Custom exception hierarchy rooted in a project base exception:

```python
class AppError(Exception):
    """Base for all application errors."""

class NotFoundError(AppError):
    """Raised when a requested resource does not exist."""

class ValidationError(AppError):
    """Raised when input fails validation."""
    def __init__(self, message: str, field: str | None = None):
        super().__init__(message)
        self.field = field
```

- Catch specific exceptions — never bare `except:` or `except Exception:` unless re-raising.
- Use `raise ... from err` to preserve the cause chain.
- Use context managers (`with`) for resource cleanup.

## Project Structure

```
project/
├── src/
│   └── package_name/
│       ├── __init__.py
│       ├── models/
│       ├── services/
│       ├── api/
│       └── utils.py
├── tests/
│   ├── conftest.py
│   ├── test_models.py
│   └── test_services.py
├── pyproject.toml
└── README.md
```

- Use `pyproject.toml` as the single source of metadata and tool config.
- `src/` layout avoids accidental imports from the project root.
- Tests mirror `src/` structure.

## Docstrings

Use triple double-quotes (`"""..."""`). Follow Google style for multi-line docstrings.

```python
def fetch_user(user_id: str) -> User:
    """Fetch a user profile by ID.

    Queries the user service and returns the full profile. Raises
    NotFoundError if no user matches the given ID.

    Args:
        user_id: The unique identifier of the user.

    Returns:
        The resolved user profile.

    Raises:
        NotFoundError: When no user matches the given ID.
        ConnectionError: When the user service is unreachable.

    Example:
        >>> user = fetch_user("u_123")
        >>> user.name
        'Alice'
    """
    ...


class AuthService:
    """Handle authentication and token management.

    This service manages JWT token lifecycle including creation,
    validation, and refresh. It is the single source of truth for
    authentication state in the application.

    Attributes:
        token_ttl: Token time-to-live in seconds.
    """

    def __init__(self, token_ttl: int = 3600) -> None:
        """Initialize AuthService.

        Args:
            token_ttl: Token time-to-live in seconds. Defaults to 1 hour.
        """
        self.token_ttl = token_ttl
```

- Document all public functions, classes, and methods.
- `Args:`, `Returns:`, `Raises:` sections when applicable — omit empty sections.
- One-liner docstrings for trivial functions: `"""Return the user's display name."""`
- Module-level docstrings at the top of files that serve as entry points or have non-obvious purpose.
- Skip docstrings on private helpers (`_helper_name`) and `__init__` when it only does simple assignment.

## Conventions

- **Dataclasses / Pydantic models** for structured data — avoid raw dicts for domain objects.
- **`async/await`** with `asyncio` for I/O-bound code. Do not mix sync blocking calls in async paths.
- **Keyword-only arguments** (`*`) for functions with 3+ parameters to prevent positional confusion.
- **f-strings** for interpolation. `.format()` only when the template is dynamic.
- **`pathlib.Path`** over `os.path` for file system operations.
- **Comprehensions** over `map`/`filter` when the logic fits one line. Use a loop when it doesn't.
- **`__all__`** in `__init__.py` to define the public API of a package.
