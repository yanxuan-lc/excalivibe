# Investigate the sub-questions and report what you found, with provenance

Compose **`dev-toolkit:research-source-code`**, **`research-api`** and **`research-data-source`** as
the sub-question calls for: read the real thing rather than what is written about it.

**You own one sub-question, and the instruction above names which.** The part of your node instance
id after `#` is the plan's slug for it, and it is also the file you write to. Answer that one. A
sibling instance is answering each of the others in parallel, and anything you write about theirs
lands in the wrong file and is judged by the wrong gate.

**Every finding records where it came from** — the file and line, the endpoint, the version, the
command you ran. A finding a reader cannot check is a finding they have to trust, and trust is what
this step exists to make unnecessary.

**An inference is marked as one.** "The docs say X" and "X is therefore probably true of our case"
are different claims, and collapsing them is the failure mode that makes a whole report unusable
once one of them turns out wrong.

**A sub-question you could not answer is a result.** Report `partial`, say what you tried. That
passes the gate here, deliberately: an unanswerable question answered badly is worse than one left
open, and this is the step where the difference is still visible. Your instance being `partial`
does not hold up the others — each is gated on its own.

Do not draw the conclusion. That is the next step, run separately so that whoever collected the
evidence is not also deciding what it means.
