# genai-dev-flow

A development flow, built on one separation that is easy to get wrong: **what is wanted**
and **how it gets built** are different things, and they do not belong in the same place.

Requirements live in `<project>_genai/`, a sibling of the repository. Specs, changes, docs and
code live in the repository and are versioned together, so any commit has all four in
agreement. Nothing in the flow needs a worktree, a symlink, or a copy of the todo list.

## Why the requirements are outside the repository

A requirement spans many versions, many branches and several rounds of discussion. It
corresponds to no commit. Put it in the repository and two things follow immediately: every
worktree carries its own invisible copy, and merging a batch guarantees a conflict in the
shared list.

Put it one directory up and both disappear. There is one copy, every worktree reads it live
through the filesystem, and two sessions claiming different items never touch the same file —
because there is no shared file, only one directory per item.

The cost is real and accepted: that directory has no history and no backup unless its owner
gives it one. That is a choice for whoever runs the project, not something this plugin decides.

## A sprint is a release unit, not a concurrency unit

One sprint is one version number, bumped once. It may carry several requirements split across
several specs and changes, but the outside world sees one release.

This is the distinction that a per-change flow keeps losing. Inside a single change's context
that change *is* everything, so finishing it looks like finishing a round — and the version
gets bumped, again, every time. Restating "do not bump the version" does not fix it; in this
repository a description that explicitly excluded a scenario still triggered on it 5 times out
of 5. What fixes it is never raising the subject upstream and putting the one step that *is*
allowed to bump it at the end.

## Every step is gated on something re-runnable

A step whose gate reads its own report has no gate. This was measured, not assumed: an executor
reported 12 of 12 checks passing while the static-analysis gate rejected the same artifact.

So report fields are used where a model's judgement legitimately belongs — a review verdict, a
coverage claim — and everything else is a command the gate runs itself. Report gates sit early
because they are cheap, not because they are trusted; the ones that decide are the ones that
re-run the work.

## What is here

| Skill | Decides |
|---|---|
| `genai-guideline` | What each step is gated on, whether a gate is strong enough, and how the gates a project supplies itself get written and maintained |
| `genai-init` | How a project gets wired up to run this flow, once |
| `genai-flow` | That a round should start, how the graph is built, and what to do when a step will not pass |
| `genai-backlog` | Where a stated intention belongs, what state it is in, and what is worth picking up next |

The split between the first three is **learn / install / drive**, and it is deliberate: a manual
that also drives gets read when nobody wanted to read, and a driver that also teaches makes every
round pay for the explanation.

Four agents come with it, and the split between them is not organisational: **each one has to
run in a context that did not produce what it is judging.** A spec author who accepts their own
requirements is checking work they already convinced themselves about. That independence is the
only thing the separation buys, and it is why they cannot be collapsed.

The seven step definitions install into the project's own `.flow/nodes/`, since they belong to the
engine rather than to any one agent framework.

This file is generated from `src/plugins/genai-dev-flow/README.md`. Do not edit it here.
