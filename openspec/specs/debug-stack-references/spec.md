# debug-stack-references Specification

## Purpose

Defines the `references/` content backing the `debug` skill: a shared `common/cleanup.md` tag-and-cleanup convention plus a per-stack `guide.md` for each of 8 supported stacks (react, react-native, flutter, go, rust, tauri, nodejs, python). All reference files are byte-identical between the Claude and Codex ends. Each stack guide covers five debugging areas and defers to `common/cleanup.md` for the cleanup procedure; the Tauri guide is a dual-side router that delegates probe syntax to the rust and react guides.

## Requirements

### Requirement: common/cleanup.md defines the tag convention

The debug skill SHALL provide a file at `skills/debug/references/common/cleanup.md` on both Claude and Codex ends (byte-identical). This file MUST define: (a) the canonical tag body `[debug:<id>]` where `<id>` is a short kebab-case session identifier chosen by the agent; (b) language-specific comment wrappers for all 8 supported stacks; (c) the canonical grep command `grep -rn '\[debug:' <project-root>`; (d) the deterministic removal procedure (read grep output, open each file, delete tagged lines, save); (e) the self-check (`git diff` must show zero `[debug:` lines after cleanup).

#### Scenario: cleanup.md defines the canonical tag body

- **WHEN** `references/common/cleanup.md` is read
- **THEN** it contains the pattern `[debug:<id>]` and explains that `<id>` is a short kebab-case session identifier

#### Scenario: cleanup.md provides language-specific wrappers

- **WHEN** `references/common/cleanup.md` is read
- **THEN** it shows comment syntax for at least: JavaScript/TypeScript (`// [debug:<id>]`), Python (`# [debug:<id>]`), Go (`// [debug:<id>]`), Rust (`// [debug:<id>]`), Dart/Flutter (`// [debug:<id>]`), HTML/JSX (`{/* [debug:<id>] */}`)

#### Scenario: cleanup.md includes the grep command

- **WHEN** `references/common/cleanup.md` is read
- **THEN** it contains the exact grep command: `grep -rn '\[debug:' <project-root>`

### Requirement: Each of the 8 stacks has a guide.md

The debug skill SHALL provide a `references/<stack>/guide.md` for each of the following stacks: `react`, `react-native`, `flutter`, `go`, `rust`, `tauri`, `nodejs`, `python`. All 9 reference files (8 stacks + common/cleanup) SHALL be byte-identical between the Claude and Codex ends.

#### Scenario: All 8 stack guides exist on Claude end

- **WHEN** the directory `claude/plugins/gen-ai-development/skills/debug/references/` is listed
- **THEN** subdirectories `react/`, `react-native/`, `flutter/`, `go/`, `rust/`, `tauri/`, `nodejs/`, `python/`, and `common/` each contain a `guide.md` (or `cleanup.md` for common)

#### Scenario: All 8 stack guides exist on Codex end

- **WHEN** the directory `codex/plugins/gen-ai-development/skills/debug/references/` is listed
- **THEN** the same subdirectories and files are present as on the Claude end

#### Scenario: Stack guide files are byte-identical across ends

- **WHEN** corresponding guide files on Claude and Codex ends are diffed
- **THEN** every diff is empty

### Requirement: Each stack guide covers five areas

Each `references/<stack>/guide.md` MUST cover: (i) tagged probe injection — the language-idiomatic way to add a `[debug:<id>]` tagged log/print statement; (ii) reproduce/run command — the canonical command to trigger the bug or run the test suite; (iii) error-driven exit-code convention — how to detect and read non-zero exits (Loop B entry point); (iv) CLI debugger for Loop C — the specific debugger binary and basic invocation; (v) front-end handoff — instructions to invoke `graceful-browser` skill or `plugin-infra` chrome-devtools MCP for browser/UI symptoms (where applicable; may be "n/a" for backend-only stacks).

#### Scenario: React guide covers all five areas

