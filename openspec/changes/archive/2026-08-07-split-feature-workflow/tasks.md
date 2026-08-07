## 1. Workflow rename and asset layout

- [x] 1.1 Move `assets/workflow.yaml` to `assets/workflows/genai-feature.yaml`
- [x] 1.2 Make `install-flow.mjs` iterate `assets/workflows/*.yaml`, taking each workflow's name from its filename
- [x] 1.3 Remove the `--workflow` flag and its usage line
- [x] 1.4 Group the installer's report by workflow

## 2. New steps

- [x] 2.1 Add `genai.intent-slice` — judge, human/stdout, `patience: null`, `unattended: suspend`, input `brief` from `genai.brief`
- [x] 2.2 Add `genai.existing-suite` — verify, main, input `code` from `genai.implement`, gates in order: `signature_match` · `outputs_present` · `report outcome`
- [x] 2.3 Write both briefs; neither restates what its composed skill already says
- [x] 2.4 List both in `assets/workflows/genai-feature.yaml`

## 3. Existing steps

- [x] 3.1 Add optional `diagnosis` input from `genai.diagnose` to `genai.implement`
- [x] 3.2 Confirm `genai.diagnose` remains whitelisted — an un-whitelisted upstream fails at dispatch, not at graph creation

## 4. Documentation

- [x] 4.1 Update `SKILL.md`: workflow name, step count, the two new steps, `--workflow` removal
- [x] 4.2 Document removing the leftover `genai` workflow after a rename

## 5. Acceptance

- [x] 5.1 `make build` then `make check` — green, 426 artifacts
- [x] 5.2 Fresh project, install from the compiled `claude/` end, `fsx check` exits 0 with 16 steps under `genai-feature`
- [x] 5.3 S-STAGE-WF-ADDITIVE: drop a second workflow file listing one step, reinstall, both workflows appear, installer source untouched
- [x] 5.4 S-STAGE-SLICE-BLOCKS / SLICE-REJECTED / SLICE-RECORDED: build a requirement-stage graph and check dispatchability, reject routing, and the artifact gate
- [x] 5.5 S-STAGE-SUITE-MISSING / SUITE-FAILED / SUITE-FRESH: evaluate the suite gate with the result absent, failing, and stale in turn — the three messages must differ
- [x] 5.6 S-STAGE-DIAG-CARRIED / DIAG-ABSENT: preview `genai.implement` with and without a diagnosis on disk
- [x] 5.7 `openspec validate --strict` and `check-spec.mjs` both exit 0
