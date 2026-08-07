## Why

Setting a project up to run this flow takes six commands from three tools, in an order nobody has
written down, and the skill that installs the step definitions explicitly refuses to do the other
five. Its reasoning was diagnostic clarity — a failure in `fsx init` should not look like a failure
in our install. That reasoning does not survive contact with the alternative: two commands whose
order matters and which a person has to remember.

Two of those six are not in anyone's list at all:

- **The OpenSpec schema fork.** Our `design.md` carries eight sections beyond the stock template.
  A project without the fork scaffolds the stock one, and the completeness checker — which falls
  back to a built-in section list — then demands the eight that the template never produced. Every
  change starts by hand-adding headings.
- **`permissions.allow`.** Read-only git commands trip the host's own permission prompt, which is
  the actual cause of the "viewing history gets intercepted" complaint. It is configuration, and
  nobody configures it.

And the flow's `command` gates cannot exist until something asks the project what its own check
commands are. That is why `genai.full-check` currently trusts a report where it should re-run.

## What Changes

- `install-dev-workflow` becomes **`genai-init`** and absorbs the rest of the setup. Every run
  sorts each item into **created** (absent, so make it), **refreshed** (ours, so overwrite it) or
  **preserved** (the project's, so leave it) — and says which.
- Setup gains: dependency checks with consent, `openspec init`, the schema fork, `fsx init`,
  `fsx skill install`, a seeded `CONTEXT.md`, marker-delimited blocks in `AGENTS.md` / `CLAUDE.md`,
  and `permissions.allow` entries for read-only git.
- The project's four check commands are collected and **baked into the step definitions**, and
  preserved across re-runs by reading back what is installed. A command declared absent removes its
  gate rather than being faked.
- `genai.implement`, `genai.full-check` and `genai.integrate` gain the `command` gates that were
  deferred out of the two changes before this one.

## Capabilities

### New Capabilities

- `project-setup`: bringing a project to the state where the flow can run, repeatably, without
  overwriting anything the project owns.

### Modified Capabilities

- `dev-flow-stages`: the stages that run the project's own checks now do so under a gate that
  executes them, rather than reading a report that claims they were run.

## Impact

| Affected | What |
|---|---|
| `skills/install-dev-workflow/` → `skills/genai-init/` | renamed; `install-flow.mjs` → `init.mjs` and grows the setup steps |
| `skills/genai-init/assets/openspec-schema/` | new — the fork, shipped |
| `assets/nodes/genai.{implement,full-check,integrate}/node.yaml` | command gates, in removable blocks |
| `.claude-plugin/marketplace.json`, plugin manifests | the command's name changes |

**BREAKING** for anyone who invoked `/install-dev-workflow`. Nothing is released, so the blast
radius is a developer's own muscle memory.