- **WHEN** `references/react/guide.md` is read
- **THEN** it contains sections for: `console.*` tagged probe injection, `vitest`/`jest` run command with exit code, node --inspect for Loop C, and graceful-browser handoff for D4

#### Scenario: Go guide covers all five areas

- **WHEN** `references/go/guide.md` is read
- **THEN** it contains sections for: `log`/`slog` tagged probe, `go test ./...` with exit code, `dlv` (delve) for Loop C, and notes "n/a" for browser handoff

#### Scenario: Python guide covers all five areas

- **WHEN** `references/python/guide.md` is read
- **THEN** it contains sections for: `logging`/`print` tagged probe, `pytest` with exit code, `pdb`/`debugpy` for Loop C, and notes "n/a" for browser handoff

#### Scenario: Rust guide covers all five areas

- **WHEN** `references/rust/guide.md` is read
- **THEN** it contains sections for: `dbg!`/`tracing`/`eprintln!` tagged probe, `cargo test` with exit code, `rust-lldb`/`rust-gdb` for Loop C, and notes "n/a" for browser handoff

#### Scenario: Flutter guide covers all five areas

- **WHEN** `references/flutter/guide.md` is read
- **THEN** it contains sections for: `debugPrint`/`dart:developer log` tagged probe, `flutter test` with exit code, `dart`/`flutter` DevTools (observatory) for Loop C, and notes "n/a" for browser handoff

#### Scenario: Node.js guide covers all five areas

- **WHEN** `references/nodejs/guide.md` is read
- **THEN** it contains sections for: `console.*` / `debug` pkg tagged probe, `node`/test-runner exit code, `node --inspect`/`node --inspect-brk` for Loop C, and notes "n/a" for browser handoff

#### Scenario: React Native guide covers all five areas

- **WHEN** `references/react-native/guide.md` is read
- **THEN** it contains sections for: `console.*`/LogBox tagged probe, `jest` exit code, Hermes inspector/`node --inspect` for Loop C, and RN devtools handoff where applicable

### Requirement: Tauri guide is a dual-side router

The `references/tauri/guide.md` MUST NOT duplicate the Rust or React probe sections. Instead it SHALL: (a) provide a triage checklist to determine whether the symptom is on the Rust core process or the webview front-end; (b) route Rust-side symptoms to `rust-lldb`/`tracing` (referencing the rust guide for probe syntax); (c) route webview-side symptoms to `graceful-browser`/devtools (referencing the react guide for probe syntax); (d) explain how to run `cargo test` for core and front-end test runner for the webview side.

#### Scenario: Tauri guide routes core-process bug to rust-lldb

- **WHEN** `references/tauri/guide.md` is read and the symptom is a Rust core-process panic or wrong logic
- **THEN** the guide directs use of `rust-lldb`/`tracing` and cross-references `references/rust/guide.md`

#### Scenario: Tauri guide routes webview bug to graceful-browser

- **WHEN** `references/tauri/guide.md` is read and the symptom is a UI or network issue in the webview
- **THEN** the guide directs invocation of `graceful-browser` skill or chrome-devtools MCP and cross-references `references/react/guide.md`

#### Scenario: Tauri guide includes triage checklist

- **WHEN** `references/tauri/guide.md` is read
- **THEN** it includes an explicit checklist or decision table distinguishing Rust-side from webview-side symptoms (e.g., "panic/core crash → Rust side; UI wrong / network wrong → webview side")

### Requirement: Every stack guide references cleanup.md

Each `references/<stack>/guide.md` MUST include a reference to `../common/cleanup.md` (or equivalent path) for the tag convention and cleanup procedure. The guide SHALL NOT duplicate the cleanup steps — it SHALL link/defer to `common/cleanup.md`.

#### Scenario: Stack guide references cleanup.md

- **WHEN** any of the 8 stack guides is read
- **THEN** it contains a reference to `common/cleanup.md` (by relative path or explicit mention) for the `[debug:<id>]` tag convention
