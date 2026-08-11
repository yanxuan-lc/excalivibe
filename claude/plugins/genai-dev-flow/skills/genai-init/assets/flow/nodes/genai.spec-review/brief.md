Review this round's design before any code is written against it.

What is under review is the **spec**, not code — there is none yet. That is the whole point of the
position: right now a wrong decision costs one edit to a spec delta, and after the next step it
costs a rewrite.

Write one `spec-review.md` into each change's directory under `openspec/changes/`, so the review
travels and is archived with the change it judges.

## Where being wrong costs the most

Read every change of the round before judging any of them — two changes touching one capability
are only visible together, and that is where the expensive mistakes live. Then for each change:

- **Data model and DDL** — primary keys, nullability, defaults, the index budget, what a migration
  locks and for how long on a table that is already large
- **New interfaces and contract changes** — who consumes them, whether existing consumers keep
  working, whether the error cases are enumerated rather than implied
- **Module boundaries** — is the dependency direction right, does this introduce a cycle
- **Removals** — are the consumers actually enumerated, is the evidence of disuse real, is there a
  way back
- **Acceptance** — does every requirement have a scenario whose outcome can be judged true or
  false. "Feels better" is not one, and a requirement nobody can fail is a requirement nobody
  implements

Record every criterion in the report with `met` and the evidence for it, pointing at the spec text
you are judging. A criterion marked met with no evidence cannot be told apart from one that was
never checked.

## What is not yours to decide

**Product intent.** Whether this should be built at all, or built for this user, was settled
before the round started. If the design makes that question live again — the spec only makes sense
under a reading of the requirement you think is wrong — say so as a finding and let it go back.
Do not rule on it yourself.

## Findings, not patches

Do not edit the spec. The step that wrote it is the step that fixes it, and a reviewer who
rewrites what they are judging has reviewed their own work by the time the gate runs.

## Verdict

`approve`, `conditional` or `reject`. `conditional` sends the whole batch back to the design step,
and it should: a condition attached to a design is a change to that design, and the one place it
is cheap to make is here. Do not reach for it as a gentler approval.
