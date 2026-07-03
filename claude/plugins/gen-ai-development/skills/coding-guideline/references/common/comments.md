# Comments & Documentation

Cross-language principles for inline comments and documentation comments (doc-comments). Each language guide provides the idiomatic syntax and examples.

## Two Kinds of Comments

### 1. Inline Comments — Explain *Why*

Inline comments exist for one reason: to capture information that the code cannot express on its own.

**Good reasons to comment:**
- **Intent**: why this approach was chosen over an obvious alternative
- **Constraints**: non-obvious performance, security, or compatibility considerations
- **Workarounds**: linking to a bug tracker issue when the code looks strange because it is working around an external bug
- **Domain knowledge**: business rules that aren't self-evident from the code

**Bad reasons to comment:**
- Restating what the code does (`// increment counter` above `counter++`)
- Marking sections that should be separate functions
- Apologizing for bad code — fix the code instead

If you find yourself writing a comment to explain *what* a block does, that is a signal to extract a well-named function or rename variables.

### 2. Doc-Comments — Describe the Contract

Doc-comments are the public API's user manual. They target consumers who will call your function, instantiate your class, or implement your interface — without reading the source.

**What to document:**
- **Public API** — every exported function, class, type, and module. This is the primary audience for doc-comments.
- **Non-obvious behavior** — side effects, error conditions, thread-safety guarantees, performance characteristics.
- **Parameters** — only when the name alone is ambiguous. `userId: string` needs no `@param` tag; `threshold: number` might.
- **Return value** — when the type alone doesn't tell the full story.
- **Examples** — for non-trivial APIs, a usage example is worth more than paragraphs of description.

**What NOT to document:**
- Private/internal helpers — the code is the documentation.
- Trivial getters/setters — `getName()` returning `name` does not need a doc-comment.
- Implementation details — doc-comments describe *what* and *why*, not *how*.

### Writing Style

- First line: a concise summary sentence that makes sense in an auto-generated index.
- Use imperative mood for functions: "Fetch the user profile" not "This function fetches the user profile" or "Fetches the user profile".
- Keep it scannable — short paragraphs, bullet lists for multiple conditions or caveats.

## Language Doc-Comment Syntax

| Language | Syntax | Tool |
|----------|--------|------|
| TypeScript | `/** ... */` (TSDoc) | TypeDoc, VS Code IntelliSense |
| React | `/** ... */` (TSDoc) | Same as TypeScript |
| JavaScript | `/** ... */` (JSDoc) — supports `@typedef`, `@param {type}`, `@returns {type}` | JSDoc, `tsc --checkJs`, VS Code |
| Python | `"""..."""` (docstring) | Sphinx, pydoc, VS Code |
| Go | `// Comment above declaration` | godoc, pkg.go.dev |
| Rust | `/// ...` (outer) / `//! ...` (module) | rustdoc, docs.rs |
| Swift | `/// ...` or `/** ... */` | DocC, Xcode Quick Help |
| Dart / Flutter | `/// ...` — reference identifiers with `[brackets]` | `dart doc`, IDE Quick Help |
