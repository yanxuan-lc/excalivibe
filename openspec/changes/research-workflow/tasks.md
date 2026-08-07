## 1. The steps

- [x] 1.1 `genai.research-brief` — produce, main, artifact `QUESTION.md`
- [x] 1.2 `genai.research-plan` — produce, researcher, input from brief, artifact `PLAN.md`
- [x] 1.3 `genai.research-probe` — produce, researcher, input from plan, artifact `FINDINGS.md`, `report outcome` gate with `partial` as a legitimate result
- [x] 1.4 `genai.research-synth` — produce, researcher, input from probe, `signature_match` on findings, artifacts `REPORT.mdx` and `PROPOSAL.md`
- [x] 1.5 `genai.research-review` — judge, human, artifact `DECISION.md`
- [x] 1.6 Briefs for all five; none restates what the `researcher` agent already carries

## 2. The workflow

- [x] 2.1 `assets/workflows/genai-research.yaml` listing the five
- [x] 2.2 `SKILL.md`: the second workflow and its variable

## 3. Acceptance

- [x] 3.1 `make build` then `make check` — green, 524 artifacts
- [x] 3.2 Install into a fresh project; `fsx check` exits 0 and both workflows appear
- [x] 3.3 S-RSCH-OWN-VARIABLE: a research graph created supplying only the topic
- [x] 3.4 S-RSCH-BOUNDED: planning undispatchable before the question exists, and the reason names the upstream
- [x] 3.5 S-RSCH-SYNTH-SEPARATE: probe and synth are distinct steps and synth declares findings as an input
- [x] 3.6 S-RSCH-REJECT-RETURNS: a rejected review routes back to the brief
- [x] 3.7 `openspec validate --strict` and `check-spec.mjs` both exit 0
