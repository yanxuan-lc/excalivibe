---
name: develop-guideline
description: Multi-language development guidelines — coding style, naming, types, error handling, and module structure for TypeScript, JavaScript, React, React Native, Python, Go, Rust, Swift, Dart, and Flutter. Use this skill whenever writing new code, modifying existing files, adding components or functions, implementing features, fixing bugs, or reviewing code in any supported language. Also use when the user asks about coding conventions, style questions, or how to structure new modules — even if they don't mention "guidelines" explicitly.
---

# Development Guidelines

Universal principles that apply regardless of language, plus per-language conventions loaded on demand.

## How to Use This Skill

1. Read the universal principles below — they always apply.
2. Identify the language(s) in play and read the corresponding reference file(s). When a framework guide says "builds on" a language guide, read the language guide first.
3. When a language-specific rule conflicts with a universal principle, the language-specific rule wins.

## Language Reference Routing

| Language | Reference | When to read |
|----------|-----------|--------------|
| All | [references/common/naming.md](references/common/naming.md) | Naming decisions in any language |
| All | [references/common/error-handling.md](references/common/error-handling.md) | Error handling design in any language |
| All | [references/common/code-organization.md](references/common/code-organization.md) | Module/file structure in any language |
| All | [references/common/comments.md](references/common/comments.md) | Comment style, doc-comment conventions in any language |
| TypeScript | [references/typescript/guide.md](references/typescript/guide.md) | Writing or modifying `.ts` files |
| React | [references/react/guide.md](references/react/guide.md) | Writing or modifying `.tsx` files, React components/hooks |
| React Native | [references/react-native/guide.md](references/react-native/guide.md) | Writing or modifying React Native screens/components (core components, StyleSheet, platform files, native modules); layered on top of React |
| JavaScript | [references/javascript/guide.md](references/javascript/guide.md) | Writing or modifying `.js`/`.mjs` files in plain-JS (non-TS) projects |
| Python | [references/python/guide.md](references/python/guide.md) | Writing or modifying `.py` files |
| Go | [references/go/guide.md](references/go/guide.md) | Writing or modifying `.go` files |
| Rust | [references/rust/guide.md](references/rust/guide.md) | Writing or modifying `.rs` files |
| Swift | [references/swift/guide.md](references/swift/guide.md) | Writing or modifying `.swift` files |
| Dart | [references/dart/guide.md](references/dart/guide.md) | Writing or modifying `.dart` files (read first for any Flutter work) |
| Flutter | [references/flutter/guide.md](references/flutter/guide.md) | Writing or modifying Flutter widgets/state/build code; layered on top of Dart |

Read only what is relevant — do not load all reference files at once.

---

## Universal Principles

These apply to every language and every file.

### Clarity Over Cleverness

Write code that a teammate can understand without extra context. Prefer straightforward logic over concise-but-obscure tricks. If a block of code needs a comment to explain *what* it does, rewrite the code instead.

### Comments Explain Why, Not What

Good comments capture intent, trade-offs, or non-obvious constraints. The code itself should make the *what* obvious through naming and structure. Document all public APIs with doc-comments — see [references/common/comments.md](references/common/comments.md) for the full policy, and each language guide for idiomatic syntax and examples.

### Fail Fast

Check preconditions early. Return or throw before doing real work. This keeps the happy path unindented and easy to follow.

### Validate at Boundaries, Trust Internals

Validate user input, external API responses, and data crossing system boundaries. Inside the system, trust the types and contracts — do not re-validate what you already control.

### Single Responsibility

Each function does one thing. Each module owns one concept. When a function is doing two things, split it. When a module is growing vague, extract the new concern.

### Minimal Surface Area

Export only what consumers need. Keep helpers private. Avoid premature abstraction — three similar lines are better than a generic utility used once.

### Async by Default (where applicable)

Prefer `async/await` (or the language's equivalent) over callbacks or raw futures. Sequential async reads top-to-bottom; keep it that way. This applies to languages whose I/O model is async-first (TypeScript/JavaScript, Python, Swift, Dart); in Go, idiomatic blocking code with goroutines *is* the equivalent, and in Rust reach for async only when the project/runtime already calls for it.

### Early Returns Over Deep Nesting

Guard clauses at the top. One level of indentation for the main logic. This is the structural expression of "fail fast."
