## ADDED Requirements

### Requirement: CLAUDE.md hooks framing is precise

`CLAUDE.md` (project-root), line ~16, currently reads (verbatim):

> "…禁写 `hooks` 字段），不要套用 Claude 的结构假设。"

This line SHALL be edited so the `hooks` prohibition clause gains the precise three-layer framing from REPORT.md §4: (a) the plugin manifest `hooks` field fails `validate_plugin.py` (validator rejects it); (b) the Codex runtime hooks capability exists via `config.toml`/`hooks.json`; (c) non-interactive exec firing is unverified and trust-gated; (d) v1 does not depend on hooks. The functional prohibition ("do NOT add `hooks` to `.codex-plugin/plugin.json`") MUST be preserved. No other content in `CLAUDE.md` SHALL be changed.

#### Scenario: CLAUDE.md no longer contains the bare "禁写 `hooks` 字段" clause without nuance (B3)

- **WHEN** `grep '禁写.*hooks.*字段' CLAUDE.md` is run
- **THEN** the match (if present) is accompanied by the three nuance clauses: validator rejection, config.toml path existence, and non-interactive firing unverified — or the line has been replaced by precise language conveying all three; a bare prohibition with no nuance does NOT appear

#### Scenario: CLAUDE.md contains the precise three-layer framing (B3)

- **WHEN** `CLAUDE.md` is read
- **THEN** it contains language specifying all three layers: (a) manifest `hooks` field is rejected by the validator (`validate_plugin.py`); (b) hook capability exists via `config.toml`; (c) non-interactive exec firing is unverified; (d) v1 does not depend on hooks

### Requirement: AGENTS.md hooks framing is precise

`AGENTS.md` (project-root, shared across agents), line ~68, currently reads (verbatim):

> "Codex 的 `plugin.json` **不要写 `hooks` 字段**（validator 拒绝）；…"

This line already contains the validator-rejection clause. It is MISSING the "Codex runtime hooks capability exists via `config.toml`" and "non-interactive firing unverified / trust-gated" nuances. The correction SHALL ADD those two missing clauses after the existing `（validator 拒绝）` parenthetical. No other content in `AGENTS.md` SHALL be changed — do NOT do a wholesale replacement of the line.

#### Scenario: AGENTS.md line ~68 gains the two missing nuance clauses (B3)

- **WHEN** `AGENTS.md` line ~68 is read after the correction
- **THEN** it contains: (a) the existing validator-rejection clause; (b) a new clause stating Codex runtime hooks capability exists via `config.toml`; (c) a new clause stating non-interactive exec firing is unverified/trust-gated

#### Scenario: AGENTS.md no other lines changed (B3)

- **WHEN** `AGENTS.md` is diffed against the pre-change version
- **THEN** only the `plugin.json` hooks line (~L68) has changed; all other lines are identical

### Requirement: ADAPTING-FROM-CLAUDE.md §1 table row for hooks is precise

`codex/ADAPTING-FROM-CLAUDE.md`, section §1 directory/manifest mapping table, line ~19, currently reads (verbatim):

> `| plugins/<p>/hooks/ | 暂不迁移 | manifest 拒绝 \`hooks\` 字段 |`

This row is already accurate for the manifest-rejection fact but is MISSING the config.toml path and the non-interactive firing caveat. The row SHALL be updated to the three-layer framing (all three facts present). No other rows in the §1 table SHALL be changed.

Target end-state for the row:

| `plugins/<p>/hooks/` | 暂不迁移（v1） | manifest `hooks` 字段被 `validate_plugin.py` 拒绝（exit 1）；hooks 能力存在（`config.toml` TOML `[[hooks.<Event>]]`），但非交互 exec 下触发未经验证（trust-gated）；Phase-2 可通过 install-time `config.toml` 注入实现 |

#### Scenario: ADAPTING-FROM-CLAUDE.md hooks row contains all three nuance clauses (B3)

- **WHEN** the `plugins/<p>/hooks/` row in the §1 table of `codex/ADAPTING-FROM-CLAUDE.md` is read
- **THEN** it contains: (a) validator rejection of the manifest `hooks` field; (b) hooks capability via `config.toml`; (c) non-interactive exec firing unverified/trust-gated

#### Scenario: No other ADAPTING-FROM-CLAUDE.md rows are changed (B3)

- **WHEN** `codex/ADAPTING-FROM-CLAUDE.md` is diffed against the pre-change version
- **THEN** only the `plugins/<p>/hooks/` row has changed; all other rows are identical

### Requirement: The functional prohibition is preserved in all three files

All three corrected files MUST continue to communicate clearly that adding a `hooks` field to `.codex-plugin/plugin.json` is prohibited and will cause `validate_plugin.py` to exit with a non-zero code. The correction SHALL add nuance, not remove the prohibition.

#### Scenario: Prohibition language preserved in CLAUDE.md (B3)

- **WHEN** `CLAUDE.md` is read after the correction
- **THEN** it still states clearly that `hooks` MUST NOT be added to `.codex-plugin/plugin.json`

#### Scenario: Prohibition language preserved in AGENTS.md (B3)

- **WHEN** `AGENTS.md` is read after the correction
- **THEN** it still states clearly that `hooks` MUST NOT be added to `.codex-plugin/plugin.json` (validator rejects it)

#### Scenario: Prohibition language preserved in ADAPTING-FROM-CLAUDE.md (B3)

- **WHEN** `codex/ADAPTING-FROM-CLAUDE.md` is read after the correction
- **THEN** the manifest `hooks` field prohibition is still clearly communicated (validator rejects with exit 1)
