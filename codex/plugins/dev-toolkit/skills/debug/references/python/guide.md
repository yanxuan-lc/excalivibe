# Python Debug Guide

## 1. Tagged Probe Injection

Use `logging` or `print` with the `[debug:<id>]` tag on the same line.

```python
# logging module (preferred — goes to stderr via basicConfig)
import logging
logging.debug('[debug:my-session] value: %r', value)  # [debug:my-session]
logging.info('[debug:my-session] state: %r', state)   # [debug:my-session]

# print to stderr (simpler, always visible)
import sys
print(f'[debug:my-session] value: {value!r}', file=sys.stderr)  # [debug:my-session]

# plain print (stdout — visible in pytest with -s flag)
print(f'[debug:my-session] ctx: {ctx!r}')  # [debug:my-session]
```

To enable `logging.debug` output during a pytest run, add to `pytest.ini` or `pyproject.toml` (temporary, revert after session):

```ini
[pytest]
log_cli = true
log_cli_level = DEBUG
```

See `../common/cleanup.md` for the full tag convention and removal procedure.

## 2. Reproduce / Run Command

```bash
# Run all tests
pytest

# Run a specific file
pytest tests/test_auth.py

# Run a specific test function
pytest tests/test_auth.py::test_login_success

# With verbose output and full traceback
pytest -v --tb=long

# Show stdout (print probes) — captured by default
pytest -s

# With coverage
pytest --cov=src --cov-report=term-missing
```

Exit code 0 = all tests pass. Exit code 1 = at least one test failed. Exit code 2 = user interrupt. Exit code 3+ = internal error.

## 3. Error-Driven Exit-Code Convention (Loop B)

| Exit code | Meaning |
|---|---|
| 0 | All tests pass |
| 1 | Test failure — read stderr for assertion diff and traceback |
| 2 | User interrupt (Ctrl-C) |
| 3 | Internal pytest error |
| 4 | Command-line usage error |
| 5 | No tests collected (possibly a path or filter error) |

When a test fails, pytest prints the failing test name, the assertion expression, the diff (for `==` comparisons), and the full traceback. Read this output directly; do not ask the user to paste it.

Unhandled exceptions in tests appear as `ERROR` lines with a full traceback — locate the first frame in your source code (below the pytest framework frames) to find the root cause.

## 4. CLI Debugger for Loop C — `pdb` / `debugpy`

**`pdb` (built-in):**

```bash
# Break into pdb on first test failure
pytest --pdb

# Start pdb at a specific line in code
# (add temporarily, remove during cleanup)
import pdb; pdb.set_trace()  # [debug:my-session]

# Python 3.7+ shorthand
breakpoint()  # [debug:my-session]
```

Inside `pdb`:

```
(Pdb) p variable      # print variable
(Pdb) pp variable     # pretty-print
(Pdb) l               # list surrounding source
(Pdb) n               # next (step over)
(Pdb) s               # step into
(Pdb) c               # continue
(Pdb) bt              # backtrace
(Pdb) q               # quit
```

**`debugpy` (VS Code / remote attach):**

```python
import debugpy
debugpy.listen(5678)
debugpy.wait_for_client()   # pause until debugger attaches
```

Then attach VS Code "Python: Remote Attach" launch config on port 5678.

> Loop C requires an interactive terminal (TTY) for `pdb`. `debugpy` supports headless attach but requires the client to connect before execution continues. In fully headless / CI contexts, fall back to Loop A (tagged `print` / `logging` probes).

## 5. Browser Handoff

Python is a backend language; browser debugging is **n/a** for server-side Python code. If the Python process serves a web front-end and the symptom is in the browser layer, invoke the `graceful-browser` skill for browser-side inspection.
